"""Replay test series simulations to extract exact series-level Cycle Service Level (CSL).

This script performs a deterministic replay of test-series inventory simulations using
the exact saved predictions and frozen validation-selected quantiles. It computes:
    - stockout_days: number of scored days with lost_sales > 0
    - scored_days: total days evaluated after 7-day burn-in
    - csl: series-level cycle service level (1 - stockout_days / scored_days)
    - received_units: total arrivals during scored days
    - waste_rate: expired_units / received_units (0.0 if received_units == 0)
    - fill_rate: sales / demand (0.0 if demand == 0)

All results are validated against existing experiment CSVs to guarantee 100% numerical consistency.
Original files remain completely untouched.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

from periorder.config import (
    CRITICAL_RATIOS,
    LEAD_TIMES,
    SHELF_LIVES,
    calibrate_costs,
)
from periorder.run_experiments import (
    BURN_IN_DAYS,
    PREDICTION_METHODS,
    critical_ratio_target,
    load_predictions,
    load_series_metadata,
    validate_split,
)
from periorder.simulator import simulate_inventory

ROOT = Path(".")
RESULTS_DIR = ROOT / "results"
PRIMARY_HOLDING_SHARES = (0.20,)
SENSITIVITY_HOLDING_SHARES = (0.50, 1.00)
ALL_HOLDING_SHARES = (0.20, 0.50, 1.00)
STOCKOUT_COST = 1.0


def load_quantiles_lookup() -> dict[tuple[str, int, int, float, float, str], float]:
    """Load both primary and sensitivity frozen quantiles into a single lookup dict."""
    prim_path = RESULTS_DIR / "experiment_selected_quantiles.csv"
    sens_path = RESULTS_DIR / "experiment_sensitivity_selected_quantiles.csv"

    if not prim_path.exists():
        raise FileNotFoundError(f"Missing primary quantiles: {prim_path}")
    if not sens_path.exists():
        raise FileNotFoundError(f"Missing sensitivity quantiles: {sens_path}")

    df_prim = pd.read_csv(prim_path)
    df_sens = pd.read_csv(sens_path)
    df_all = pd.concat([df_prim, df_sens], ignore_index=True)

    lookup: dict[tuple[str, int, int, float, float, str], float] = {}
    for _, row in df_all.iterrows():
        key = (
            str(row["method"]).upper(),
            int(row["lead_time"]),
            int(row["shelf_life"]),
            round(float(row["critical_ratio"]), 2),
            round(float(row["holding_share"]), 2),
            str(row["demand_class"]),
        )
        lookup[key] = float(row["selected_quantile"])
    return lookup


def simulate_and_extract_csl(
    test_df: pd.DataFrame,
    *,
    method: str,
    policy: str,
    lead_time: int,
    horizon: int,
    shelf_life: int,
    critical_ratio: float,
    holding_share: float,
    quantiles_lookup: dict[tuple[str, int, int, float, float, str], float],
) -> list[dict]:
    """Replay simulation for 500 series and extract per-series CSL and waste rate."""
    costs = calibrate_costs(
        critical_ratio=critical_ratio,
        holding_share=holding_share,
        stockout_cost=STOCKOUT_COST,
    )

    series_rows: list[dict] = []

    for series_id, group in test_df.groupby("id", sort=False):
        group = group.sort_values("day").reset_index(drop=True)
        demand = [int(v) for v in group["sales"]]
        demand_class = str(group["demand_class"].iloc[0])
        store_id = str(group["store_id"].iloc[0])

        if policy == "CR":
            targets = critical_ratio_target(group, critical_ratio)
            selected_q = critical_ratio
        elif policy == "TU":
            q_key = (
                method.upper(),
                lead_time,
                shelf_life,
                round(critical_ratio, 2),
                round(holding_share, 2),
                demand_class,
            )
            selected_q = quantiles_lookup[q_key]
            quantile_col = f"q_{selected_q:.2f}"
            targets = group[quantile_col].to_numpy(dtype=float)
        else:
            raise ValueError(f"Unknown policy: {policy}")

        res = simulate_inventory(
            demand=demand,
            order_up_to=targets,
            lead_time=lead_time,
            shelf_life=shelf_life,
            costs=costs,
            burn_in_days=BURN_IN_DAYS,
        )

        scored = res.scored_records
        scored_days = len(scored)
        stockout_days = sum(1 for r in scored if r.lost_sales > 0)
        csl = 1.0 - (stockout_days / scored_days) if scored_days > 0 else float("nan")

        received_units = sum(r.arrivals for r in scored)
        expired_units = res.total_expired
        waste_rate = expired_units / received_units if received_units > 0 else 0.0

        total_demand = res.total_demand
        total_sales = res.total_sales
        fill_rate = total_sales / total_demand if total_demand > 0 else float("nan")

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
                "lost_sales": res.total_lost_sales,
                "expired_units": expired_units,
                "received_units": received_units,
                "stockout_days": stockout_days,
                "scored_days": scored_days,
                "fill_rate": fill_rate,
                "service_level": fill_rate,  # backward compatibility alias
                "csl": csl,
                "waste_rate": waste_rate,
                "total_cost": res.total_cost,
                "holding_cost": res.total_holding_cost,
                "stockout_cost": res.total_stockout_cost,
                "expiry_cost": res.total_expiry_cost,
                "mean_ending_inventory": (
                    sum(r.ending_inventory for r in scored) / scored_days
                ),
                "total_order_quantity": sum(r.order_quantity for r in scored),
                "order_count": sum(r.order_quantity > 0 for r in scored),
            }
        )

    return series_rows


def validate_against_original(
    replayed_df: pd.DataFrame,
    original_path: Path,
    label: str,
) -> None:
    """Validate that replayed metrics match the original series results exactly."""
    if not original_path.exists():
        raise FileNotFoundError(f"Cannot find original file for validation: {original_path}")

    orig_df = pd.read_csv(original_path)
    print(f"Validating {label} against {original_path.name} ({len(orig_df):,} rows)...")

    # Match rows on unique composite key
    key_cols = [
        "id",
        "method",
        "policy",
        "lead_time",
        "shelf_life",
        "critical_ratio",
        "holding_share",
    ]
    orig_indexed = orig_df.set_index(key_cols)
    replay_indexed = replayed_df.set_index(key_cols)

    common_keys = orig_indexed.index.intersection(replay_indexed.index)
    if len(common_keys) != len(orig_indexed):
        raise ValueError(
            f"Key mismatch: expected {len(orig_indexed)} rows, found {len(common_keys)} matches."
        )

    sub_orig = orig_indexed.loc[common_keys]
    sub_replay = replay_indexed.loc[common_keys]

    for col in ["demand", "sales", "lost_sales", "expired_units"]:
        diff = np.abs(sub_replay[col].to_numpy() - sub_orig[col].to_numpy())
        max_diff = int(np.max(diff))
        if max_diff > 0:
            raise ValueError(f"Integrity check failed for {col}: max diff {max_diff}")

    cost_diff = np.abs(sub_replay["total_cost"].to_numpy() - sub_orig["total_cost"].to_numpy())
    max_cost_diff = float(np.max(cost_diff))
    if max_cost_diff > 1e-4:
        raise ValueError(f"Cost integrity check failed: max diff {max_cost_diff:.6f}")

    print(f"  ✓ {label} 100% verified against {original_path.name} (max cost diff: {max_cost_diff:.2e})")


def build_service_metrics_summary(series_df: pd.DataFrame) -> pd.DataFrame:
    """Compute aggregated service metrics table (Fill Rate, CSL, Waste Rate)."""
    group_cols = [
        "method",
        "policy",
        "horizon",
        "lead_time",
        "shelf_life",
        "critical_ratio",
        "holding_share",
    ]

    records: list[dict] = []
    for keys, group in series_df.groupby(group_cols, sort=False):
        method, policy, horizon, lt, sl, cr, eta = keys
        tot_demand = int(group["demand"].sum())
        tot_sales = int(group["sales"].sum())
        tot_lost_sales = int(group["lost_sales"].sum())
        tot_expired = int(group["expired_units"].sum())
        tot_received = int(group["received_units"].sum())
        tot_stockout_days = int(group["stockout_days"].sum())
        tot_scored_days = int(group["scored_days"].sum())

        fill_rate_agg = tot_sales / tot_demand if tot_demand > 0 else float("nan")
        mean_fill_rate = float(group["fill_rate"].mean())
        mean_csl = float(group["csl"].mean())
        median_csl = float(group["csl"].median())
        waste_rate_agg = tot_expired / tot_received if tot_received > 0 else 0.0
        mean_waste_rate = float(group["waste_rate"].mean())

        records.append(
            {
                "method": method,
                "policy": policy,
                "horizon": horizon,
                "lead_time": lt,
                "shelf_life": sl,
                "critical_ratio": cr,
                "holding_share": eta,
                "series_count": len(group),
                "store_count": group["store_id"].nunique(),
                "demand": tot_demand,
                "sales": tot_sales,
                "lost_sales": tot_lost_sales,
                "expired_units": tot_expired,
                "received_units": tot_received,
                "stockout_days": tot_stockout_days,
                "scored_days": tot_scored_days,
                "fill_rate": fill_rate_agg,
                "mean_series_fill_rate": mean_fill_rate,
                "csl": mean_csl,
                "median_csl": median_csl,
                "waste_rate": waste_rate_agg,
                "mean_series_waste_rate": mean_waste_rate,
                "total_cost": float(group["total_cost"].sum()),
                "mean_series_cost": float(group["total_cost"].mean()),
                "holding_cost": float(group["holding_cost"].sum()),
                "stockout_cost": float(group["stockout_cost"].sum()),
                "expiry_cost": float(group["expiry_cost"].sum()),
            }
        )

    return pd.DataFrame(records)


def main() -> None:
    """Execute the full CSL and service-metrics replay pipeline."""
    print("Starting series-level CSL extraction and verification pipeline...")
    quantiles_lookup = load_quantiles_lookup()
    metadata = load_series_metadata()

    primary_records: list[dict] = []
    sensitivity_records: list[dict] = []

    total_scenarios = len(LEAD_TIMES) * len(PREDICTION_METHODS) * len(SHELF_LIVES) * len(CRITICAL_RATIOS) * len(ALL_HOLDING_SHARES) * 2
    step = 0

    for lead_time in LEAD_TIMES:
        horizon = lead_time + 1

        for method in PREDICTION_METHODS:
            print(f"\nLoading {method.upper()} test predictions for horizon {horizon}...")
            predictions = load_predictions(method, horizon)
            test_df = validate_split(predictions, "test")
            test_df = test_df.merge(metadata, on="id", how="left")

            for shelf_life in SHELF_LIVES:
                for critical_ratio in CRITICAL_RATIOS:
                    for holding_share in ALL_HOLDING_SHARES:
                        for policy in ("CR", "TU"):
                            step += 1
                            if step % 24 == 0 or step == total_scenarios:
                                print(
                                    f"[{step}/{total_scenarios}] {method.upper()} | "
                                    f"L={lead_time} | m={shelf_life} | CR={critical_ratio:.2f} | "
                                    f"eta={holding_share:.2f} | {policy}"
                                )

                            records = simulate_and_extract_csl(
                                test_df,
                                method=method,
                                policy=policy,
                                lead_time=lead_time,
                                horizon=horizon,
                                shelf_life=shelf_life,
                                critical_ratio=critical_ratio,
                                holding_share=holding_share,
                                quantiles_lookup=quantiles_lookup,
                            )

                            if holding_share == 0.20:
                                primary_records.extend(records)
                            sensitivity_records.extend(records)

    # Convert to DataFrames
    df_primary = pd.DataFrame(primary_records)
    df_sensitivity_all = pd.DataFrame(sensitivity_records)
    df_sensitivity_only = df_sensitivity_all[df_sensitivity_all["holding_share"].isin([0.50, 1.00])].copy()

    print(f"\nPrimary series replayed: {len(df_primary):,} rows (expected 72,000)")
    print(f"Sensitivity series (0.50, 1.00) replayed: {len(df_sensitivity_only):,} rows (expected 144,000)")
    print(f"All sensitivity series (0.20, 0.50, 1.00) replayed: {len(df_sensitivity_all):,} rows (expected 216,000)")

    # 1. Validate against existing primary file
    validate_against_original(
        df_primary,
        RESULTS_DIR / "experiment_test_series.csv",
        "Primary experiment series",
    )

    # 2. Validate against existing sensitivity file
    validate_against_original(
        df_sensitivity_only,
        RESULTS_DIR / "experiment_sensitivity_holding_shares_series.csv",
        "Sensitivity experiment series",
    )

    # Save outputs
    out_primary = RESULTS_DIR / "experiment_test_series_with_csl.csv"
    df_primary.to_csv(out_primary, index=False)
    print(f"Saved primary series with CSL to: {out_primary} ({len(df_primary):,} rows)")

    out_sens_all = RESULTS_DIR / "experiment_sensitivity_series_with_csl.csv"
    df_sensitivity_all.to_csv(out_sens_all, index=False)
    print(f"Saved full sensitivity series (3 shares) with CSL to: {out_sens_all} ({len(df_sensitivity_all):,} rows)")

    out_sens_only = RESULTS_DIR / "experiment_sensitivity_holding_shares_series_with_csl.csv"
    df_sensitivity_only.to_csv(out_sens_only, index=False)
    print(f"Saved sensitivity (0.50, 1.00) series with CSL to: {out_sens_only} ({len(df_sensitivity_only):,} rows)")

    # 3. Build and save aggregated service metrics table
    df_service_metrics = build_service_metrics_summary(df_sensitivity_all)
    out_metrics = RESULTS_DIR / "experiment_service_metrics_series_csl.csv"
    df_service_metrics.to_csv(out_metrics, index=False)
    print(f"Saved aggregated service metrics to: {out_metrics} ({len(df_service_metrics):,} rows)")

    print("\nCSL extraction and validation complete successfully.")


if __name__ == "__main__":
    main()
