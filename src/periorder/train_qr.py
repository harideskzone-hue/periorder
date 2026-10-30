"""Train and evaluate direct LightGBM quantile-regression forecasts."""


import lightgbm as lgb
import numpy as np
import pandas as pd

from periorder.config import TUNING_QUANTILES
from periorder.forecast_qr import (
    quantile_crossing_rate,
    quantile_crossing_row_rate,
    sort_quantile_predictions,
)
from periorder.train_mr import (
    DATA_PATH,
    MODEL_DIR,
    RESULTS_DIR,
    pinball_loss,
    prepare_horizon_data,
)

HORIZONS = (2, 3)
RANDOM_STATE = 42


def train_qr_for_horizon(
    panel: pd.DataFrame,
    horizon: int,
) -> pd.DataFrame:
    """Train direct quantile models and evaluate on the untouched test split."""
    frame, feature_columns = prepare_horizon_data(panel, horizon=horizon)

    train = frame.loc[frame["split"] == "train"].copy()
    validation = frame.loc[frame["split"] == "validation"].copy()
    test = frame.loc[frame["split"] == "test"].copy()

    if train.empty or validation.empty or test.empty:
        raise ValueError(
            f"Missing train, validation, or test rows for horizon {horizon}."
        )

    X_train = train[feature_columns]
    y_train = train["target"].to_numpy(dtype=float)
    X_val = validation[feature_columns]
    y_val = validation["target"].to_numpy(dtype=float)
    X_test = test[feature_columns]
    y_test = test["target"].to_numpy(dtype=float)

    quantiles = tuple(TUNING_QUANTILES)
    raw_predictions = np.empty((len(test), len(quantiles)), dtype=float)
    best_iterations: list[int] = []

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)

    print(f"\n{'=' * 68}")
    print(f"DIRECT QUANTILE REGRESSION — HORIZON {horizon}")
    print(f"{'=' * 68}")
    print(f"Train rows:      {len(train):,}")
    print(f"Validation rows: {len(validation):,}")
    print(f"Test rows:       {len(test):,}")
    print(f"Features:        {len(feature_columns)}")
    print(f"Quantiles:       {quantiles}")

    for column, tau in enumerate(quantiles):
        print(f"\nTraining QR: horizon={horizon}, tau={tau:.2f}")

        model = lgb.LGBMRegressor(
            objective="quantile",
            alpha=tau,
            n_estimators=2000,
            learning_rate=0.05,
            num_leaves=63,
            min_child_samples=100,
            subsample=0.8,
            colsample_bytree=0.8,
            random_state=RANDOM_STATE,
            n_jobs=-1,
            importance_type="gain",
            verbosity=-1,
        )

        model.fit(
            X_train,
            y_train,
            eval_set=[(X_val, y_val)],
            eval_metric="quantile",
            callbacks=[
                lgb.early_stopping(stopping_rounds=50, verbose=False),
                lgb.log_evaluation(period=0),
            ],
        )

        best_iteration = int(model.best_iteration_ or model.n_estimators)
        best_iterations.append(best_iteration)

        raw_predictions[:, column] = model.predict(
            X_test,
            num_iteration=best_iteration,
        )

        model_path = MODEL_DIR / (
            f"qr_horizon_{horizon}_tau_{tau:.2f}.txt"
        )
        model.booster_.save_model(
            str(model_path),
            num_iteration=best_iteration,
        )

        print(
            f"  Best iteration: {best_iteration}; saved: {model_path}"
        )

    raw_crossing_pairs = quantile_crossing_rate(raw_predictions)
    raw_crossing_rows = quantile_crossing_row_rate(raw_predictions)

    # Enforce non-crossing quantiles across each test observation.
    sorted_predictions = sort_quantile_predictions(raw_predictions)

    print("\nTest-set quantile evaluation")
    print(f"Raw adjacent-pair crossing rate: {raw_crossing_pairs:.6f}")
    print(f"Rows with any raw crossing:      {raw_crossing_rows:.6f}")

    records: list[dict[str, float | str | int]] = []

    for column, tau in enumerate(quantiles):
        raw_q = raw_predictions[:, column]
        sorted_q = sorted_predictions[:, column]

        raw_loss = pinball_loss(y_test, raw_q, tau)
        sorted_loss = pinball_loss(y_test, sorted_q, tau)
        coverage = float(np.mean(y_test <= sorted_q))

        record = {
            "horizon": horizon,
            "model": "QR",
            "type": "quantile",
            "tau": tau,
            "mean_prediction": float(np.mean(sorted_q)),
            "raw_pinball_loss": raw_loss,
            "pinball_loss": sorted_loss,
            "empirical_coverage": coverage,
            "raw_crossing_pair_rate": raw_crossing_pairs,
            "raw_crossing_row_rate": raw_crossing_rows,
            "best_iteration": best_iterations[column],
            "n_train": len(train),
            "n_val": len(validation),
            "n_test": len(test),
        }
        records.append(record)

        print(
            f"tau={tau:.2f} | "
            f"raw pinball={raw_loss:.4f} | "
            f"sorted pinball={sorted_loss:.4f} | "
            f"coverage={coverage:.4f}"
        )

    return pd.DataFrame(records)


def main() -> None:
    """Run direct QR for both configured forecast horizons."""
    print(f"Loading panel from {DATA_PATH}...")
    panel = pd.read_parquet(DATA_PATH)
    print(f"Panel shape: {panel.shape}")

    evaluations = [
        train_qr_for_horizon(panel, horizon)
        for horizon in HORIZONS
    ]
    final_eval = pd.concat(evaluations, ignore_index=True)

    output_path = RESULTS_DIR / "qr_evaluation.csv"
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    final_eval.to_csv(output_path, index=False)

    print(f"\nSaved QR evaluation to {output_path}")
    print("\nQR evaluation summary:")
    print(final_eval.to_string(index=False))


if __name__ == "__main__":
    main()
