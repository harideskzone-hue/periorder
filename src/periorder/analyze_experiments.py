"""Comparative and store-level statistical analysis of Phase 6 experiment results."""

from pathlib import Path

import pandas as pd

RESULTS = Path("results")

series = pd.read_csv(RESULTS / "experiment_test_series.csv")
summary = pd.read_csv(RESULTS / "experiment_test_summary.csv")

scenario = [
    "lead_time",
    "shelf_life",
    "critical_ratio",
    "holding_share",
]

print("\n1. OVERALL COST BY FORECAST METHOD AND POLICY")
print(
    summary.groupby(["method", "policy"])
    .agg(
        mean_scenario_cost=("total_cost", "mean"),
        median_scenario_cost=("total_cost", "median"),
        mean_service_level=("service_level", "mean"),
    )
    .round(4)
    .to_string()
)

print("\n2. TU VS CR COST DIFFERENCE")
pivot = summary.pivot_table(
    index=["method", *scenario],
    columns="policy",
    values="total_cost",
)

pivot["cost_difference"] = pivot["TU"] - pivot["CR"]
pivot["cost_difference_pct"] = (
    pivot["cost_difference"] / pivot["CR"] * 100
)

print(
    pivot.groupby("method")
    .agg(
        mean_cost_difference_pct=("cost_difference_pct", "mean"),
        scenarios_tu_better=("cost_difference", lambda x: (x < 0).sum()),
        scenarios_tu_worse=("cost_difference", lambda x: (x > 0).sum()),
    )
    .round(3)
    .to_string()
)

print("\n3. BEST METHOD-POLICY FOR EACH SCENARIO")
best = summary.loc[
    summary.groupby(scenario)["total_cost"].idxmin()
].sort_values(scenario)

print(
    best[
        scenario + ["method", "policy", "total_cost", "service_level"]
    ].to_string(index=False)
)

print("\n4. STORE-LEVEL PAIRED TU VS CR COMPARISON")
store = (
    series.groupby(
        ["store_id", "method", "policy", *scenario],
        as_index=False,
    )
    .agg(
        total_cost=("total_cost", "sum"),
        demand=("demand", "sum"),
        sales=("sales", "sum"),
        lost_sales=("lost_sales", "sum"),
    )
)

store_pivot = store.pivot_table(
    index=["store_id", "method", *scenario],
    columns="policy",
    values="total_cost",
).reset_index()

store_pivot["cost_difference"] = (
    store_pivot["TU"] - store_pivot["CR"]
)

store_pivot["cost_difference_pct"] = (
    store_pivot["cost_difference"] / store_pivot["CR"] * 100
)

store_results = (
    store_pivot.groupby(["method", *scenario])
    .agg(
        stores_tu_better=("cost_difference", lambda x: (x < 0).sum()),
        mean_store_cost_difference=("cost_difference", "mean"),
        mean_store_cost_difference_pct=("cost_difference_pct", "mean"),
    )
    .reset_index()
)

store_results.to_csv(
    RESULTS / "experiment_store_comparison.csv",
    index=False,
)

print(store_results.head(20).round(3).to_string(index=False))

print("\n5. SAVING ANALYSIS OUTPUTS")
pivot.reset_index().to_csv(
    RESULTS / "experiment_tu_vs_cr.csv",
    index=False,
)

best.to_csv(
    RESULTS / "experiment_best_policy_by_scenario.csv",
    index=False,
)

print("Saved:")
print("results/experiment_tu_vs_cr.csv")
print("results/experiment_best_policy_by_scenario.csv")
print("results/experiment_store_comparison.csv")
