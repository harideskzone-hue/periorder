"""Train and evaluate LightGBM mean-regression forecasts."""

from pathlib import Path

import lightgbm as lgb
import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error

from periorder.features import (
    add_demand_features,
    build_forecast_frame,
    select_model_features,
)
from periorder.forecast import fit_sn_residuals, predict_sn_quantile

DATA_PATH = Path("data/processed/panel.parquet")
MODEL_DIR = Path("models")
RESULTS_DIR = Path("results")
HORIZONS = (2, 3)
QUANTILES = (0.40, 0.50, 0.75)
RANDOM_STATE = 42
HISTORY_FEATURES = [
    *(f"lag_{lag}" for lag in (0, 1, 2, 3, 4, 5, 6, 13, 20, 27)),
    "rolling_mean_7",
    "rolling_mean_14",
    "rolling_mean_28",
    "rolling_std_28",
    "rolling_zero_share_28",
]


def pinball_loss(
    actual: np.ndarray,
    predicted: np.ndarray,
    tau: float,
) -> float:
    """Calculate the pinball (check) loss for quantile tau."""
    errors = actual - predicted
    return float(np.mean(np.maximum(tau * errors, (tau - 1.0) * errors)))


def evaluate_point_forecast(
    actual: np.ndarray,
    predicted: np.ndarray,
) -> dict[str, float]:
    """Calculate point-forecast error metrics."""
    errors = actual - predicted
    return {
        "mae": float(mean_absolute_error(actual, predicted)),
        "rmse": float(np.sqrt(mean_squared_error(actual, predicted))),
        "bias_actual_minus_predicted": float(np.mean(errors)),
    }


def prepare_horizon_data(
    panel: pd.DataFrame,
    horizon: int,
) -> tuple[pd.DataFrame, list[str]]:
    """Join labels to predictors and remove rows lacking demand history."""
    targets = build_forecast_frame(panel, horizon=horizon)
    featured = add_demand_features(panel)
    feature_columns = select_model_features(featured)

    missing_history_columns = set(HISTORY_FEATURES) - set(featured.columns)
    if missing_history_columns:
        raise ValueError(
            f"Missing demand-history features: {sorted(missing_history_columns)}"
        )

    predictors = featured[["id", "day", *feature_columns]]
    frame = targets[["id", "day", "target", "sn_mean", "split"]].merge(
        predictors,
        on=["id", "day"],
        how="left",
        validate="one_to_one",
    )

    # Only demand-history features are mandatory. LightGBM can handle NaN
    # values in numeric price predictors without replacing them with zero.
    valid_history = frame[HISTORY_FEATURES].notna().all(axis=1)
    valid_target = frame["target"].notna() & np.isfinite(frame["target"])
    valid_split = frame["split"].isin(["train", "validation", "test"])
    frame = frame.loc[valid_history & valid_target & valid_split].copy()

    if frame.empty:
        raise ValueError(f"No usable rows for horizon {horizon}")
    if frame[feature_columns].select_dtypes(exclude=np.number).shape[1]:
        raise ValueError("All selected model features must be numeric.")

    return frame, feature_columns


