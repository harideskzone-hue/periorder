"""Paired store-level statistical analysis of TU versus CR ordering policies.

Unit of analysis: Store (10 M5 stores).
Evaluations:
- Paired percentage cost difference: 100 * (TU - CR) / CR
- Exact two-sided binomial sign test per scenario comparison
- Paired two-sided Wilcoxon signed-rank test
- Holm-Bonferroni family-wise error rate correction across 72 comparisons
- 95% paired bootstrap confidence intervals (resampling stores as clusters)
"""

from collections.abc import Sequence
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.stats import binomtest, wilcoxon

INPUT_PATH = Path("results/experiment_test_series.csv")
OUTPUT = Path("results")
N_BOOTSTRAP = 2000
RANDOM_STATE = 42

SCENARIO_COLUMNS = [
    "method",
    "horizon",
    "lead_time",
    "shelf_life",
    "critical_ratio",
    "holding_share",
]


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


def aggregate_paired_stores(series_df: pd.DataFrame) -> pd.DataFrame:
    """Aggregate individual series into paired store-level observations."""
    store_totals = (
        series_df.groupby(
            ["store_id", *SCENARIO_COLUMNS, "policy"],
            as_index=False,
        )
        .agg(
            total_cost=("total_cost", "sum"),
            demand=("demand", "sum"),
            sales=("sales", "sum"),
            lost_sales=("lost_sales", "sum"),
            expired_units=("expired_units", "sum"),
            holding_cost=("holding_cost", "sum"),
            stockout_cost=("stockout_cost", "sum"),
            expiry_cost=("expiry_cost", "sum"),
        )
    )
    store_totals["service_level"] = store_totals["sales"] / store_totals["demand"].where(
        store_totals["demand"].ne(0)
    )

    piv = store_totals.pivot_table(
        index=["store_id", *SCENARIO_COLUMNS],
        columns="policy",
        values=["total_cost", "demand", "sales", "lost_sales", "expired_units", "service_level"],
    ).reset_index()

    paired = pd.DataFrame({
        "store_id": piv["store_id"],
        "method": piv["method"],
        "horizon": piv["horizon"],
        "lead_time": piv["lead_time"],
        "shelf_life": piv["shelf_life"],
        "critical_ratio": piv["critical_ratio"],
        "holding_share": piv["holding_share"],
        "cr_total_cost": piv[("total_cost", "CR")],
        "tu_total_cost": piv[("total_cost", "TU")],
        "cr_demand": piv[("demand", "CR")],
        "tu_demand": piv[("demand", "TU")],
        "cr_sales": piv[("sales", "CR")],
        "tu_sales": piv[("sales", "TU")],
        "cr_service_level": piv[("service_level", "CR")],
        "tu_service_level": piv[("service_level", "TU")],
    })

    paired["cost_difference"] = paired["tu_total_cost"] - paired["cr_total_cost"]
    paired["cost_difference_pct"] = (
        paired["cost_difference"] / paired["cr_total_cost"] * 100.0
    )
    paired["service_difference"] = paired["tu_service_level"] - paired["cr_service_level"]

    return paired.sort_values([*SCENARIO_COLUMNS, "store_id"]).reset_index(drop=True)


