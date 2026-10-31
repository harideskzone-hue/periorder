"""Pooled store-level statistical analysis of TU versus CR ordering policies.

This module averages paired performance across the 18 experimental scenarios
within each of the 10 stores, treating the scenario grid as a fixed benchmark
environment.

Design:
- Unit of analysis: Store (10 M5 stores).
- Sample: 10 paired store observations per forecasting method (4 comparisons total).
- Tests: Exact two-sided binomial sign test and paired Wilcoxon signed-rank test.
- Multiplicity: Holm-Bonferroni correction across the 4 forecast methods.
- Uncertainty: 95% paired bootstrap confidence intervals (resampling stores).
"""

from collections.abc import Sequence
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.stats import binomtest, wilcoxon

INPUT_PATH = Path("results/experiment_paired_store_results.csv")
OUTPUT = Path("results")
N_BOOTSTRAP = 2000
RANDOM_STATE = 42


def holm_adjust(p_values: Sequence[float]) -> np.ndarray:
    """Compute Holm-Bonferroni adjusted p-values."""
    p = np.asarray(p_values, dtype=float)
    n = len(p)
    if n == 0:
        return np.array([], dtype=float)

    order = np.argsort(p)
    ranks = np.empty_like(order)
    ranks[order] = np.arange(n)

    sorted_p = p[order]
    factors = n - np.arange(n)
    adjusted_sorted = sorted_p * factors
    adjusted_sorted = np.maximum.accumulate(adjusted_sorted)
    adjusted_sorted = np.clip(adjusted_sorted, 0.0, 1.0)

    return adjusted_sorted[ranks]


def bootstrap_ci(
    values: np.ndarray,
    n_boot: int = N_BOOTSTRAP,
    alpha: float = 0.05,
    seed: int = RANDOM_STATE,
) -> tuple[float, float]:
    """Calculate empirical bootstrap confidence interval for the mean."""
    n = len(values)
    if n == 0:
        return float("nan"), float("nan")

    rng = np.random.default_rng(seed)
    indices = rng.integers(0, n, size=(n_boot, n))
    boot_means = np.mean(values[indices], axis=1)

    low = float(np.percentile(boot_means, 100.0 * (alpha / 2.0)))
    high = float(np.percentile(boot_means, 100.0 * (1.0 - alpha / 2.0)))
    return low, high


def compute_pooled_store_results(paired_df: pd.DataFrame) -> pd.DataFrame:
    """Average scenario metrics within each store for each forecast method."""
    pooled = (
        paired_df.groupby(["method", "store_id"], as_index=False)
        .agg(
            scenarios_evaluated=("lead_time", "count"),
            mean_cost_difference_pct=("cost_difference_pct", "mean"),
            mean_cost_difference=("cost_difference", "mean"),
            mean_service_difference=("service_difference", "mean"),
            cr_total_cost=("cr_total_cost", "sum"),
            tu_total_cost=("tu_total_cost", "sum"),
            cr_sales=("cr_sales", "sum"),
            tu_sales=("tu_sales", "sum"),
            cr_demand=("cr_demand", "sum"),
            tu_demand=("tu_demand", "sum"),
        )
    )

    pooled["cumulative_cost_difference_pct"] = (
        (pooled["tu_total_cost"] - pooled["cr_total_cost"])
        / pooled["cr_total_cost"]
        * 100.0
    )
    pooled["cr_aggregate_service_level"] = pooled["cr_sales"] / pooled["cr_demand"]
    pooled["tu_aggregate_service_level"] = pooled["tu_sales"] / pooled["tu_demand"]
    pooled["aggregate_service_difference"] = (
        pooled["tu_aggregate_service_level"] - pooled["cr_aggregate_service_level"]
    )

    return pooled.sort_values(["method", "store_id"]).reset_index(drop=True)


