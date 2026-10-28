"""Tests for M5 data preparation, SBC classification, and leakage guards."""

import pandas as pd
import pytest

from periorder.config import (
    TEST_END,
    TEST_START,
    TRAIN_END,
    TRAIN_START,
    VALIDATION_END,
    VALIDATION_START,
    split,
)
from periorder.data import build_panel, classify_demand, select_series


# 1. Correct ADI/CV^2 classification at threshold boundaries
def test_sbc_classification_thresholds():
    # Edge case: fewer than 2 nonzero observations
    assert classify_demand([0, 0, 5, 0]) == "lumpy"
    assert classify_demand([0, 0, 0, 0]) == "lumpy"

    # Smooth: constant non-zero demand -> ADI = 1.0 < 1.32, CV^2 = 0.0 < 0.49
    assert classify_demand([2, 2, 2, 2, 2]) == "smooth"

    # Erratic: non-zero on all days (ADI = 1.0 < 1.32), but high variance (CV^2 >= 0.49)
    # E.g. [1, 10, 1, 10] -> mean=5.5, std=4.5, CV^2 = (4.5/5.5)^2 = 0.669 >= 0.49
    assert classify_demand([1, 10, 1, 10, 1, 10]) == "erratic"

    # Intermittent: zero every other day (ADI = 2.0 >= 1.32), but constant non-zero demand (CV^2 = 0.0 < 0.49)
    assert classify_demand([2, 0, 2, 0, 2, 0, 2, 0]) == "intermittent"

    # Lumpy: zero every other day (ADI = 2.0 >= 1.32) and high variance (CV^2 >= 0.49)
    assert classify_demand([1, 0, 10, 0, 1, 0, 10, 0]) == "lumpy"


