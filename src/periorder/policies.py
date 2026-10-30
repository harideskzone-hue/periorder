"""Inventory ordering policies."""

import numpy as np
import pandas as pd

from periorder.config import TUNING_QUANTILES, CostParameters
from periorder.data import DEMAND_CLASSES
from periorder.simulator import simulate_inventory


def critical_ratio_target(
    quantile_predictions: pd.DataFrame,
    critical_ratio: float,
) -> np.ndarray:
    """Select the demand quantile specified by the critical ratio.

    The input DataFrame must contain a column named q_{critical_ratio:.2f}.
    Predictions represent protection-period demand and become the
    order-up-to targets supplied to the inventory simulator.
    """
    if not 0.0 < critical_ratio < 1.0:
        raise ValueError("critical_ratio must be strictly between 0 and 1.")

    if quantile_predictions.empty:
        raise ValueError("quantile_predictions cannot be empty.")

    column = f"q_{critical_ratio:.2f}"

    if column not in quantile_predictions.columns:
        raise ValueError(
            f"Required quantile column {column!r} is missing."
        )

    values = quantile_predictions[column].to_numpy(dtype=float)

    if not np.isfinite(values).all():
        raise ValueError("Quantile predictions must be finite.")

    if (values < 0).any():
        raise ValueError("Demand predictions cannot be negative.")

    return values


def tune_quantile_by_class(
    validation_df: pd.DataFrame,
    *,
    lead_time: int,
    shelf_life: int,
    costs: CostParameters,
    burn_in_days: int = 0,
) -> tuple[dict[str, float], pd.DataFrame]:
    """Select the lowest-cost quantile for each demand class.

    validation_df must contain:
        id, day, sales, demand_class, q_0.25 ... q_0.95

    Returns:
        selected_quantiles: demand class -> selected quantile
        evaluation: cost for each class and candidate quantile
    """
    required = {
        "id",
        "day",
        "sales",
        "demand_class",
        *[f"q_{q:.2f}" for q in TUNING_QUANTILES],
    }
    missing = required - set(validation_df.columns)
    if missing:
        raise ValueError(f"Missing required columns: {sorted(missing)}")

    if (
        isinstance(burn_in_days, bool)
        or not isinstance(burn_in_days, int)
        or burn_in_days < 0
    ):
        raise ValueError("burn_in_days must be a non-negative integer.")

    if validation_df.empty:
        raise ValueError("validation_df cannot be empty.")

    if (
        "split" in validation_df.columns
        and not validation_df["split"].eq("validation").all()
    ):
        raise ValueError(
            "validation_df must contain only validation observations."
        )

    if validation_df["id"].isna().any():
        raise ValueError("Series IDs cannot be missing.")
    if validation_df["demand_class"].isna().any():
        raise ValueError("Demand classes cannot be missing.")
    if validation_df["day"].isna().any():
        raise ValueError("Day values cannot be missing.")

    if validation_df.duplicated(["id", "day"]).any():
        raise ValueError("Duplicate series/day observations found.")

    present_classes = set(validation_df["demand_class"].unique())
    missing_classes = set(DEMAND_CLASSES) - present_classes
    if missing_classes:
        raise ValueError(
            f"Missing demand classes in validation_df: {sorted(missing_classes)}"
        )

    unexpected_classes = present_classes - set(DEMAND_CLASSES)
    if unexpected_classes:
        raise ValueError(
            f"Unexpected demand classes in validation_df: {sorted(unexpected_classes)}"
        )

    sales = validation_df["sales"].to_numpy(dtype=float)
    if not np.isfinite(sales).all():
        raise ValueError("Sales values must be finite.")
    if (sales < 0).any():
        raise ValueError("Sales values cannot be negative.")
    if not np.equal(sales, np.floor(sales)).all():
        raise ValueError("Sales values must be integers.")

    for q in TUNING_QUANTILES:
        col = f"q_{q:.2f}"
        vals = validation_df[col].to_numpy(dtype=float)
        if not np.isfinite(vals).all():
            raise ValueError(f"Quantile predictions in column {col!r} must be finite.")
        if (vals < 0).any():
            raise ValueError(f"Quantile predictions in column {col!r} cannot be negative.")

    # Validate consecutive daily observations and pre-extract series data per demand class
    class_groups: dict[str, list[tuple[str, list[int], dict[float, np.ndarray]]]] = {
        c: [] for c in DEMAND_CLASSES
    }
    for series_id, group in validation_df.groupby("id", sort=False):
        group = group.sort_values("day")
        days = group["day"].to_numpy()
        if not np.isfinite(days.astype(float)).all():
            raise ValueError("Day values must be finite.")
        if not np.equal(
            days.astype(float),
            np.floor(days.astype(float)),
        ).all():
            raise ValueError("Day values must be integers.")
        if len(days) <= burn_in_days:
            raise ValueError(
                f"Series {series_id!r} has {len(days)} observations, "
                f"which must be strictly greater than burn_in_days={burn_in_days}."
            )
        if len(days) > 1 and not (np.diff(days) == 1).all():
            raise ValueError(
                f"Series {series_id!r} does not have consecutive daily observations."
            )
        classes = group["demand_class"].unique()
        if len(classes) != 1:
            raise ValueError(
                f"Series {series_id!r} has multiple demand classes: {classes.tolist()}."
            )

        c = str(group["demand_class"].iloc[0])
        demand = [int(v) for v in group["sales"]]
        q_targets = {
            q: group[f"q_{q:.2f}"].to_numpy(dtype=float)
            for q in TUNING_QUANTILES
        }
        class_groups[c].append((str(series_id), demand, q_targets))

    records: list[dict[str, float | str]] = []
    selected_quantiles: dict[str, float] = {}

    for c in DEMAND_CLASSES:
        best_cost = float("inf")
        best_q: float | None = None

        for q in TUNING_QUANTILES:
            total_class_cost = 0.0
            total_class_holding = 0.0
            total_class_stockout = 0.0
            total_class_expiry = 0.0

            for _series_id, demand, q_targets in class_groups[c]:
                res = simulate_inventory(
                    demand=demand,
                    order_up_to=q_targets[q],
                    lead_time=lead_time,
                    shelf_life=shelf_life,
                    costs=costs,
                    burn_in_days=burn_in_days,
                )
                total_class_cost += res.total_cost
                total_class_holding += res.total_holding_cost
                total_class_stockout += res.total_stockout_cost
                total_class_expiry += res.total_expiry_cost

            records.append({
                "demand_class": c,
                "quantile": q,
                "total_cost": total_class_cost,
                "cost": total_class_cost,
                "holding_cost": total_class_holding,
                "stockout_cost": total_class_stockout,
                "expiry_cost": total_class_expiry,
            })

            # Strictly less (<) breaks ties in favor of the earlier (lower) quantile
            if total_class_cost < best_cost:
                best_cost = total_class_cost
                best_q = q

        assert best_q is not None
        selected_quantiles[c] = float(best_q)

    evaluation = pd.DataFrame(records)
    return selected_quantiles, evaluation
