import numpy as np
import pandas as pd
import pytest

from periorder.features import add_demand_features, select_model_features


def make_panel(days=40):
    return pd.DataFrame({
        "id": ["series_a"] * days,
        "day": np.arange(1, days + 1),
        "sales": np.arange(1, days + 1, dtype=float),
        "month": [1] * days,
        "wday": np.arange(days) % 7,
        "sell_price": [2.5] * days,
        "price_relative_to_mean": [1.0] * days,
    })


def test_lags_use_current_and_past_sales():
    result = add_demand_features(make_panel())
    row = result.loc[result["day"] == 30].iloc[0]
    assert row["lag_0"] == 30
    assert row["lag_1"] == 29
    assert row["lag_6"] == 24
    assert row["lag_13"] == 17


def test_rolling_mean_excludes_current_day():
    result = add_demand_features(make_panel())
    row = result.loc[result["day"] == 30].iloc[0]
    assert row["rolling_mean_7"] == pytest.approx(np.mean(range(23, 30)))


def test_features_do_not_cross_series_boundaries():
    panel = pd.concat(
        [
            make_panel(),
            make_panel().assign(id="series_b", sales=lambda df: df["sales"] + 100),
        ],
        ignore_index=True,
    )
    result = add_demand_features(panel)
    first_row_b = result.loc[
        (result["id"] == "series_b") & (result["day"] == 1)
    ].iloc[0]
    assert pd.isna(first_row_b["lag_1"])
    assert pd.isna(first_row_b["rolling_mean_7"])


def test_duplicate_series_day_is_rejected():
    panel = pd.concat(
        [make_panel(), make_panel().iloc[[0]]],
        ignore_index=True,
    )
    with pytest.raises(ValueError, match="Duplicate"):
        add_demand_features(panel)


def test_select_model_features():
    df = make_panel()
    features = select_model_features(df)
    assert isinstance(features, list)
    assert "month" in features
    assert "wday" in features
    all_features = select_model_features()
    assert "lag_0" in all_features
    assert "rolling_mean_7" in all_features
