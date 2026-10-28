"""Leakage-safe protection-period forecasting data."""

import pandas as pd

from periorder.config import SPLITS


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
