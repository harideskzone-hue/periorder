"""Run validation-tuned CR/TU inventory experiments on the untouched test split."""

from __future__ import annotations

from collections import defaultdict
from pathlib import Path

import pandas as pd

from periorder.config import (
    CRITICAL_RATIOS,
    HOLDING_SHARES,
    LEAD_TIMES,
    SHELF_LIVES,
    TEST_START,
    calibrate_costs,
)
from periorder.policies import (
    DEMAND_CLASSES,
    critical_ratio_target,
    tune_quantile_by_class,
)
from periorder.simulator import simulate_inventory

ROOT = Path(".")
RESULTS_DIR = ROOT / "results"
PREDICTION_METHODS = ("sn", "mr", "nb", "qr")
BURN_IN_DAYS = 7


def load_series_metadata() -> pd.DataFrame:
    """Load the store identifier for each M5 series."""
    path = ROOT / "data" / "processed" / "series_meta.parquet"
    metadata = pd.read_parquet(path)

    required = {"id", "store_id"}
    missing = required - set(metadata.columns)
    if missing:
        raise ValueError(f"series_meta is missing columns: {sorted(missing)}")
    if metadata["id"].duplicated().any():
        raise ValueError("series_meta contains duplicate series IDs.")

    return metadata[["id", "store_id"]]


def load_predictions(method: str, horizon: int) -> pd.DataFrame:
    """Load and validate one standardized prediction file."""
    path = RESULTS_DIR / f"predictions_{method}_horizon_{horizon}.csv"
    if not path.exists():
        raise FileNotFoundError(f"Prediction file not found: {path}")

    frame = pd.read_csv(path)

    required = {"id", "day", "sales", "demand_class", "split"}
    missing = required - set(frame.columns)
    if missing:
        raise ValueError(f"{path} is missing columns: {sorted(missing)}")

    if frame.duplicated(["id", "day"]).any():
        raise ValueError(f"{path} contains duplicate id/day rows.")

    if not set(frame["split"].unique()).issubset({"validation", "test"}):
        raise ValueError(f"{path} contains an unexpected split label.")

    if frame[["id", "day", "sales", "demand_class", "split"]].isna().any().any():
        raise ValueError(f"{path} contains missing required values.")

    return frame


def validate_split(frame: pd.DataFrame, split: str) -> pd.DataFrame:
    """Return one chronological split and check its series structure."""
    selected = frame.loc[frame["split"].eq(split)].copy()
    if selected.empty:
        raise ValueError(f"No {split!r} rows found.")

    selected = selected.sort_values(["id", "day"]).reset_index(drop=True)

    for series_id, group in selected.groupby("id", sort=False):
        days = group["day"].to_numpy()
        if len(days) <= BURN_IN_DAYS:
            raise ValueError(
                f"{series_id} has too few {split} rows for "
                f"{BURN_IN_DAYS}-day burn-in."
            )
        if len(days) > 1 and not (days[1:] - days[:-1] == 1).all():
            raise ValueError(f"{series_id} has non-consecutive {split} days.")
        if group["demand_class"].nunique() != 1:
            raise ValueError(f"{series_id} has inconsistent demand classes.")

    return selected


def simulate_test_series(
    test_df: pd.DataFrame,
    *,
    method: str,
    policy: str,
    lead_time: int,
    horizon: int,
    shelf_life: int,
    critical_ratio: float,
    holding_share: float,
    selected_quantiles: dict[str, float] | None,
    costs,
) -> tuple[list[dict], dict]:
    """Simulate each test series and return series metrics and daily aggregates."""
    series_rows: list[dict] = []
    daily_totals: dict[int, dict] = defaultdict(
        lambda: {
            "demand": 0,
            "sales": 0,
            "lost_sales": 0,
            "arrivals": 0,
            "ending_inventory": 0,
            "expired_units": 0,
            "pipeline_inventory": 0,
            "order_quantity": 0,
            "holding_cost": 0.0,
            "stockout_cost": 0.0,
            "expiry_cost": 0.0,
        }
    )

    for series_id, group in test_df.groupby("id", sort=False):
        group = group.sort_values("day").reset_index(drop=True)
        demand = [int(value) for value in group["sales"]]
        demand_class = str(group["demand_class"].iloc[0])
        store_id = str(group["store_id"].iloc[0])

        if policy == "CR":
            targets = critical_ratio_target(group, critical_ratio)
            selected_q = critical_ratio
        elif policy == "TU":
            if selected_quantiles is None:
                raise ValueError("TU requires validation-selected quantiles.")
            selected_q = selected_quantiles[demand_class]
            quantile_column = f"q_{selected_q:.2f}"
            if quantile_column not in group.columns:
                raise ValueError(f"Missing TU prediction column: {quantile_column}")
            targets = group[quantile_column].to_numpy(dtype=float)
        else:
            raise ValueError(f"Unknown policy: {policy}")

        result = simulate_inventory(
            demand=demand,
            order_up_to=targets,
            lead_time=lead_time,
            shelf_life=shelf_life,
            costs=costs,
            burn_in_days=BURN_IN_DAYS,
        )

        total_demand = result.total_demand
        total_sales = result.total_sales
        scored = result.scored_records

        series_rows.append(
            {
                "id": series_id,
                "store_id": store_id,
                "demand_class": demand_class,
                "method": method.upper(),
                "policy": policy,
                "horizon": horizon,
                "lead_time": lead_time,
                "shelf_life": shelf_life,
                "critical_ratio": critical_ratio,
                "holding_share": holding_share,
                "selected_quantile": selected_q,
                "demand": total_demand,
                "sales": total_sales,
                "lost_sales": result.total_lost_sales,
                "expired_units": result.total_expired,
                "service_level": (
                    total_sales / total_demand if total_demand else float("nan")
                ),
                "total_cost": result.total_cost,
                "holding_cost": result.total_holding_cost,
                "stockout_cost": result.total_stockout_cost,
                "expiry_cost": result.total_expiry_cost,
                "mean_ending_inventory": (
                    sum(record.ending_inventory for record in scored) / len(scored)
                ),
                "total_order_quantity": sum(
                    record.order_quantity for record in scored
                ),
                "order_count": sum(
                    record.order_quantity > 0 for record in scored
                ),
                "scored_days": len(scored),
            }
        )

        # Map simulator-local day positions back to the original M5 day values.
        original_days = group["day"].to_numpy()
        for record in result.records:
            original_day = int(original_days[record.day])
            aggregate = daily_totals[original_day]
            aggregate["demand"] += record.demand
            aggregate["sales"] += record.sales
            aggregate["lost_sales"] += record.lost_sales
            aggregate["arrivals"] += record.arrivals
            aggregate["ending_inventory"] += record.ending_inventory
            aggregate["expired_units"] += record.expired
            aggregate["pipeline_inventory"] += record.pipeline_inventory
            aggregate["order_quantity"] += record.order_quantity
            aggregate["holding_cost"] += record.holding_cost
            aggregate["stockout_cost"] += record.stockout_cost
            aggregate["expiry_cost"] += record.expiry_cost

    return series_rows, daily_totals


