"""Run holding-share sensitivity experiments without overwriting primary results."""

from __future__ import annotations

from pathlib import Path

import pandas as pd

from periorder.config import (
    CRITICAL_RATIOS,
    LEAD_TIMES,
    SHELF_LIVES,
    calibrate_costs,
)
from periorder.policies import DEMAND_CLASSES, tune_quantile_by_class
from periorder.run_experiments import (
    BURN_IN_DAYS,
    PREDICTION_METHODS,
    load_predictions,
    load_series_metadata,
    simulate_test_series,
    validate_split,
)

ROOT = Path(".")
RESULTS_DIR = ROOT / "results"

# Keep the primary eta=0.20 experiment unchanged.
SENSITIVITY_HOLDING_SHARES = (0.50, 1.00)
STOCKOUT_COST = 1.0


def main() -> None:
    """Run sensitivity experiments for alternative holding-cost shares."""
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    metadata = load_series_metadata()

    all_series_results: list[dict] = []
    all_tuning_results: list[dict] = []
    all_selected_quantiles: list[dict] = []

    scenario_count = (
        len(LEAD_TIMES)
        * len(SHELF_LIVES)
        * len(CRITICAL_RATIOS)
        * len(SENSITIVITY_HOLDING_SHARES)
    )
    completed = 0

    for lead_time in LEAD_TIMES:
        horizon = lead_time + 1

        for method in PREDICTION_METHODS:
            print(f"\nLoading {method.upper()} predictions for horizon {horizon}...")
            predictions = load_predictions(method, horizon)
            validation_df = validate_split(predictions, "validation")
            test_df = validate_split(predictions, "test")

            test_df = test_df.merge(
                metadata,
                on="id",
                how="left",
                validate="many_to_one",
            )
            if test_df["store_id"].isna().any():
                raise ValueError("Some test series have no matching store_id.")

            for shelf_life in SHELF_LIVES:
                for critical_ratio in CRITICAL_RATIOS:
                    for holding_share in SENSITIVITY_HOLDING_SHARES:
                        completed += 1
                        costs = calibrate_costs(
                            critical_ratio=critical_ratio,
                            holding_share=holding_share,
                            stockout_cost=STOCKOUT_COST,
                        )

                        scenario = {
                            "method": method.upper(),
                            "horizon": horizon,
                            "lead_time": lead_time,
                            "shelf_life": shelf_life,
                            "critical_ratio": critical_ratio,
                            "holding_share": holding_share,
                        }

                        print(
                            f"[{completed}/{scenario_count * len(PREDICTION_METHODS)}] "
                            f"{method.upper()} | L={lead_time} | "
                            f"m={shelf_life} | CR={critical_ratio:.2f} | "
                            f"eta={holding_share:.2f}"
                        )

                        selected, tuning = tune_quantile_by_class(
                            validation_df,
                            lead_time=lead_time,
                            shelf_life=shelf_life,
                            costs=costs,
                            burn_in_days=BURN_IN_DAYS,
                        )

                        for row in tuning.to_dict(orient="records"):
                            all_tuning_results.append({**scenario, **row})

                        for demand_class in DEMAND_CLASSES:
                            all_selected_quantiles.append(
                                {
                                    **scenario,
                                    "policy": "TU",
                                    "demand_class": demand_class,
                                    "selected_quantile": selected[demand_class],
                                }
                            )

                        for policy in ("CR", "TU"):
                            series_rows, _ = simulate_test_series(
                                test_df,
                                method=method,
                                policy=policy,
                                lead_time=lead_time,
                                horizon=horizon,
                                shelf_life=shelf_life,
                                critical_ratio=critical_ratio,
                                holding_share=holding_share,
                                selected_quantiles=selected if policy == "TU" else None,
                                costs=costs,
                            )
                            all_series_results.extend(series_rows)

    series_df = pd.DataFrame(all_series_results)
    series_path = RESULTS_DIR / "experiment_sensitivity_holding_shares_series.csv"
    series_df.to_csv(series_path, index=False)

    grouping = [
        "method",
        "policy",
        "horizon",
        "lead_time",
        "shelf_life",
        "critical_ratio",
        "holding_share",
    ]
    summary = (
        series_df.groupby(grouping, as_index=False)
        .agg(
            series_count=("id", "nunique"),
            store_count=("store_id", "nunique"),
            demand=("demand", "sum"),
            sales=("sales", "sum"),
            lost_sales=("lost_sales", "sum"),
            expired_units=("expired_units", "sum"),
            total_cost=("total_cost", "sum"),
            holding_cost=("holding_cost", "sum"),
            stockout_cost=("stockout_cost", "sum"),
            expiry_cost=("expiry_cost", "sum"),
            mean_series_cost=("total_cost", "mean"),
            median_series_cost=("total_cost", "median"),
        )
    )
    summary["service_level"] = summary["sales"] / summary["demand"].where(
        summary["demand"].ne(0)
    )
    summary_path = RESULTS_DIR / "experiment_sensitivity_holding_shares.csv"
    summary.to_csv(summary_path, index=False)

    tuning_df = pd.DataFrame(all_tuning_results)
    tuning_path = RESULTS_DIR / "experiment_sensitivity_tu_validation.csv"
    tuning_df.to_csv(tuning_path, index=False)

    selected_df = pd.DataFrame(all_selected_quantiles)
    selected_path = RESULTS_DIR / "experiment_sensitivity_selected_quantiles.csv"
    selected_df.to_csv(selected_path, index=False)

    print("\nHolding-cost sensitivity experiment run complete.")
    print(f"Test series results:       {series_path} ({len(series_df):,} rows)")
    print(f"Test summary:               {summary_path} ({len(summary):,} rows)")
    print(f"TU validation diagnostics:  {tuning_path} ({len(tuning_df):,} rows)")
    print(f"Selected TU quantiles:      {selected_path} ({len(selected_df):,} rows)")


if __name__ == "__main__":
    main()
