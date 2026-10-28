"""Independent mathematical and deterministic simulator reference tests."""

import pytest
from scipy.stats import poisson

from periorder.config import CostParameters
from periorder.simulator import simulate_inventory


def test_hand_calculated_trace_for_lead_time_one_and_shelf_life_two():
    """Check arrivals, lost sales, expiry, and costs over four days."""
    costs = CostParameters(
        stockout_cost=1.0,
        holding_cost=0.2,
        expiry_cost=0.8,
        critical_ratio=0.5,
        holding_share=0.2,
    )

    result = simulate_inventory(
        demand=[1, 0, 1, 0],
        order_up_to=[2, 2, 1, 0],
        lead_time=1,
        shelf_life=2,
        costs=costs,
        initial_inventory=2,
    )

    day0, day1, day2, day3 = result.records

    # Day 0: sell one unit, retain one, then order one.
    assert (day0.sales, day0.lost_sales) == (1, 0)
    assert day0.ending_inventory == 1
    assert day0.order_quantity == 1
    assert day0.holding_cost == pytest.approx(0.2)

    # Day 1: the last remaining unit expires.
    # The order from day 0 is still in transit.
    assert day1.expired == 1
    assert day1.ending_inventory == 0
    assert day1.pipeline_inventory == 1
    assert day1.order_quantity == 1
    assert day1.expiry_cost == pytest.approx(0.8)

    # Day 2: the first order arrives and serves demand.
    assert day2.arrivals == 1
    assert day2.sales == 1
    assert day2.lost_sales == 0
    assert day2.order_quantity == 0

    # Day 3: the second order arrives and remains in stock.
    assert day3.arrivals == 1
    assert day3.ending_inventory == 1
    assert day3.expired == 0

    assert result.total_demand == 2
    assert result.total_sales == 2
    assert result.total_lost_sales == 0
    assert result.total_expired == 1
    assert result.total_cost == pytest.approx(1.2)


def test_fifo_serves_older_stock_before_newer_stock():
    """Older stock should be consumed first, protecting newer stock."""
    costs = CostParameters(
        stockout_cost=1.0,
        holding_cost=0.0,
        expiry_cost=0.4,
        critical_ratio=1.0 / 1.4,
        holding_share=0.0,
    )

    result = simulate_inventory(
        demand=[0, 1, 0, 0],
        order_up_to=[2, 1, 1, 1],
        lead_time=0,
        shelf_life=3,
        costs=costs,
        initial_inventory=1,
    )

    # The older initial unit is sold on day 1.
    # The newer delivered unit survives until the end of day 2,
    # then expires at the end of day 3.
    assert result.records[1].sales == 1
    assert result.records[2].expired == 0
    assert result.records[2].ending_inventory == 1
    assert result.records[3].expired == 1


def test_newsvendor_expected_cost_matches_exact_poisson_calculation():
    """Compare simulator costs with the Poisson newsvendor expectation."""
    demand_rate = 5.0
    stockout_cost = 1.0
    expiry_cost = 0.4
    critical_ratio = stockout_cost / (stockout_cost + expiry_cost)

    costs = CostParameters(
        stockout_cost=stockout_cost,
        holding_cost=0.0,
        expiry_cost=expiry_cost,
        critical_ratio=critical_ratio,
        holding_share=0.0,
    )

    # The Poisson tail beyond 100 is negligible at this demand rate.
    demand_values = range(101)
    probabilities = [
        float(poisson.pmf(d, demand_rate)) for d in demand_values
    ]

    expected_costs = {}

    for stock_level in range(11):
        simulated_expected_cost = 0.0
        analytical_expected_cost = 0.0

        for demand_value, probability in zip(demand_values, probabilities):
            result = simulate_inventory(
                demand=[demand_value],
                order_up_to=0,
                lead_time=0,
                shelf_life=1,
                costs=costs,
                initial_inventory=stock_level,
            )

            simulated_cost = result.total_cost
            analytical_cost = (
                stockout_cost * max(demand_value - stock_level, 0)
                + expiry_cost * max(stock_level - demand_value, 0)
            )

            simulated_expected_cost += probability * simulated_cost
            analytical_expected_cost += probability * analytical_cost

        assert simulated_expected_cost == pytest.approx(
            analytical_expected_cost, abs=1e-10
        )
        expected_costs[stock_level] = simulated_expected_cost

    best_stock_level = min(expected_costs, key=expected_costs.get)
    assert best_stock_level == 6


def test_poisson_reference_has_unique_minimum_at_six():
    """Check the discrete critical-ratio quantile independently."""
    critical_ratio = 1.0 / 1.4
    assert int(poisson.ppf(critical_ratio, 5.0)) == 6