def compute_pooled_method_statistics(pooled_df: pd.DataFrame) -> pd.DataFrame:
    """Run formal paired tests and Holm adjustment across the 4 forecast methods."""
    records: list[dict] = []

    for method, group in pooled_df.groupby("method", sort=False):
        cost_diff_pcts = group["mean_cost_diff_pct"].to_numpy(dtype=float) if "mean_cost_diff_pct" in group.columns else group["mean_cost_difference_pct"].to_numpy(dtype=float)
        cost_diffs = group["mean_cost_difference"].to_numpy(dtype=float)
        service_diffs = group["mean_service_difference"].to_numpy(dtype=float)

        n_stores = len(cost_diff_pcts)
        stores_tu_better = int(np.sum(cost_diff_pcts < 0))
        stores_cr_better = int(np.sum(cost_diff_pcts > 0))
        stores_tied = int(np.sum(cost_diff_pcts == 0))

        # Exact two-sided binomial sign test
        non_tied = stores_tu_better + stores_cr_better
        if non_tied > 0:
            sign_res = binomtest(k=stores_tu_better, n=non_tied, p=0.5, alternative="two-sided")
            sign_p = float(sign_res.pvalue)
        else:
            sign_p = 1.0

        # Paired two-sided Wilcoxon signed-rank test
        try:
            wilc_res = wilcoxon(cost_diff_pcts, alternative="two-sided")
            wilc_p = float(wilc_res.pvalue)
        except ValueError:
            wilc_p = 1.0

        ci_low, ci_high = bootstrap_ci(
            cost_diff_pcts,
            n_boot=N_BOOTSTRAP,
            alpha=0.05,
            seed=RANDOM_STATE,
        )

        records.append({
            "method": method,
            "stores_count": n_stores,
            "stores_tu_better": stores_tu_better,
            "stores_cr_better": stores_cr_better,
            "stores_tied": stores_tied,
            "mean_cost_difference_pct": float(np.mean(cost_diff_pcts)),
            "cost_difference_pct_ci95_low": ci_low,
            "cost_difference_pct_ci95_high": ci_high,
            "mean_cost_difference": float(np.mean(cost_diffs)),
            "mean_service_difference": float(np.mean(service_diffs)),
            "sign_test_p": sign_p,
            "wilcoxon_p": wilc_p,
        })

    comp_df = pd.DataFrame(records)

    # Holm-Bonferroni correction across the 4 methods
    comp_df["sign_test_p_holm"] = holm_adjust(comp_df["sign_test_p"])
    comp_df["sign_test_significant_05"] = comp_df["sign_test_p_holm"] < 0.05

    comp_df["wilcoxon_p_holm"] = holm_adjust(comp_df["wilcoxon_p"])
    comp_df["wilcoxon_significant_05"] = comp_df["wilcoxon_p_holm"] < 0.05

    return comp_df


def main() -> None:
    """Run pooled store analysis and save artifacts."""
    if not INPUT_PATH.exists():
        raise FileNotFoundError(f"Input file not found: {INPUT_PATH}")

    paired_df = pd.read_csv(INPUT_PATH)
    pooled_df = compute_pooled_store_results(paired_df)
    stats_df = compute_pooled_method_statistics(pooled_df)

    OUTPUT.mkdir(parents=True, exist_ok=True)
    pooled_path = OUTPUT / "experiment_pooled_store_results.csv"
    stats_path = OUTPUT / "experiment_pooled_statistics.csv"

    pooled_df.to_csv(pooled_path, index=False)
    stats_df.to_csv(stats_path, index=False)

    print("\nPOOLED STORE-LEVEL STATISTICAL ANALYSIS (18-SCENARIO BENCHMARK)")
    print("=" * 72)
    print("Stores per method:", pooled_df["store_id"].nunique())
    print("Forecasting methods evaluated:", len(stats_df))
    print("Bootstrap repetitions:", N_BOOTSTRAP)

    print("\nPOOLED METHOD-LEVEL INFERENTIAL STATISTICS")
    print(stats_df[[
        "method",
        "stores_tu_better",
        "mean_cost_difference_pct",
        "cost_difference_pct_ci95_low",
        "cost_difference_pct_ci95_high",
        "sign_test_p",
        "sign_test_p_holm",
        "sign_test_significant_05",
        "wilcoxon_p",
        "wilcoxon_p_holm",
        "wilcoxon_significant_05",
    ]].round(4).to_string(index=False))

    print("\nMULTIPLE-TESTING SUMMARY (HOLM CORRECTION ACROSS 4 METHODS)")
    print(
        "Sign test significant after Holm (alpha=0.05):",
        int(stats_df["sign_test_significant_05"].sum()),
        "/ 4",
    )
    print(
        "Wilcoxon significant after Holm (alpha=0.05):",
        int(stats_df["wilcoxon_significant_05"].sum()),
        "/ 4",
    )

    print("\nSAVED OUTPUT FILES")
    print(f"  {pooled_path} ({len(pooled_df)} rows)")
    print(f"  {stats_path} ({len(stats_df)} rows)")


if __name__ == "__main__":
    main()
