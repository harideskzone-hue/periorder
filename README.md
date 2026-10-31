# PeriOrder: Cost-Aware Perishable Grocery Inventory Analytics & Simulation

Research prototype and interactive analytics dashboard reproducing and extending:
*Cost-Aware Ordering Policies for Perishable Grocery Inventory Using Probabilistic Demand Forecasts*.

---

## 1. Project Overview

PeriOrder couples direct nonparametric probabilistic demand forecasting (LightGBM Quantile Regression) with validation-based order-up-to fractile tuning (TU) under FIFO inventory depletion, non-zero lead times ($L \in \{1, 2\}$), and finite shelf lives ($m \in \{2, 3, 5\}$).

### Confirmatory & Exploratory Hypotheses (Exact Sign-Flip Permutation Tests, $N=1,024$)
* **H1 (Confirmatory: QR-TU vs. MR-TU)**: Mean difference **−3.24%**, 10/10 stores favor QR-TU ($p = 0.001953$, $p_{\text{Holm}} = 0.003906$).
* **H2 (Confirmatory: QR-TU vs. QR-CR)**: Mean difference **−2.69%**, 10/10 stores favor QR-TU ($p = 0.001953$, $p_{\text{Holm}} = 0.003906$).
* **H3 (Exploratory: Tuning Gain at $\eta=0.20$ vs. $\eta=1.00$)**: Mean effect **−8.98 pp** ($2.69\%$ vs. $11.67\%$, $p = 0.001953$).
* **H4 (Exploratory: Tuning Gain by $m/\ell$ ratio)**: Mean effect **−1.22 pp** ($m/\ell \ge 1.5$ vs. $m/\ell \le 1.0$, $p = 0.007813$).

### Evaluation Horizon
* **Protection Horizon $\ell = 2$ ($L = 1$)**: 363 simulated days − 7-day burn-in = **356 scored operational days**.
* **Protection Horizon $\ell = 3$ ($L = 2$)**: 362 simulated days − 7-day burn-in = **355 scored operational days**.

---

## 2. Platform Architecture

```
perishable-proto/
├── api/                        # FastAPI REST API serving research data & live simulations
│   └── main.py
├── dashboard/                  # React + Vite + TypeScript + Tailwind CSS v3.4 Frontend
│   ├── src/
│   │   ├── components/         # 6 core research modules
│   │   │   ├── Header.tsx
│   │   │   ├── ExecutiveDashboard.tsx
│   │   │   ├── DemandForecasting.tsx
│   │   │   ├── InventoryMonitoring.tsx
│   │   │   ├── PolicyComparison.tsx
│   │   │   ├── SimulationLab.tsx
│   │   │   └── ResearchResults.tsx
│   │   ├── services/api.ts     # Type-safe API client
│   │   └── types/index.ts      # Data interfaces
├── paper/                      # Publication manuscript and Plotly figures
│   ├── MANUSCRIPT.md
│   └── figures/
├── results/                    # Validated experimental and statistical outputs
├── src/periorder/              # Core simulation and forecasting engine
│   ├── config.py
│   ├── data.py
│   ├── simulator.py
│   ├── policies.py
│   ├── run_experiments.py
│   ├── run_sensitivity_experiments.py
│   └── compute_series_csl.py
└── tests/                      # Automated test suite (87 tests, 100% pass)
```

---

## 3. Running Locally

### Prerequisites
* Python 3.11 with virtual environment in `.venv`
* Node.js (v18+) & npm

### 1. Launch FastAPI Backend
```bash
.venv/bin/uvicorn api.main:app --host 127.0.0.1 --port 8000
```
API Documentation is available at `http://127.0.0.1:8000/docs`.

### 2. Launch React Frontend
```bash
cd dashboard
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```
Open `http://127.0.0.1:5173` in your browser.

---

## 4. Test Suite & Validation
```bash
# Run 87 unit and integration tests
.venv/bin/pytest -q

# Run Ruff linter
.venv/bin/ruff check src/ api/

# Validate frontend TypeScript build
cd dashboard && npm run build
```
