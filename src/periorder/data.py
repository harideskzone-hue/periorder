"""M5 data preparation, Syntetos-Boylan-Croston classification, and panel building."""

from collections.abc import Sequence
from pathlib import Path
from typing import Final

import numpy as np
import pandas as pd

from periorder.config import TRAIN_END

DEMAND_CLASSES: Final[tuple[str, ...]] = (
    "smooth",
    "erratic",
    "intermittent",
    "lumpy",
)


def classify_demand(y: Sequence[float | int] | np.ndarray) -> str:
    """Classify demand pattern using the Syntetos-Boylan-Croston (SBC) scheme.

    Thresholds:
        ADI < 1.32, CV^2 < 0.49  -> 'smooth'
        ADI < 1.32, CV^2 >= 0.49 -> 'erratic'
        ADI >= 1.32, CV^2 < 0.49 -> 'intermittent'
        ADI >= 1.32, CV^2 >= 0.49 -> 'lumpy'

    Convention:
        If fewer than 2 non-zero observations are present, return 'lumpy'.
    """
    arr = np.asarray(y, dtype=np.float64)
    nz = arr[arr > 0]
    if len(nz) < 2:
        return "lumpy"

    adi = len(arr) / len(nz)
    cv2 = float((np.std(nz, ddof=0) / np.mean(nz)) ** 2)

    if adi < 1.32:
        return "smooth" if cv2 < 0.49 else "erratic"
    return "intermittent" if cv2 < 0.49 else "lumpy"