def run_horizon(
    panel: pd.DataFrame,
    horizon: int,
) -> list[dict[str, float | str | int]]:
    """Fit on training data, early-stop on validation, evaluate on test."""
    frame, feature_columns = prepare_horizon_data(panel, horizon)

    train = frame.loc[frame["split"] == "train"]
    validation = frame.loc[frame["split"] == "validation"]
    test = frame.loc[frame["split"] == "test"]

    if train.empty or validation.empty or test.empty:
        raise ValueError(f"Missing train, validation, or test rows for horizon {horizon}")

    X_train = train[feature_columns]
    y_train = train["target"].to_numpy(dtype=float)
    X_validation = validation[feature_columns]
    y_validation = validation["target"].to_numpy(dtype=float)
    X_test = test[feature_columns]
    y_test = test["target"].to_numpy(dtype=float)

    model = lgb.LGBMRegressor(
        objective="regression",
        n_estimators=2000,
        learning_rate=0.05,
        num_leaves=63,
        min_child_samples=100,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=RANDOM_STATE,
        n_jobs=-1,
        importance_type="gain",
    )

    print(f"\n{'=' * 60}")
    print(f"Training LightGBM MR for horizon {horizon} days")
    print(f"{'=' * 60}")
    print(f"Train rows: {len(train):,}")
    print(f"Validation rows: {len(validation):,}")
    print(f"Test rows: {len(test):,}")

    model.fit(
        X_train,
        y_train,
        eval_set=[(X_validation, y_validation)],
        callbacks=[
            lgb.early_stopping(stopping_rounds=50, verbose=False),
            lgb.log_evaluation(period=0),
        ],
    )

    best_iteration = int(model.best_iteration_)
    print(f"Best iteration (early stopping): {best_iteration}")

    # Ensure output directories exist
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)

    # Save model
    model_path = MODEL_DIR / f"mr_horizon_{horizon}.txt"
    model.booster_.save_model(str(model_path))
    print(f"Saved model to {model_path}")

    # Save feature importances
    importance_df = pd.DataFrame({
        "feature": feature_columns,
        "importance": model.booster_.feature_importance(importance_type="gain"),
    }).sort_values("importance", ascending=False)
    importance_path = RESULTS_DIR / f"mr_feature_importance_horizon_{horizon}.csv"
    importance_df.to_csv(importance_path, index=False)
    print(f"Saved feature importances to {importance_path}")

    # Validation residuals for MR quantile calibration
    val_preds = model.predict(X_validation)
    mr_residuals = y_validation - val_preds
    print(f"Validation residual mean: {mr_residuals.mean():.4f}, std: {mr_residuals.std():.4f}")

    # Point forecast predictions on test
    mr_test_pred = np.maximum(0.0, model.predict(X_test))
    mr_point = evaluate_point_forecast(y_test, mr_test_pred)

    print(
        f"MR Test Point: MAE={mr_point['mae']:.4f}, "
        f"RMSE={mr_point['rmse']:.4f}, "
        f"bias={mr_point['bias_actual_minus_predicted']:.4f}"
    )

    # Seasonal Naive baseline on test
    sn_residuals = fit_sn_residuals(validation)
    sn_test = test.loc[test["sn_mean"].notna()].copy()
    sn_actual = sn_test["target"].to_numpy(dtype=float)
    sn_point_pred = sn_test["sn_mean"].to_numpy(dtype=float)
    sn_point = evaluate_point_forecast(sn_actual, sn_point_pred)

    print(
        f"SN Test Point: MAE={sn_point['mae']:.4f}, "
        f"RMSE={sn_point['rmse']:.4f}, "
        f"bias={sn_point['bias_actual_minus_predicted']:.4f}"
    )

    records: list[dict[str, float | str | int]] = [
        {
            "horizon": horizon,
            "model": "MR",
            "type": "point",
            "tau": "mean",
            "mae": mr_point["mae"],
            "rmse": mr_point["rmse"],
            "bias": mr_point["bias_actual_minus_predicted"],
            "pinball_loss": np.nan,
            "empirical_coverage": np.nan,
            "best_iteration": best_iteration,
            "n_train": len(train),
            "n_val": len(validation),
            "n_test": len(test),
        },
        {
            "horizon": horizon,
            "model": "SN",
            "type": "point",
            "tau": "mean",
            "mae": sn_point["mae"],
            "rmse": sn_point["rmse"],
            "bias": sn_point["bias_actual_minus_predicted"],
            "pinball_loss": np.nan,
            "empirical_coverage": np.nan,
            "best_iteration": 0,
            "n_train": len(train),
            "n_val": len(validation),
            "n_test": len(sn_test),
        },
    ]

    # Step 6: Quantile evaluation for requested quantiles with indexing fix
    for tau in QUANTILES:
        # MR calibrated quantile
        mr_eps_tau = float(np.quantile(mr_residuals, tau))
        mr_quantile_prediction = np.maximum(0.0, mr_test_pred + mr_eps_tau)
        mr_pinball = pinball_loss(y_test, mr_quantile_prediction, tau)
        mr_coverage = float(np.mean(y_test <= mr_quantile_prediction))

        # SN calibrated quantile calculated directly on sn_test (Step 6 fix)
        sn_quantile_prediction = predict_sn_quantile(
            sn_test, sn_residuals, tau
        ).to_numpy(dtype=float)
        sn_pinball = pinball_loss(sn_actual, sn_quantile_prediction, tau)
        sn_coverage = float(np.mean(sn_actual <= sn_quantile_prediction))

        print(
            f"tau={tau:.2f} | "
            f"MR: pinball={mr_pinball:.4f}, coverage={mr_coverage:.4f} | "
            f"SN: pinball={sn_pinball:.4f}, coverage={sn_coverage:.4f}"
        )

        records.append({
            "horizon": horizon,
            "model": "MR",
            "type": "quantile",
            "tau": tau,
            "mae": np.nan,
            "rmse": np.nan,
            "bias": np.nan,
            "pinball_loss": mr_pinball,
            "empirical_coverage": mr_coverage,
            "best_iteration": best_iteration,
            "n_train": len(train),
            "n_val": len(validation),
            "n_test": len(test),
        })
        records.append({
            "horizon": horizon,
            "model": "SN",
            "type": "quantile",
            "tau": tau,
            "mae": np.nan,
            "rmse": np.nan,
            "bias": np.nan,
            "pinball_loss": sn_pinball,
            "empirical_coverage": sn_coverage,
            "best_iteration": 0,
            "n_train": len(train),
            "n_val": len(validation),
            "n_test": len(sn_test),
        })

    return records


def main() -> None:
    """Run LightGBM Mean Regression pipeline for horizons 2 and 3."""
    print(f"Loading panel from {DATA_PATH}...")
    panel = pd.read_parquet(DATA_PATH)
    print(f"Panel shape: {panel.shape}")

    all_records: list[dict[str, float | str | int]] = []
    for horizon in HORIZONS:
        records = run_horizon(panel, horizon=horizon)
        all_records.extend(records)

    eval_df = pd.DataFrame(all_records)
    eval_path = RESULTS_DIR / "mr_evaluation.csv"
    eval_df.to_csv(eval_path, index=False)
    print(f"\nSaved evaluation results to {eval_path}")
    print("\nEvaluation Summary:")
    print(eval_df.to_string(index=False))


if __name__ == "__main__":
    main()
