"""Tests for the Tuned Quantile inventory policy."""

import numpy as np
import pandas as pd
import pytest

from periorder.config import TUNING_QUANTILES, calibrate_costs
from periorder.data import DEMAND_CLASSES
from periorder.policies import tune_quantile_by_class


@pytest.fixture
def validation_data():
    rows = []
    for class_index, demand_class in enumerate(DEMAND_CLASSES):
        for day in range(1212, 1217):
            row = {
                "id": f"series_{class_index}",
                "day": day,
                "sales": 2,
                "demand_class": demand_class,
            }
            for q in TUNING_QUANTILES:
                row[f"q_{q:.2f}"] = 2.0
            rows.append(row)
    return pd.DataFrame(rows)


def test_tu_returns_one_quantile_per_class(validation_data):
    selected, evaluation = tune_quantile_by_class(
        validation_data,
        lead_time=1,
        shelf_life=2,
        costs=calibrate_costs(0.50),
    )
    assert set(selected) == set(DEMAND_CLASSES)
    assert len(evaluation) == len(DEMAND_CLASSES) * len(TUNING_QUANTILES)
    for quantile in selected.values():
        assert quantile in TUNING_QUANTILES


def test_tu_evaluates_every_candidate(validation_data):
    _, evaluation = tune_quantile_by_class(
        validation_data,
        lead_time=1,
        shelf_life=2,
        costs=calibrate_costs(0.50),
    )
    for demand_class in DEMAND_CLASSES:
        actual = evaluation.loc[
            evaluation["demand_class"] == demand_class,
            "quantile",
        ].tolist()
        assert actual == list(TUNING_QUANTILES)


def test_tu_selects_lowest_cost_quantile(validation_data):
    # For "smooth", configure quantile 0.60 to have target 4 (matching cumulative demand exactly)
    # while other quantiles have targets producing severe penalties
    df = validation_data.copy()
    smooth_mask = df["demand_class"] == "smooth"

    for q in TUNING_QUANTILES:
        # Default high order-up-to target produces high holding / expiry costs
        df.loc[smooth_mask, f"q_{q:.2f}"] = 20.0

    # Optimal target at tau=0.60
    df.loc[smooth_mask, "q_0.60"] = 4.0

    selected, evaluation = tune_quantile_by_class(
        df,
        lead_time=1,
        shelf_life=2,
        costs=calibrate_costs(0.50),
    )
    assert selected["smooth"] == 0.60
    smooth_eval = evaluation[evaluation["demand_class"] == "smooth"]
    min_cost = smooth_eval["total_cost"].min()
    best_row = smooth_eval.loc[smooth_eval["quantile"] == 0.60].iloc[0]
    assert best_row["total_cost"] == min_cost


def test_tu_tie_breaking_selects_lower_quantile(validation_data):
    # In validation_data, all candidate quantiles have identical targets (2.0)
    # Therefore all candidate quantiles yield identical simulation costs
    # Lower quantile (0.25) must win
    selected, _ = tune_quantile_by_class(
        validation_data,
        lead_time=1,
        shelf_life=2,
        costs=calibrate_costs(0.50),
    )
    for c in DEMAND_CLASSES:
        assert selected[c] == min(TUNING_QUANTILES)


def test_tu_handles_unsorted_day_input(validation_data):
    # Shuffle row order of validation_data
    rng = np.random.default_rng(42)
    shuffled_idx = rng.permutation(len(validation_data))
    shuffled_df = validation_data.iloc[shuffled_idx].reset_index(drop=True)

    selected_shuffled, _ = tune_quantile_by_class(
        shuffled_df,
        lead_time=1,
        shelf_life=2,
        costs=calibrate_costs(0.50),
    )
    selected_orig, _ = tune_quantile_by_class(
        validation_data,
        lead_time=1,
        shelf_life=2,
        costs=calibrate_costs(0.50),
    )
    assert selected_shuffled == selected_orig


def test_tu_rejects_missing_demand_class(validation_data):
    df = validation_data[validation_data["demand_class"] != "lumpy"].copy()
    with pytest.raises(ValueError, match="Missing demand classes"):
        tune_quantile_by_class(
            df,
            lead_time=1,
            shelf_life=2,
            costs=calibrate_costs(0.50),
        )


def test_tu_rejects_unexpected_demand_class(validation_data):
    df = validation_data.copy()
    df.loc[0, "demand_class"] = "exotic"
    with pytest.raises(ValueError, match="Unexpected demand classes"):
        tune_quantile_by_class(
            df,
            lead_time=1,
            shelf_life=2,
            costs=calibrate_costs(0.50),
        )


def test_tu_rejects_non_validation_split(validation_data):
    df = validation_data.copy()
    df["split"] = "train"
    with pytest.raises(ValueError, match="validation observations"):
        tune_quantile_by_class(
            df,
            lead_time=1,
            shelf_life=2,
            costs=calibrate_costs(0.50),
        )


def test_tu_rejects_fractional_sales(validation_data):
    df = validation_data.copy()
    df["sales"] = df["sales"].astype(float)
    df.loc[0, "sales"] = 2.5
    with pytest.raises(ValueError, match="Sales values must be integers"):
        tune_quantile_by_class(
            df,
            lead_time=1,
            shelf_life=2,
            costs=calibrate_costs(0.50),
        )


def test_tu_rejects_negative_sales(validation_data):
    df = validation_data.copy()
    df.loc[0, "sales"] = -1
    with pytest.raises(ValueError, match="Sales values cannot be negative"):
        tune_quantile_by_class(
            df,
            lead_time=1,
            shelf_life=2,
            costs=calibrate_costs(0.50),
        )


