import pytest
from scipy.stats import poisson

from periorder.config import (
    CRITICAL_RATIOS,
    FORECAST_MODELS,
    LEAD_TIMES,
    REFERENCE_EXPIRY_COST,
    REFERENCE_POISSON_LAMBDA,
    REFERENCE_STOCKOUT_COST,
    SERVICE_POLICIES,
    SHELF_LIVES,
    calibrate_costs,
)


@pytest.mark.parametrize(
    ("critical_ratio", "expected_holding", "expected_expiry"),
    [
        (0.40, 0.30, 1.20),
        (0.50, 0.20, 0.80),
        (0.75, 1.0 / 15.0, 4.0 / 15.0),
    ],
)
def test_cost_calibration(
    critical_ratio, expected_holding, expected_expiry
):
    costs = calibrate_costs(critical_ratio)

    assert costs.stockout_cost == pytest.approx(1.0)
    assert costs.holding_cost == pytest.approx(expected_holding)
    assert costs.expiry_cost == pytest.approx(expected_expiry)

    total_overage = costs.holding_cost + costs.expiry_cost
    recovered_ratio = costs.stockout_cost / (
        costs.stockout_cost + total_overage
    )
    assert recovered_ratio == pytest.approx(critical_ratio)


def test_invalid_critical_ratio_is_rejected():
    with pytest.raises(ValueError):
        calibrate_costs(0.0)

    with pytest.raises(ValueError):
        calibrate_costs(1.0)


def test_invalid_holding_share_is_rejected():
    with pytest.raises(ValueError):
        calibrate_costs(0.20, holding_share=-0.1)

    with pytest.raises(ValueError):
        calibrate_costs(0.20, holding_share=1.1)


def test_invalid_stockout_cost_is_rejected():
    with pytest.raises(ValueError):
        calibrate_costs(0.50, stockout_cost=0.0)


def test_single_period_newsvendor_reference():
    critical_ratio = REFERENCE_STOCKOUT_COST / (
        REFERENCE_STOCKOUT_COST + REFERENCE_EXPIRY_COST
    )

    optimal_stock = int(
        poisson.ppf(critical_ratio, REFERENCE_POISSON_LAMBDA)
    )

    assert optimal_stock == 6


def test_main_experiment_grid_dimensions():
    assert len(LEAD_TIMES) == 2
    assert len(SHELF_LIVES) == 3
    assert len(CRITICAL_RATIOS) == 3
    assert len(FORECAST_MODELS) == 4
    assert len(SERVICE_POLICIES) == 2

    assert (
        len(LEAD_TIMES)
        * len(SHELF_LIVES)
        * len(CRITICAL_RATIOS)
    ) == 18