# Helper to generate a minimal synthetic sales dataframe for 2 stores
def _create_mock_sales_df(n_per_class: int = 10, stores: tuple[str, ...] = ("CA_1", "CA_2")):
    rows = []
    classes_patterns = {
        "smooth": [2] * 20,
        "erratic": [1, 10] * 10,
        "intermittent": [2, 0] * 10,
        "lumpy": [1, 0, 10, 0] * 5,
    }

    for store in stores:
        for cls, pattern in classes_patterns.items():
            for i in range(n_per_class):
                item_id = f"FOODS_1_{cls}_{i:03d}"
                row = {
                    "id": f"{item_id}_{store}_evaluation",
                    "item_id": item_id,
                    "dept_id": "FOODS_1",
                    "cat_id": "FOODS",
                    "store_id": store,
                    "state_id": store.split("_")[0],
                }
                # Fill training columns d_1 to d_1211 by repeating the pattern
                full_seq = (pattern * ((TRAIN_END // len(pattern)) + 2))[:TRAIN_END]
                for d_idx, val in enumerate(full_seq, start=1):
                    row[f"d_{d_idx}"] = val
                # Add validation and test columns
                for d_idx in range(TRAIN_END + 1, TEST_END + 1):
                    row[f"d_{d_idx}"] = 5
                rows.append(row)

    return pd.DataFrame(rows)


# 2, 3, 4. Reproducible selection, 50 series per store, and at least 8 per class
def test_select_series_reproducibility_and_quotas():
    # 4 classes * 15 items = 60 items per store
    mock_df = _create_mock_sales_df(n_per_class=15, stores=("CA_1", "TX_1"))

    meta1, counts1 = select_series(mock_df, seed=42, per_store_total=50, per_class_min=8)
    meta2, counts2 = select_series(mock_df, seed=42, per_store_total=50, per_class_min=8)

    # Reproducibility with seed 42
    pd.testing.assert_frame_equal(meta1, meta2)
    pd.testing.assert_frame_equal(counts1, counts2)

    # Exactly 50 unique series per store
    assert len(meta1) == 100
    for store in ("CA_1", "TX_1"):
        store_items = meta1[meta1["store_id"] == store]
        assert len(store_items) == 50
        assert store_items["id"].nunique() == 50

        # At least 8 per class per store
        class_counts = store_items["demand_class"].value_counts()
        for cls in ("smooth", "erratic", "intermittent", "lumpy"):
            assert class_counts.get(cls, 0) >= 8


# 5. No series selection based on validation or test demand (leakage guard)
def test_selection_ignores_validation_and_test_data():
    mock_df_a = _create_mock_sales_df(n_per_class=15, stores=("CA_1",))
    mock_df_b = mock_df_a.copy()

    # Alter validation and test days drastically in copy B
    val_test_cols = [f"d_{i}" for i in range(TRAIN_END + 1, TEST_END + 1)]
    mock_df_b[val_test_cols] = 999

    meta_a, _ = select_series(mock_df_a, seed=42, per_store_total=50, per_class_min=8)
    meta_b, _ = select_series(mock_df_b, seed=42, per_store_total=50, per_class_min=8)

    # Selection must remain 100% identical
    pd.testing.assert_frame_equal(meta_a, meta_b)


# 6. Correct train, validation and test day boundaries
def test_split_boundaries_and_day_counts():
    assert TRAIN_START == 1
    assert TRAIN_END == 1211
    assert (TRAIN_END - TRAIN_START + 1) == 1211

    assert VALIDATION_START == 1212
    assert VALIDATION_END == 1576
    assert (VALIDATION_END - VALIDATION_START + 1) == 365

    assert TEST_START == 1577
    assert TEST_END == 1941
    assert (TEST_END - TEST_START + 1) == 365

    # Test split helper
    dummy_panel = pd.DataFrame({"day": list(range(1, 1942)), "val": list(range(1, 1942))})

    train_split = split(dummy_panel, "train")
    assert len(train_split) == 1211
    assert train_split["day"].min() == 1
    assert train_split["day"].max() == 1211

    val_split = split(dummy_panel, "validation")
    assert len(val_split) == 365
    assert val_split["day"].min() == 1212
    assert val_split["day"].max() == 1576

    test_split = split(dummy_panel, "test")
    assert len(test_split) == 365
    assert test_split["day"].min() == 1577
    assert test_split["day"].max() == 1941


# 7. Rejection of invalid split name or missing day column
def test_split_helper_validation():
    dummy = pd.DataFrame({"day": [1, 2, 3]})
    with pytest.raises(ValueError, match="Unknown split 'invalid'"):
        split(dummy, "invalid")

    dummy_no_day = pd.DataFrame({"time": [1, 2, 3]})
    with pytest.raises(ValueError, match="Missing day column"):
        split(dummy_no_day, "train")


# 8. No future-price leakage in the running price mean
def test_no_future_price_leakage():
    # Mini sales df
    sales = pd.DataFrame({
        "id": ["FOODS_1_001_CA_1_evaluation"],
        "item_id": ["FOODS_1_001"],
        "dept_id": ["FOODS_1"],
        "cat_id": ["FOODS"],
        "store_id": ["CA_1"],
        "state_id": ["CA"],
        "d_1": [1],
        "d_2": [2],
        "d_3": [3],
    })
    calendar = pd.DataFrame({
        "d": ["d_1", "d_2", "d_3"],
        "date": ["2011-01-29", "2011-01-30", "2011-01-31"],
        "wm_yr_wk": [11101, 11101, 11102],
        "weekday": ["Saturday", "Sunday", "Monday"],
        "wday": [1, 2, 3],
        "month": [1, 1, 1],
        "year": [2011, 2011, 2011],
        "snap_CA": [0, 0, 1],
    })
    meta = pd.DataFrame({
        "id": ["FOODS_1_001_CA_1_evaluation"],
        "demand_class": ["smooth"],
        "train_mean": [2.0],
    })

    # Run A: week 1 price is 2.0, week 2 price is 4.0
    prices_a = pd.DataFrame({
        "store_id": ["CA_1", "CA_1"],
        "item_id": ["FOODS_1_001", "FOODS_1_001"],
        "wm_yr_wk": [11101, 11102],
        "sell_price": [2.0, 4.0],
    })
    panel_a = build_panel(sales, calendar, prices_a, meta)

    # Run B: week 1 price is 2.0, week 2 price is 100.0 (drastic future price change!)
    prices_b = pd.DataFrame({
        "store_id": ["CA_1", "CA_1"],
        "item_id": ["FOODS_1_001", "FOODS_1_001"],
        "wm_yr_wk": [11101, 11102],
        "sell_price": [2.0, 100.0],
    })
    panel_b = build_panel(sales, calendar, prices_b, meta)

    # On days 1 and 2 (week 1), running price mean MUST BE IDENTICAL between Run A and Run B!
    assert panel_a.loc[panel_a["day"] == 1, "running_mean_price"].values[0] == pytest.approx(2.0)
    assert panel_b.loc[panel_b["day"] == 1, "running_mean_price"].values[0] == pytest.approx(2.0)

    assert panel_a.loc[panel_a["day"] == 2, "running_mean_price"].values[0] == pytest.approx(2.0)
    assert panel_b.loc[panel_b["day"] == 2, "running_mean_price"].values[0] == pytest.approx(2.0)

    # On day 3, running mean incorporates day 3 price
    # Run A day 3: mean(2.0, 2.0, 4.0) = 8.0 / 3 = 2.6667
    assert panel_a.loc[panel_a["day"] == 3, "running_mean_price"].values[0] == pytest.approx(8.0 / 3.0)
    # Run B day 3: mean(2.0, 2.0, 100.0) = 104.0 / 3 = 34.6667
    assert panel_b.loc[panel_b["day"] == 3, "running_mean_price"].values[0] == pytest.approx(104.0 / 3.0)