def compute_comparison_statistics(paired: pd.DataFrame) -> pd.DataFrame:
    """Compute paired statistical tests and uncertainty across scenarios."""
    records: list[dict] = []

    for scenario_key, group in paired.groupby(SCENARIO_COLUMNS, sort=False):
        method, horizon, lead_time, shelf_life, critical_ratio, holding_share = scenario_key

        cost_diffs = group["cost_difference"].to_numpy(dtype=float)
        cost_diff_pcts = group["cost_difference_pct"].to_numpy(dtype=float)
        service_diffs = group["service_difference"].to_numpy(dtype=float)
        n_stores = len(cost_diffs)

        stores_tu_better = int(np.sum(cost_diffs < 0))
        stores_cr_better = int(np.sum(cost_diffs > 0))
        stores_tied = int(np.sum(cost_diffs == 0))

        # Exact two-sided binomial sign test
        non_tied = stores_tu_better + stores_cr_better
        if non_tied > 0:
            sign_res = binomtest(k=stores_tu_better, n=non_tied, p=0.5, alternative="two-sided")
            sign_p = float(sign_res.pvalue)
        else:
            sign_p = 1.0

        # Paired Wilcoxon signed-rank test
        if np.all(cost_diffs == 0):
            wilc_p = 1.0
        else:
            try:
                wilc_res = wilcoxon(
                    x=group["tu_total_cost"],
                    y=group["cr_total_cost"],
                    alternative="two-sided",
                )
                wilc_p = float(wilc_res.pvalue)
            except ValueError:
                wilc_p = 1.0

        # Bootstrap confidence interval for percentage cost difference
        ci_low, ci_high = bootstrap_ci(
            cost_diff_pcts,
            n_boot=N_BOOTSTRAP,
            alpha=0.05,
            seed=RANDOM_STATE,
        )

        records.append({
            "method": method,
            "horizon": horizon,
            "lead_time": lead_time,
            "shelf_life": shelf_life,
            "critical_ratio": critical_ratio,
            "holding_share": holding_share,
            "stores_count": n_stores,
            "stores_tu_better": stores_tu_better,
            "stores_cr_better": stores_cr_better,
            "stores_tied": stores_tied,
            "mean_cost_difference": float(np.mean(cost_diffs)),
            "mean_cost_difference_pct": float(np.mean(cost_diff_pcts)),
            "cost_difference_pct_ci95_low": ci_low,
            "cost_difference_pct_ci95_high": ci_high,
            "mean_service_difference": float(np.mean(service_diffs)),
            "sign_test_p": sign_p,
            "wilcoxon_p": wilc_p,
        })

    comp_df = pd.DataFrame(records)

    # Multiplicity adjustments across all 72 scenario comparisons
    comp_df["sign_test_p_holm"] = holm_adjust(comp_df["sign_test_p"])
    comp_df["sign_test_significant_05"] = comp_df["sign_test_p_holm"] < 0.05

    comp_df["wilcoxon_p_holm"] = holm_adjust(comp_df["wilcoxon_p"])
    comp_df["wilcoxon_significant_05"] = comp_df["wilcoxon_p_holm"] < 0.05

    return comp_df


def compute_method_summary(comparison: pd.DataFrame) -> pd.DataFrame:
    """Aggregate scenario statistics to forecast method summary."""
    summary = (
        comparison.groupby("method", as_index=False)
        .agg(
            scenarios_evaluated=("horizon", "count"),
            scenarios_tu_better=("mean_cost_difference", lambda x: int((x < 0).sum())),
            mean_cost_difference_pct=("mean_cost_difference_pct", "mean"),
            mean_cost_difference=("mean_cost_difference", "mean"),
            mean_service_difference=("mean_service_difference", "mean"),
            sign_test_significant_count=("sign_test_significant_05", "sum"),
            wilcoxon_significant_count=("wilcoxon_significant_05", "sum"),
        )
    )
    return summary


def main() -> None:
    """Run full paired statistical analysis across stores and scenarios."""
    if not INPUT_PATH.exists():
        raise FileNotFoundError(f"Input file not found: {INPUT_PATH}")

    series_df = pd.read_csv(INPUT_PATH)
    paired = aggregate_paired_stores(series_df)
    comparison = compute_comparison_statistics(paired)
    method_summary = compute_method_summary(comparison)

    OUTPUT.mkdir(parents=True, exist_ok=True)
    paired.to_csv(
        OUTPUT / "experiment_paired_store_results.csv",
        index=False,
    )
    comparison.to_csv(
        OUTPUT / "experiment_paired_statistics.csv",
        index=False,
    )
    method_summary.to_csv(
        OUTPUT / "experiment_method_statistics.csv",
        index=False,
    )

    print("\nPAIRED STORE-LEVEL STATISTICAL ANALYSIS")
    print("=" * 65)
    print("Stores per comparison:", paired["store_id"].nunique())
    print("Method-scenario comparisons:", len(comparison))
    print("Bootstrap repetitions:", N_BOOTSTRAP)

    print("\nMETHOD-LEVEL SUMMARY")
    print(method_summary.round(4).to_string(index=False))

    print("\nMULTIPLE-TESTING SUMMARY")
    print(
        "Sign test significant after Holm:",
        int(comparison["sign_test_significant_05"].sum()),
        "/ 72",
    )
    print(
        "Wilcoxon significant after Holm:",
        int(comparison["wilcoxon_significant_05"].sum()),
        "/ 72",
    )

    print("\nOUTPUT FILES")
    print("results/experiment_paired_store_results.csv")
    print("results/experiment_paired_statistics.csv")
    print("results/experiment_method_statistics.csv")


if __name__ == "__main__":
    main()
