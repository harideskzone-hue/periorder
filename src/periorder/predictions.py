"""Generate standardized validation and test quantile predictions.

Forecasting methods:
    SN: Seasonal Naive with per-series residual calibration.
    MR: Mean Regression with per-series residual calibration.
    NB: Negative Binomial using per-series dispersion parameters.
    QR: Direct Quantile Regression.

Existing trained models are loaded from models/.
No model retraining takes place in this module.
"""

from collections.abc import Sequence
from pathlib import Path

import lightgbm as lgb
import numpy as np
import pandas as pd

from periorder.config import TUNING_QUANTILES
from periorder.forecast_nb import predict_nb_quantile
from periorder.forecast_qr import sort_quantile_predictions
from periorder.train_mr import (
    DATA_PATH,
    MODEL_DIR,
    RESULTS_DIR,
    prepare_horizon_data,
)

HORIZONS: tuple[int, ...] = (2, 3)
SPLITS_TO_EXPORT: tuple[str, ...] = ("validation", "test")
BASE_COLUMNS: list[str] = [
    "id",
    "day",
    "sales",
    "target",
    "split",
    "demand_class",
]


def validate_quantiles(quantiles: Sequence[float]) -> tuple[float, ...]:
    """Validate and return the configured quantile levels."""
    values = tuple(float(q) for q in quantiles)
    if not values:
        raise ValueError("At least one quantile level must be provided.")
    if any(not 0.0 < q < 1.0 for q in values):
        raise ValueError("Every quantile must be strictly between 0 and 1.")
    if tuple(sorted(values)) != values:
        raise ValueError("Quantiles must be in strictly ascending order.")
    return values


def calibrate_series_residuals(
    val_df: pd.DataFrame,
    actual_col: str,
    pred_col: str,
    quantiles: Sequence[float],
) -> pd.DataFrame:
    """Compute per-series empirical residual quantiles on validation data.

    Returns:
        DataFrame indexed by series id with columns q_{tau:.2f}.
    """
    valid_quantiles = validate_quantiles(quantiles)
    required = {"id", actual_col, pred_col}
    missing = required - set(val_df.columns)
    if missing:
        raise ValueError(f"Missing required columns for residual calibration: {sorted(missing)}")
    if val_df.empty:
        raise ValueError("Validation DataFrame cannot be empty.")

    actual = val_df[actual_col].to_numpy(dtype=float)
    pred = val_df[pred_col].to_numpy(dtype=float)
    if not (np.isfinite(actual).all() and np.isfinite(pred).all()):
        raise ValueError("Actual and predicted values must be finite.")

    residuals = actual - pred
    temp = pd.DataFrame({
        "id": val_df["id"].to_numpy(),
        "residual": residuals,
    })

    q_series = temp.groupby("id", sort=False)["residual"].quantile(list(valid_quantiles)).unstack()
    q_series.columns = [f"q_{q:.2f}" for q in valid_quantiles]

    if q_series.isna().any().any():
        raise ValueError("NaN values detected in calibrated residual quantiles.")

    return q_series


def generate_sn_predictions(
    eval_frame: pd.DataFrame,
    val_frame: pd.DataFrame,
    quantiles: Sequence[float],
) -> pd.DataFrame:
    """Generate Seasonal Naive quantile predictions with per-series residual calibration."""
    valid_quantiles = validate_quantiles(quantiles)
    calib = calibrate_series_residuals(
        val_df=val_frame,
        actual_col="target",
        pred_col="sn_mean",
        quantiles=valid_quantiles,
    )

    result = eval_frame[BASE_COLUMNS].copy()
    sn_mean = eval_frame["sn_mean"].to_numpy(dtype=float)

    raw_q = np.empty((len(eval_frame), len(valid_quantiles)), dtype=float)
    for col_idx, q in enumerate(valid_quantiles):
        col_name = f"q_{q:.2f}"
        eps_q = eval_frame["id"].map(calib[col_name]).to_numpy(dtype=float)
        raw_q[:, col_idx] = np.maximum(0.0, sn_mean + eps_q)

    sorted_q = sort_quantile_predictions(raw_q)
    for col_idx, q in enumerate(valid_quantiles):
        result[f"q_{q:.2f}"] = sorted_q[:, col_idx]

    return result


