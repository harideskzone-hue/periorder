"""Evaluate Negative Binomial (NB) probabilistic forecasts on M5 benchmark data."""

import lightgbm as lgb
import numpy as np
import pandas as pd

from periorder.forecast_nb import (
    MIN_DISPERSION,
    fit_nb_dispersion_by_series,
    predict_nb_quantile,
)
from periorder.train_mr import (
    DATA_PATH,
    MODEL_DIR,
    QUANTILES,
    RESULTS_DIR,
    pinball_loss,
    prepare_horizon_data,
)


def evaluate_nb_for_horizon(
    panel: pd.DataFrame,
    horizon: int,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Fit dispersion on validation data and evaluate NB quantiles on test data.

    Returns:
        (eval_df, dispersion_summary_df)
    """
    frame, feature_columns = prepare_horizon_data(panel, horizon=horizon)

    validation = frame.loc[frame["split"] == "validation"].copy()
    test = frame.loc[frame["split"] == "test"].copy()

    if validation.empty or test.empty:
        raise ValueError(f"Missing validation or test rows for horizon {horizon}")

    # Load frozen MR model
    model_path = MODEL_DIR / f"mr_horizon_{horizon}.txt"
    if not model_path.exists():
        raise FileNotFoundError(f"Trained MR model not found at {model_path}")

    booster = lgb.Booster(model_file=str(model_path))

    # Generate MR predictions on validation split
    val_X = validation[feature_columns]
    val_mr_mean = np.maximum(0.0, booster.predict(val_X))
    validation["mr_mean"] = val_mr_mean

    # Step 2: Estimate dispersion per-series on validation window only
    dispersions = fit_nb_dispersion_by_series(
        validation_df=validation,
        target_col="target",
        pred_col="mr_mean",
        id_col="id",
        min_dispersion=MIN_DISPERSION,
    )

    # Save per-series dispersion estimates
    disp_df = pd.DataFrame(
        list(dispersions.items()), columns=["id", "alpha"]
    ).sort_values("alpha", ascending=False)
    disp_path = RESULTS_DIR / f"nb_dispersion_horizon_{horizon}.csv"
    disp_df.to_csv(disp_path, index=False)

    alpha_vals = disp_df["alpha"].to_numpy()
    n_at_floor = int(np.sum(alpha_vals <= MIN_DISPERSION + 1e-9))
    print(f"\nHorizon {horizon} Dispersion Summary (500 series):")
    print(f"  Mean alpha:   {alpha_vals.mean():.4f}")
    print(f"  Median alpha: {np.median(alpha_vals):.4f}")
    print(f"  Min alpha:    {alpha_vals.min():.4f} (at floor: {n_at_floor} / {len(alpha_vals)})")
    print(f"  Max alpha:    {alpha_vals.max():.4f}")
    print(f"  25th %ile:    {np.percentile(alpha_vals, 25):.4f}")
    print(f"  75th %ile:    {np.percentile(alpha_vals, 75):.4f}")

    # Step 3: Evaluate on untouched test split
    test_X = test[feature_columns]
    test_mr_mean = np.maximum(0.0, booster.predict(test_X))
    test["mr_mean"] = test_mr_mean
    test["alpha"] = test["id"].map(dispersions).fillna(MIN_DISPERSION).to_numpy(dtype=float)

    y_test = test["target"].to_numpy(dtype=float)

    records: list[dict[str, float | str | int]] = []
    print(f"\nHorizon {horizon} Test Evaluation (N={len(test):,}):")

    for tau in QUANTILES:
        nb_quantile_pred = predict_nb_quantile(
            mean=test["mr_mean"].to_numpy(dtype=float),
            alpha=test["alpha"].to_numpy(dtype=float),
            tau=tau,
        )
        assert isinstance(nb_quantile_pred, np.ndarray)

        loss = pinball_loss(y_test, nb_quantile_pred, tau)
        cov = float(np.mean(y_test <= nb_quantile_pred))
        mean_q = float(np.mean(nb_quantile_pred))

        print(
            f"  tau={tau:.2f} | "
            f"Mean Q={mean_q:.4f}, "
            f"Pinball Loss={loss:.4f}, "
            f"Empirical Coverage={cov:.4f}"
        )

        records.append({
            "horizon": horizon,
            "model": "NB",
            "type": "quantile",
            "tau": tau,
            "mean_prediction": mean_q,
            "pinball_loss": loss,
            "empirical_coverage": cov,
            "n_test": len(test),
        })

    eval_df = pd.DataFrame(records)
    return eval_df, disp_df


def main() -> None:
    """Run Phase 3.3 Negative Binomial estimation and evaluation."""
    panel = pd.read_parquet(DATA_PATH)
    print(f"Loaded panel: {panel.shape}")

    all_evals = []
    for horizon in (2, 3):
        print(f"\n{'=' * 60}")
        print(f"NEGATIVE BINOMIAL EVALUATION — HORIZON {horizon} DAYS")
        print("=" * 60)
        eval_df, _ = evaluate_nb_for_horizon(panel, horizon=horizon)
        all_evals.append(eval_df)

    final_eval = pd.concat(all_evals, ignore_index=True)
    out_path = RESULTS_DIR / "nb_evaluation.csv"
    final_eval.to_csv(out_path, index=False)
    print(f"\nSaved Negative Binomial evaluation results to {out_path}")


if __name__ == "__main__":
    main()