def test_tu_rejects_non_finite_sales(validation_data):
    df = validation_data.copy()
    df["sales"] = df["sales"].astype(float)
    df.loc[0, "sales"] = np.nan
    with pytest.raises(ValueError, match="Sales values must be finite"):
        tune_quantile_by_class(
            df,
            lead_time=1,
            shelf_life=2,
            costs=calibrate_costs(0.50),
        )


def test_tu_rejects_missing_metadata(validation_data):
    df = validation_data.copy()
    df.loc[0, "id"] = np.nan
    with pytest.raises(ValueError, match="Series IDs cannot be missing"):
        tune_quantile_by_class(
            df,
            lead_time=1,
            shelf_life=2,
            costs=calibrate_costs(0.50),
        )

    df_class = validation_data.copy()
    df_class.loc[0, "demand_class"] = np.nan
    with pytest.raises(ValueError, match="Demand classes cannot be missing"):
        tune_quantile_by_class(
            df_class,
            lead_time=1,
            shelf_life=2,
            costs=calibrate_costs(0.50),
        )

    df2 = validation_data.copy()
    df2.loc[0, "day"] = np.nan
    with pytest.raises(ValueError, match="Day values cannot be missing"):
        tune_quantile_by_class(
            df2,
            lead_time=1,
            shelf_life=2,
            costs=calibrate_costs(0.50),
        )


def test_tu_rejects_duplicate_series_day(validation_data):
    df = pd.concat([validation_data, validation_data.iloc[[0]]], ignore_index=True)
    with pytest.raises(ValueError, match="Duplicate series/day observations found"):
        tune_quantile_by_class(
            df,
            lead_time=1,
            shelf_life=2,
            costs=calibrate_costs(0.50),
        )


def test_tu_rejects_non_consecutive_days(validation_data):
    df = validation_data.copy()
    # Create gap for series_0: change day 1213 to 1218
    df.loc[(df["id"] == "series_0") & (df["day"] == 1213), "day"] = 1218
    with pytest.raises(ValueError, match="consecutive daily observations"):
        tune_quantile_by_class(
            df,
            lead_time=1,
            shelf_life=2,
            costs=calibrate_costs(0.50),
        )


def test_tu_rejects_invalid_quantile_predictions(validation_data):
    df = validation_data.copy()
    df.loc[0, "q_0.50"] = -1.0
    with pytest.raises(ValueError, match="cannot be negative"):
        tune_quantile_by_class(
            df,
            lead_time=1,
            shelf_life=2,
            costs=calibrate_costs(0.50),
        )

    df2 = validation_data.copy()
    df2.loc[0, "q_0.50"] = np.inf
    with pytest.raises(ValueError, match="must be finite"):
        tune_quantile_by_class(
            df2,
            lead_time=1,
            shelf_life=2,
            costs=calibrate_costs(0.50),
        )


def test_tu_rejects_empty_dataframe():
    df = pd.DataFrame(columns=["id", "day", "sales", "demand_class"] + [f"q_{q:.2f}" for q in TUNING_QUANTILES])
    with pytest.raises(ValueError, match="empty"):
        tune_quantile_by_class(
            df,
            lead_time=1,
            shelf_life=2,
            costs=calibrate_costs(0.50),
        )


def test_tu_supports_seven_day_burn_in():
    rows = []
    # 12 days total: 7 burn-in days + 5 scored days
    for class_index, demand_class in enumerate(DEMAND_CLASSES):
        for day in range(1212, 1224):  # 12 days
            row = {
                "id": f"series_{class_index}",
                "day": day,
                "sales": 2,
                "demand_class": demand_class,
            }
            for q in TUNING_QUANTILES:
                row[f"q_{q:.2f}"] = 2.0
            rows.append(row)
    df = pd.DataFrame(rows)

    selected, evaluation = tune_quantile_by_class(
        df,
        lead_time=1,
        shelf_life=2,
        costs=calibrate_costs(0.50),
        burn_in_days=7,
    )
    assert set(selected) == set(DEMAND_CLASSES)
    assert len(evaluation) == len(DEMAND_CLASSES) * len(TUNING_QUANTILES)


def test_tu_rejects_invalid_burn_in_parameters(validation_data):
    # Negative burn-in
    with pytest.raises(ValueError, match="burn_in_days"):
        tune_quantile_by_class(
            validation_data,
            lead_time=1,
            shelf_life=2,
            costs=calibrate_costs(0.50),
            burn_in_days=-1,
        )

    # Boolean burn-in
    with pytest.raises(ValueError, match="burn_in_days"):
        tune_quantile_by_class(
            validation_data,
            lead_time=1,
            shelf_life=2,
            costs=calibrate_costs(0.50),
            burn_in_days=True,
        )

    # Fractional burn-in
    with pytest.raises(ValueError, match="burn_in_days"):
        tune_quantile_by_class(
            validation_data,
            lead_time=1,
            shelf_life=2,
            costs=calibrate_costs(0.50),
            burn_in_days=3.5,
        )

    # validation_data fixture has 5 days (1212..1216).
    # burn_in_days >= 5 must be rejected
    with pytest.raises(ValueError, match="strictly greater than burn_in_days"):
        tune_quantile_by_class(
            validation_data,
            lead_time=1,
            shelf_life=2,
            costs=calibrate_costs(0.50),
            burn_in_days=5,
        )