def generate_mr_predictions(
    eval_frame: pd.DataFrame,
    val_frame: pd.DataFrame,
    feature_columns: list[str],
    mr_booster: lgb.Booster,
    quantiles: Sequence[float],
) -> pd.DataFrame:
    """Generate Mean Regression quantile predictions with per-series residual calibration."""
    valid_quantiles = validate_quantiles(quantiles)

    # Validation residual calibration using raw predictions
    val_raw_preds = mr_booster.predict(val_frame[feature_columns])
    val_temp = val_frame.copy()
    val_temp["mr_pred"] = val_raw_preds

    calib = calibrate_series_residuals(
        val_df=val_temp,
        actual_col="target",
        pred_col="mr_pred",
        quantiles=valid_quantiles,
    )

    result = eval_frame[BASE_COLUMNS].copy()
    eval_mr_mean = np.maximum(0.0, mr_booster.predict(eval_frame[feature_columns]))

    raw_q = np.empty((len(eval_frame), len(valid_quantiles)), dtype=float)
    for col_idx, q in enumerate(valid_quantiles):
        col_name = f"q_{q:.2f}"
        eps_q = eval_frame["id"].map(calib[col_name]).to_numpy(dtype=float)
        raw_q[:, col_idx] = np.maximum(0.0, eval_mr_mean + eps_q)

    sorted_q = sort_quantile_predictions(raw_q)
    for col_idx, q in enumerate(valid_quantiles):
        result[f"q_{q:.2f}"] = sorted_q[:, col_idx]

    return result


def generate_nb_predictions(
    eval_frame: pd.DataFrame,
    feature_columns: list[str],
    mr_booster: lgb.Booster,
    dispersion_path: Path,
    quantiles: Sequence[float],
) -> pd.DataFrame:
    """Generate Negative Binomial quantile predictions using fitted per-series dispersion."""
    valid_quantiles = validate_quantiles(quantiles)
    if not dispersion_path.exists():
        raise FileNotFoundError(f"Dispersion file not found: {dispersion_path}")

    disp_df = pd.read_csv(dispersion_path)
    if not {"id", "alpha"}.issubset(disp_df.columns):
        raise ValueError(f"Dispersion file missing required columns: {dispersion_path}")

    unique_ids = set(eval_frame["id"].unique())
    disp_ids = set(disp_df["id"].unique())
    missing_ids = unique_ids - disp_ids
    if missing_ids:
        raise ValueError(f"Missing dispersion parameters for {len(missing_ids)} series.")

    alpha_map = dict(zip(disp_df["id"], disp_df["alpha"], strict=False))
    alpha_arr = eval_frame["id"].map(alpha_map).to_numpy(dtype=float)
    if not np.isfinite(alpha_arr).all() or (alpha_arr < 1e-6).any():
        raise ValueError("Invalid dispersion parameters in alpha mapping.")

    eval_mr_mean = np.maximum(0.0, mr_booster.predict(eval_frame[feature_columns]))

    result = eval_frame[BASE_COLUMNS].copy()
    raw_q = np.empty((len(eval_frame), len(valid_quantiles)), dtype=float)

    for col_idx, q in enumerate(valid_quantiles):
        pred_q = predict_nb_quantile(
            mean=eval_mr_mean,
            alpha=alpha_arr,
            tau=q,
        )
        assert isinstance(pred_q, np.ndarray)
        raw_q[:, col_idx] = np.maximum(0.0, pred_q)

    sorted_q = sort_quantile_predictions(raw_q)
    for col_idx, q in enumerate(valid_quantiles):
        result[f"q_{q:.2f}"] = sorted_q[:, col_idx]

    return result


def generate_qr_predictions(
    eval_frame: pd.DataFrame,
    feature_columns: list[str],
    horizon: int,
    model_dir: Path,
    quantiles: Sequence[float],
) -> pd.DataFrame:
    """Generate Direct Quantile Regression predictions from saved LightGBM models."""
    valid_quantiles = validate_quantiles(quantiles)
    result = eval_frame[BASE_COLUMNS].copy()
    raw_q = np.empty((len(eval_frame), len(valid_quantiles)), dtype=float)

    for col_idx, q in enumerate(valid_quantiles):
        model_path = model_dir / f"qr_horizon_{horizon}_tau_{q:.2f}.txt"
        if not model_path.exists():
            raise FileNotFoundError(f"QR model not found: {model_path}")

        booster = lgb.Booster(model_file=str(model_path))
        pred = booster.predict(eval_frame[feature_columns])
        raw_q[:, col_idx] = np.maximum(0.0, pred)

    sorted_q = sort_quantile_predictions(raw_q)
    for col_idx, q in enumerate(valid_quantiles):
        result[f"q_{q:.2f}"] = sorted_q[:, col_idx]

    return result


