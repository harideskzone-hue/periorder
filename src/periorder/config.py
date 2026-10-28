"""Configuration and cost calibration for the PeriOrder prototype."""

from dataclasses import dataclass
from typing import Final

# Temporal boundaries from the research specification.
TRAIN_START: Final[int] = 1
TRAIN_END: Final[int] = 1211
VALIDATION_START: Final[int] = 1212
VALIDATION_END: Final[int] = 1576
TEST_START: Final[int] = 1577
TEST_END: Final[int] = 1941

# Main experimental scenario grid.
LEAD_TIMES: Final[tuple[int, ...]] = (1, 2)
SHELF_LIVES: Final[tuple[int, ...]] = (2, 3, 5)
CRITICAL_RATIOS: Final[tuple[float, ...]] = (0.40, 0.50, 0.75)
HOLDING_SHARES: Final[tuple[float, ...]] = (0.20,)

# Demand-model and service-level configuration.
FORECAST_MODELS: Final[tuple[str, ...]] = ("SN", "MR", "NB", "QR")
SERVICE_POLICIES: Final[tuple[str, ...]] = ("CR", "TU")
TUNING_QUANTILES: Final[tuple[float, ...]] = (
    0.25, 0.30, 0.35, 0.40, 0.50, 0.60,
    0.70, 0.75, 0.80, 0.90, 0.95,
)

# Single-period analytic reference case.
REFERENCE_POISSON_LAMBDA: Final[float] = 5.0
REFERENCE_STOCKOUT_COST: Final[float] = 1.0
REFERENCE_EXPIRY_COST: Final[float] = 0.4


@dataclass(frozen=True)
class CostParameters:
    """Per-unit cost parameters for the inventory simulation."""

    stockout_cost: float
    holding_cost: float
    expiry_cost: float
    critical_ratio: float
    holding_share: float


def calibrate_costs(
    critical_ratio: float,
    holding_share: float = 0.20,
    stockout_cost: float = 1.0,
) -> CostParameters:
    """Calibrate holding and expiry costs from the critical ratio.

    The total overage cost is derived from:
        critical_ratio = stockout_cost / (stockout_cost + overage_cost)

    holding_share is the fraction of total overage cost assigned to
    holding; the remainder is assigned to expiry.
    """
    if not 0.0 < critical_ratio < 1.0:
        raise ValueError("critical_ratio must be strictly between 0 and 1.")
    if not 0.0 <= holding_share <= 1.0:
        raise ValueError("holding_share must be between 0 and 1.")
    if stockout_cost <= 0.0:
        raise ValueError("stockout_cost must be greater than zero.")

    overage_cost = stockout_cost * (1.0 - critical_ratio) / critical_ratio
    holding_cost = holding_share * overage_cost
    expiry_cost = (1.0 - holding_share) * overage_cost

    return CostParameters(
        stockout_cost=stockout_cost,
        holding_cost=holding_cost,
        expiry_cost=expiry_cost,
        critical_ratio=critical_ratio,
        holding_share=holding_share,
    )
