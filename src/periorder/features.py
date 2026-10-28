"""Leakage-safe protection-period forecasting data."""

import pandas as pd

from periorder.config import SPLITS

MODEL_FEATURE_COLUMNS: list[str] = [
    "lag_0",
    "lag_1",
    "lag_2",
    "lag_3",
    "lag_4",
    "lag_5",
    "lag_6",
    "lag_13",
    "lag_20",
    "lag_27",
    "rolling_mean_7",
    "rolling_mean_14",
    "rolling_mean_28",
    "rolling_std_28",
    "rolling_zero_share_28",
    "month",
    "wday",
    "snap",
    "sell_price",
    "price_relative_to_mean",
    "price_missing",
    "has_event_1",
]


def select_model_features(df: pd.DataFrame | None = None) -> list[str]:
    """Return the list of model feature names available in df (or all feature names if df is None)."""
    if df is None:
        return list(MODEL_FEATURE_COLUMNS)
    return [col for col in MODEL_FEATURE_COLUMNS if col in df.columns]


def build_forecast_frame(
    panel: pd.DataFrame,
    horizon: int,
) -> pd.DataFrame:
    """Build labels and seasonal forecasts at end-of-day origins."""
    if horizon not in (2, 3):
        raise ValueError("horizon must be 2 or 3.")

    required = {"id", "day", "sales"}
    if not required.issubset(panel.columns):
        raise ValueError(f"Missing columns: {required - set(panel.columns)}")

    df = panel.copy()
    if df.duplicated(["id", "day"]).any():
        raise ValueError("Duplicate series-day records.")

    df = df.sort_values(["id", "day"]).reset_index(drop=True)

    if (df["sales"] < 0).any() or df["sales"].isna().any():
        raise ValueError("Invalid sales values.")

    grouped = df.groupby("id", sort=False)["sales"]

    # Target: demand on days t+1 through t+horizon.
    df["target"] = sum(
        grouped.shift(-j) for j in range(1, horizon + 1)
    )

    # Seasonal naive mean: demand 7 days prior for each horizon day.
    df["sn_mean"] = sum(
        grouped.shift(7 - j) for j in range(1, horizon + 1)
    )

    # Assign temporal split respecting the leakage guard (exclude origins crossing split boundary).
    df["split"] = None
    for split_name, (start, end) in SPLITS.items():
        # Origins whose target spans t+1..t+horizon must stay strictly within [start, end].
        mask = df["day"].between(start, end - horizon)
        df.loc[mask, "split"] = split_name

    return df


def add_demand_features(panel: pd.DataFrame) -> pd.DataFrame:
    """Add demand-history features without using future observations."""
    required = {"id", "day", "sales"}
    missing = required - set(panel.columns)
    if missing:
        raise ValueError(f"Missing required columns: {sorted(missing)}")

    df = panel.sort_values(["id", "day"]).copy()
    if df.duplicated(["id", "day"]).any():
        raise ValueError("Duplicate (id, day) rows are not allowed")

    grouped = df.groupby("id", sort=False)["sales"]

    # Current-day sales are known because replenishment occurs at day's end.
    for lag in (0, 1, 2, 3, 4, 5, 6, 13, 20, 27):
        df[f"lag_{lag}"] = grouped.shift(lag)

    # Shift first: rolling statistics exclude the current day's sales.
    past_sales = grouped.shift(1)
    past_grouped = past_sales.groupby(df["id"], sort=False)

    for window in (7, 14, 28):
        df[f"rolling_mean_{window}"] = past_grouped.transform(
            lambda values, w=window: values.rolling(
                window=w, min_periods=w
            ).mean()
        )

    df["rolling_std_28"] = past_grouped.transform(
        lambda values: values.rolling(
            window=28, min_periods=28
        ).std()
    )

    is_zero = (past_sales == 0).astype(float)
    zero_grouped = is_zero.groupby(df["id"], sort=False)
    df["rolling_zero_share_28"] = zero_grouped.transform(
        lambda values: values.rolling(
            window=28, min_periods=28
        ).mean()
    )

    # Price and calendar indicators if columns exist
    if "sell_price" in df.columns:
        df["price_missing"] = df["sell_price"].isna().astype(int)
    if "event_name_1" in df.columns:
        df["has_event_1"] = df["event_name_1"].notna().astype(int)

    return df
