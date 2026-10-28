# Cost-Aware Perishable Grocery Inventory

Prototype based on the research paper:
Cost-Aware Ordering Policies for Perishable Grocery Inventory Using
Probabilistic Demand Forecasts.

## Objective

Use historical grocery sales from the M5 Forecasting Accuracy dataset
to evaluate probabilistic demand forecasts and cost-aware replenishment
policies for perishable inventory.

## Technology Stack

- Python 3.11
- pandas, NumPy, PyArrow
- scikit-learn, LightGBM, SciPy
- FastAPI
- Streamlit, Plotly
- pytest
- Docker Compose

## Project Structure

- data/raw: original datasets
- data/interim: intermediate datasets
- data/processed: validated processed datasets
- models: trained forecasting models
- results: experiment outputs
- src/periorder: core forecasting and inventory logic
- api: backend service
- dashboard: web interface
- scripts: data preparation and experiment commands
- tests: automated tests

## Current Status

Phase 0: environment setup completed.
Phase 0: project configuration in progress.

## Important Limitations

M5 recorded sales may not equal true customer demand.
Shelf life and inventory costs must be treated as assumptions unless
reliable product-specific values are available.
All experimental results must be generated and verified by running
the implementation.