def main() -> None:
    """Run validation-tuned CR and TU inventory evaluations across all scenarios."""
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    metadata = load_series_metadata()

    all_series_results: list[dict] = []
    all_tuning_results: list[dict] = []
    all_selected_quantiles: list[dict] = []
    daily_accumulator: dict[tuple, dict] = {}

    scenario_count = (
        len(LEAD_TIMES)
        * len(SHELF_LIVES)
        * len(CRITICAL_RATIOS)
        * len(HOLDING_SHARES)
    )
    completed = 0

    for lead_time in LEAD_TIMES:
        horizon = lead_time + 1

        for method in PREDICTION_METHODS:
            print(f"\nLoading {method.upper()} predictions for horizon {horizon}...")
            predictions = load_predictions(method, horizon)
            validation_df = validate_split(predictions, "validation")
            test_df = validate_split(predictions, "test")

            # Attach store IDs for store-level summaries and later inference.
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
                    for holding_share in HOLDING_SHARES:
                        completed += 1
                        costs = calibrate_costs(
                            critical_ratio=critical_ratio,
                            holding_share=holding_share,
                            stockout_cost=1.0,
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

                        # TU quantiles are selected using validation only.
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

                        # CR and TU are both evaluated on the same untouched test rows.
                        for policy in ("CR", "TU"):
                            series_rows, daily_totals = simulate_test_series(
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

                            # Aggregate daily records across series. This avoids
                            # writing tens of millions of per-series daily rows.
                            for day, values in daily_totals.items():
                                key = (
                                    method.upper(),
                                    policy,
                                    horizon,
                                    lead_time,
                                    shelf_life,
                                    critical_ratio,
                                    holding_share,
                                    day,
                                )
                                if key not in daily_accumulator:
                                    daily_accumulator[key] = {
                                        name: 0 for name in values
                                    }
                                for name, value in values.items():
                                    daily_accumulator[key][name] += value

    # Series-level test outcomes.
    series_df = pd.DataFrame(all_series_results)
    series_path = RESULTS_DIR / "experiment_test_series.csv"
    series_df.to_csv(series_path, index=False)

    # Overall test summary: totals and demand-weighted service level.
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
    summary_path = RESULTS_DIR / "experiment_test_summary.csv"
    summary.to_csv(summary_path, index=False)

    # Validation tuning diagnostics and selected TU quantiles.
    tuning_df = pd.DataFrame(all_tuning_results)
    tuning_path = RESULTS_DIR / "experiment_tu_validation.csv"
    tuning_df.to_csv(tuning_path, index=False)

    selected_df = pd.DataFrame(all_selected_quantiles)
    selected_path = RESULTS_DIR / "experiment_selected_quantiles.csv"
    selected_df.to_csv(selected_path, index=False)

    # Daily totals across all series, with a burn-in flag.
    daily_rows = []
    for key, values in daily_accumulator.items():
        (
            method,
            policy,
            horizon,
            lead_time,
            shelf_life,
            critical_ratio,
            holding_share,
            day,
        ) = key
        daily_rows.append(
            {
                "method": method,
                "policy": policy,
                "horizon": horizon,
                "lead_time": lead_time,
                "shelf_life": shelf_life,
                "critical_ratio": critical_ratio,
                "holding_share": holding_share,
                "day": day,
                "is_burn_in": False,  # Set below from the original split boundary.
                **values,
            }
        )

    daily_df = pd.DataFrame(daily_rows)
    # M5 test starts at d_1577; the first seven test days are burn-in.
    daily_df["is_burn_in"] = daily_df["day"] < (TEST_START + BURN_IN_DAYS)
    daily_path = RESULTS_DIR / "experiment_test_daily.csv"
    daily_df.to_csv(daily_path, index=False)

    print("\nExperiment run complete.")
    print(f"Test series results:       {series_path} ({len(series_df):,} rows)")
    print(f"Test summary:               {summary_path} ({len(summary):,} rows)")
    print(f"TU validation diagnostics:  {tuning_path} ({len(tuning_df):,} rows)")
    print(f"Selected TU quantiles:      {selected_path} ({len(selected_df):,} rows)")
    print(f"Aggregated daily results:   {daily_path} ({len(daily_df):,} rows)")


if __name__ == "__main__":
    main()