def process_horizon(
    panel: pd.DataFrame,
    horizon: int,
    quantiles: Sequence[float] = TUNING_QUANTILES,
    model_dir: Path = MODEL_DIR,
    results_dir: Path = RESULTS_DIR,
) -> dict[str, pd.DataFrame]:
    """Run full prediction generation for one horizon and save CSVs."""
    print(f"\n{'=' * 65}")
    print(f"PROCESSING PREDICTIONS FOR HORIZON {horizon}")
    print("=' * 65")

    frame, feature_columns = prepare_horizon_data(panel, horizon=horizon)
    eval_mask = frame["split"].isin(SPLITS_TO_EXPORT)
    eval_frame = frame.loc[eval_mask].copy()

    # Join sales and demand_class from panel
    meta_cols = panel[["id", "day", "sales", "demand_class"]].copy()
    eval_frame = eval_frame.merge(
        meta_cols,
        on=["id", "day"],
        how="left",
        validate="one_to_one",
    )

    # Sort deterministically by (id, day) and reset index
    eval_frame = eval_frame.sort_values(["id", "day"]).reset_index(drop=True)

    val_mask = eval_frame["split"] == "validation"
    val_frame = eval_frame.loc[val_mask].copy()

    print(f"Total evaluation rows: {len(eval_frame):,} (val: {len(val_frame):,}, test: {len(eval_frame) - len(val_frame):,})")

    # Load MR booster
    mr_model_path = model_dir / f"mr_horizon_{horizon}.txt"
    if not mr_model_path.exists():
        raise FileNotFoundError(f"MR model not found: {mr_model_path}")
    mr_booster = lgb.Booster(model_file=str(mr_model_path))

    # SN
    print("Generating SN predictions...")
    sn_df = generate_sn_predictions(eval_frame, val_frame, quantiles)
    sn_path = results_dir / f"predictions_sn_horizon_{horizon}.csv"
    sn_df.to_csv(sn_path, index=False)
    print(f"Saved: {sn_path}")

    # MR
    print("Generating MR predictions...")
    mr_df = generate_mr_predictions(eval_frame, val_frame, feature_columns, mr_booster, quantiles)
    mr_path = results_dir / f"predictions_mr_horizon_{horizon}.csv"
    mr_df.to_csv(mr_path, index=False)
    print(f"Saved: {mr_path}")

    # NB
    print("Generating NB predictions...")
    disp_path = results_dir / f"nb_dispersion_horizon_{horizon}.csv"
    nb_df = generate_nb_predictions(eval_frame, feature_columns, mr_booster, disp_path, quantiles)
    nb_path = results_dir / f"predictions_nb_horizon_{horizon}.csv"
    nb_df.to_csv(nb_path, index=False)
    print(f"Saved: {nb_path}")

    # QR
    print("Generating QR predictions...")
    qr_df = generate_qr_predictions(eval_frame, feature_columns, horizon, model_dir, quantiles)
    qr_path = results_dir / f"predictions_qr_horizon_{horizon}.csv"
    qr_df.to_csv(qr_path, index=False)
    print(f"Saved: {qr_path}")

    return {
        "sn": sn_df,
        "mr": mr_df,
        "nb": nb_df,
        "qr": qr_df,
    }


def main() -> None:
    """Generate all standardized prediction files for horizons 2 and 3."""
    print(f"Loading benchmark panel from {DATA_PATH}...")
    panel = pd.read_parquet(DATA_PATH)
    print(f"Loaded panel: {panel.shape}")

    RESULTS_DIR.mkdir(parents=True, exist_ok=True)

    for horizon in HORIZONS:
        process_horizon(
            panel=panel,
            horizon=horizon,
            quantiles=TUNING_QUANTILES,
            model_dir=MODEL_DIR,
            results_dir=RESULTS_DIR,
        )

    print("\nAll predictions generated successfully.")


if __name__ == "__main__":
    main()