def select_series(
    sales_df: pd.DataFrame,
    seed: int = 42,
    train_end: int = TRAIN_END,
    per_store_total: int = 50,
    per_class_min: int = 8,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Select a reproducible stratified sample of FOODS series across 10 stores.

    Classification and sampling are strictly based on training window days (d_1 to d_train_end)
    to prevent temporal leakage.

    Returns:
        tuple of (series_metadata, sample_counts_table)
    """
    foods_df = sales_df[sales_df["cat_id"] == "FOODS"].copy()
    if foods_df.empty:
        raise ValueError("No series found with cat_id == 'FOODS'.")

    train_day_cols = [f"d_{i}" for i in range(1, train_end + 1)]
    missing_cols = set(train_day_cols) - set(foods_df.columns)
    if missing_cols:
        raise ValueError(f"Missing required training day columns: {len(missing_cols)} missing.")

    # Classify on training data only
    train_matrix = foods_df[train_day_cols].to_numpy(dtype=np.float64)
    classes = [classify_demand(row) for row in train_matrix]
    foods_df["demand_class"] = classes
    foods_df["train_mean"] = train_matrix.mean(axis=1)

    rng = np.random.default_rng(seed)
    selected_indices: list[int] = []

    # Deterministic sorting before sampling ensures platform independence
    foods_df = foods_df.sort_values("id").reset_index(drop=True)

    stores = sorted(foods_df["store_id"].unique())
    for store in stores:
        store_mask = foods_df["store_id"] == store
        store_df = foods_df[store_mask]

        store_selected_indices: list[int] = []
        for cls in DEMAND_CLASSES:
            cls_indices = store_df[store_df["demand_class"] == cls].index.to_numpy()
            if len(cls_indices) < per_class_min:
                raise ValueError(
                    f"Store {store!r} has only {len(cls_indices)} series for class {cls!r}, "
                    f"which is less than the required minimum of {per_class_min}."
                )
            chosen = rng.choice(cls_indices, size=per_class_min, replace=False)
            store_selected_indices.extend(chosen.tolist())

        # Fill remaining slots from other unselected series in this store
        remaining_indices = np.setdiff1d(
            store_df.index.to_numpy(), store_selected_indices, assume_unique=True
        )
        needed = per_store_total - len(store_selected_indices)
        if needed > 0:
            if len(remaining_indices) < needed:
                raise ValueError(
                    f"Store {store!r} does not have enough remaining series to reach {per_store_total}."
                )
            fill_chosen = rng.choice(remaining_indices, size=needed, replace=False)
            store_selected_indices.extend(fill_chosen.tolist())

        selected_indices.extend(store_selected_indices)

    selected_meta = (
        foods_df.loc[
            selected_indices,
            ["id", "item_id", "dept_id", "cat_id", "store_id", "state_id", "demand_class", "train_mean"],
        ]
        .sort_values(["store_id", "id"])
        .reset_index(drop=True)
    )

    sample_counts = (
        pd.crosstab(
            selected_meta["store_id"],
            selected_meta["demand_class"],
            margins=True,
            margins_name="total",
        )
        .reset_index()
    )

    return selected_meta, sample_counts


def build_panel(
    sales_df: pd.DataFrame,
    calendar_df: pd.DataFrame,
    prices_df: pd.DataFrame,
    selected_meta: pd.DataFrame,
) -> pd.DataFrame:
    """Reshape selected series to daily panel format and attach calendar and price covariates.

    Running price mean is calculated strictly chronologically (expanding mean) within each
    item-store series to prevent future price leakage. Missing prices before launch are preserved.
    """
    selected_ids = set(selected_meta["id"])
    filtered_sales = sales_df[sales_df["id"].isin(selected_ids)].copy()

    # Identify daily sales columns d_1 to d_N
    id_vars = ["id", "item_id", "dept_id", "cat_id", "store_id", "state_id"]
    day_cols = [c for c in filtered_sales.columns if c.startswith("d_") and c[2:].isdigit()]
    day_cols.sort(key=lambda c: int(c[2:]))

    # Reshape from wide to long
    melted = filtered_sales.melt(
        id_vars=id_vars,
        value_vars=day_cols,
        var_name="d",
        value_name="sales",
    )
    melted["day"] = melted["d"].str[2:].astype(int)
    melted["sales"] = melted["sales"].astype(int)

    # Attach demand_class and train_mean
    meta_lookup = selected_meta[["id", "demand_class", "train_mean"]]
    melted = melted.merge(meta_lookup, on="id", how="left")

    # Attach calendar attributes
    cal_cols = [
        "d",
        "date",
        "wm_yr_wk",
        "weekday",
        "wday",
        "month",
        "year",
        "event_name_1",
        "event_type_1",
        "event_name_2",
        "event_type_2",
        "snap_CA",
        "snap_TX",
        "snap_WI",
    ]
    available_cal_cols = [c for c in cal_cols if c in calendar_df.columns]
    panel = melted.merge(calendar_df[available_cal_cols], on="d", how="left")

    # Vectorized state-specific SNAP flag
    panel["snap"] = 0
    for state in ("CA", "TX", "WI"):
        snap_col = f"snap_{state}"
        if snap_col in panel.columns:
            mask = panel["state_id"] == state
            panel.loc[mask, "snap"] = panel.loc[mask, snap_col].astype(int)

    # Attach sell_price
    price_cols = ["store_id", "item_id", "wm_yr_wk", "sell_price"]
    available_price_cols = [c for c in price_cols if c in prices_df.columns]
    panel = panel.merge(
        prices_df[available_price_cols],
        on=["store_id", "item_id", "wm_yr_wk"],
        how="left",
    )

    # Sort chronologically within each series before computing running price mean
    panel = panel.sort_values(["store_id", "item_id", "day"]).reset_index(drop=True)

    # Chronological expanding price mean (no future price leakage!)
    # pandas expanding().mean() ignores NaNs by default
    running_mean = (
        panel.groupby(["store_id", "item_id"])["sell_price"]
        .expanding()
        .mean()
        .reset_index(level=[0, 1], drop=True)
    )
    panel["running_mean_price"] = running_mean
    panel["price_relative_to_mean"] = panel["sell_price"] / panel["running_mean_price"]

    # Order columns cleanly
    lead_cols = [
        "id",
        "item_id",
        "dept_id",
        "cat_id",
        "store_id",
        "state_id",
        "demand_class",
        "day",
        "date",
        "wm_yr_wk",
        "weekday",
        "wday",
        "month",
        "year",
        "sales",
        "sell_price",
        "running_mean_price",
        "price_relative_to_mean",
        "snap",
        "event_name_1",
        "event_type_1",
    ]
    remaining_cols = [c for c in panel.columns if c not in lead_cols]
    final_cols = [c for c in lead_cols if c in panel.columns] + remaining_cols
    panel = panel[final_cols]

    return panel


def prepare_dataset(
    raw_dir: str | Path = "data/raw",
    processed_dir: str | Path = "data/processed",
    results_dir: str | Path = "results",
    seed: int = 42,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Execute the full data preparation pipeline and save Parquet outputs."""
    raw_path = Path(raw_dir)
    proc_path = Path(processed_dir)
    res_path = Path(results_dir)
    proc_path.mkdir(parents=True, exist_ok=True)
    res_path.mkdir(parents=True, exist_ok=True)

    print("Loading raw M5 datasets...")
    sales_df = pd.read_csv(raw_path / "sales_train_evaluation.csv")
    calendar_df = pd.read_csv(raw_path / "calendar.csv")
    prices_df = pd.read_csv(raw_path / "sell_prices.csv")

    print("Selecting 500 FOODS series across 10 stores (training window only)...")
    selected_meta, sample_counts = select_series(sales_df, seed=seed)

    # Save metadata and counts
    sample_counts.to_csv(res_path / "sample_counts.csv", index=False)
    selected_meta.to_parquet(proc_path / "series_meta.parquet", index=False)
    print(f"Saved series metadata and sample counts ({len(selected_meta)} series).")

    print("Building long-format daily panel with calendar and price covariates...")
    panel = build_panel(sales_df, calendar_df, prices_df, selected_meta)

    # Save monolithic panel.parquet
    panel.to_parquet(proc_path / "panel.parquet", index=False)
    print(f"Saved panel.parquet ({len(panel):,} rows).")

    # Save panel partitioned by store
    by_store_dir = proc_path / "panel_by_store"
    panel.to_parquet(by_store_dir, partition_cols=["store_id"], index=False)
    print(f"Saved store-partitioned panel in {by_store_dir}.")

    return panel, selected_meta
