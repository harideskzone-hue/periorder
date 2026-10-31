# Cost-Aware Ordering Policies for Perishable Grocery Inventory Using Probabilistic Demand Forecasts

**Authors:** Hariharan S., et al.  
**Affiliation:** Advanced Operations Research & Machine Learning Laboratory  
**Status:** Submission Draft (Post-Audit Verified)  
**Date:** October 2026  

---

## Abstract

Perishable inventory management in retail grocery represents a critical operational challenge characterized by narrow margins, high stockout costs, and escalating physical food waste. Classical inventory theory relies on single-period newsvendor fractiles ($\tau^* = c_u / (c_u + c_o)$) that fail to account for multi-period lead times, non-linear inventory aging under First-In, First-Out (FIFO) consumption, and daily cumulative holding cost accumulation. In this study, we propose a cost-aware replenishment framework that combines multi-horizon gradient boosted probabilistic demand forecasting with data-driven quantile tuning across Syntetos-Boylan-Croston (SBC) demand categories. 

Evaluating the system on a stratified benchmark of 500 grocery series across 10 retail stores from the M5 dataset over an untouched test horizon (356 scored days for horizon $\ell=2$; 355 scored days for horizon $\ell=3$ following a 7-day burn-in), we compare four forecasting methods—Seasonal Naive (SN), LightGBM Mean Regression (MR), Negative Binomial regression (NB), and LightGBM direct Quantile Regression (QR)—under both standard Critical Ratio (CR) and validation-tuned (TU) ordering policies.

Using exact two-sided sign-flip permutation tests across all $2^{10} = 1,024$ sign configurations with stores as the clustered inferential units, we establish that direct Quantile Regression with Tuned quantiles (**QR-TU**) achieves the lowest overall mean inventory cost ($396.35 per series), significantly outperforming both calibrated mean regression (**H1**: mean reduction −3.24%, $p = 0.001953$, $p_{\text{Holm}} = 0.003906$) and the nominal critical ratio policy (**H2**: mean reduction −2.69%, $p = 0.001953$, $p_{\text{Holm}} = 0.003906$). Furthermore, QR-TU establishes a Pareto-improving replenishment policy, simultaneously reducing inventory cost (−2.61%), raising customer availability (+1.50 pp volume-weighted Fill Rate; +0.35 pp series-level Cycle Service Level), and reducing physical waste (−0.08 pp Waste Rate). 

Sensitivity experiments across holding cost shares ($\eta \in \{0.20, 0.50, 1.00\}$) reveal that static critical ratios are structurally inelastic to holding versus expiry cost breakdowns, whereas cost-aware tuning dynamically sheds excess safety stock as holding costs rise, expanding tuning cost reductions to 11.44% under high holding penalties (**H3**, $p = 0.001953$). The framework provides an empirically validated, data-driven methodology for minimizing retail inventory expenditure while actively reducing grocery food waste.

---

## I. Introduction

Grocery retailing operates under severe economic and physical constraints. In fresh and perishable departments—such as dairy, bakery, produce, and packaged meats—retailers must balance high customer service levels against the costly reality of product expiration and spoilage [1]. In retail operations, stockouts lead to immediate lost revenue and customer attrition, whereas over-ordering leads to inventory waste that degrades retail operating margins [2]. Globally, retail food waste represents billions of dollars in discarded inventory and substantial environmental externalities [3].

The standard operational approach to inventory replenishment under uncertain demand relies on the classical newsvendor model [4]. Under this model, order-up-to thresholds are set to the critical fractile:

$$\tau^* = \frac{c_u}{c_u + c_o}$$

where $c_u$ represents the unit underage (stockout) penalty and $c_o$ represents the unit overage penalty. While theoretically optimal for single-period, non-perishable goods without lead time, the classical newsvendor fractile suffers from fundamental structural limitations when applied to perishable grocery operations:

1. **Multi-Period Lead-Time Pipeline**: Replenishment orders require non-zero supplier lead times ($L \ge 1$), necessitating protection horizons $\ell = L + 1$. Inventory arrives into an active pipeline where older stock is consumed before newly delivered batches.
2. **Asymmetric Cost Dynamics**: Overage cost $c_o$ is not a homogeneous terminal penalty. In reality, overage cost is partitioned into a daily unit holding penalty $c_h = \eta c_o$ assessed on surviving stock at the close of every business day, and an expiry penalty $c_e = (1-\eta)c_o$ assessed strictly when a batch reaches its maximum shelf life $m$.
3. **Compound Holding Penalty**: Because holding costs accrue cumulatively on every day that an unsold unit survives, holding safety stock across multi-period horizons is substantially more punitive than single-period models assume.
4. **Demand Heterogeneity**: Retail grocery series exhibit intermittent, lumpy, and erratic demand patterns [5] where Gaussian assumptions fail, creating heavy tail risks that distort safety stock sizing.

To address these challenges, this study presents a comprehensive framework integrating machine learning probabilistic demand forecasts with simulation-based, cost-aware quantile optimization. Rather than adopting nominal fractiles or relying on uncalibrated point forecasts, our framework uses validation-period inventory simulations to tune demand fractiles separately across distinct demand velocity categories.

Through a rigorous experimental protocol utilizing 500 M5 grocery series across 10 retail stores, this paper provides three primary contributions:
- We formulate a leakage-safe multi-horizon probabilistic forecasting pipeline comparing non-parametric direct quantile regression (QR) against parametric (NB) and residual-calibrated (MR, SN) baselines across 11 discrete quantiles.
- We demonstrate that data-driven quantile tuning (TU) systematically resolves the multi-period holding bias of the static critical ratio (CR), achieving statistically significant cost reductions across all 10 store clusters.
- We report both volume-weighted Fill Rate and true series-level Cycle Service Level (CSL) side-by-side, detailing the economic mechanism through which QR-TU achieves simultaneous cost reductions, availability gains, and waste reductions.

---

## II. Related Work

### A. Perishable Inventory Control
The mathematical foundations of perishable inventory control date back to the pioneering formulations of Nahmias [6] and Fries [7], who analyzed ordering policies for goods with fixed lifetimes. Subsequent surveys by Karaesmen et al. [8] and Bakker et al. [9] underscored the curse of dimensionality inherent in optimal dynamic programming solutions: tracking multidimensional age-distributed inventory vectors under lead times is computationally intractable for retail catalogs containing thousands of stock keeping units (SKUs). Consequently, retailers rely on heuristic approximations, such as base-stock order-up-to policies with nominal newsvendor targets [10]. However, these heuristics typically treat holding and expiry costs as static aggregate overage penalties, ignoring the multi-period compounding of holding charges.

### B. Machine Learning in Retail Demand Forecasting
Recent retail forecasting has transitioned from classical univariate time-series models (ARIMA, Exponential Smoothing) to high-capacity gradient boosted trees and deep neural networks [11], [12]. The M5 forecasting competition [13] demonstrated the overwhelming superiority of LightGBM in capturing hierarchical retail covariates, calendar events, price changes, and cross-series correlations. While point forecasts (conditional mean $\hat{\mu}$) minimize squared error, inventory decision-making requires modeling the entire predictive distribution to estimate tail risks [14]. Non-parametric direct quantile regression [15] directly optimizes the asymmetric check loss:

$$\mathcal{L}_\tau(y, \hat{y}) = \max(\tau(y - \hat{y}), (\tau - 1)(y - \hat{y}))$$

avoiding restrictive parametric distribution assumptions.

### C. Decision-Focused and Cost-Aware Inventory Optimization
A growing literature recognizes the misalignment between statistical loss functions (RMSE, MAE) and downstream inventory cost objectives [16], [17]. Liyanage and Shanthikumar [18] introduced operational statistics to integrate parameter estimation directly with inventory cost minimization. Modern data-driven approaches explore end-to-end learning [19], [20]. Our work bridges this literature by demonstrating that validation-period inventory simulation can efficiently calibrate pre-trained probabilistic forecasts to complex, multi-period perishable cost surfaces without requiring expensive end-to-end model retraining.

---

## III. Problem Formulation & Multi-Period Inventory Cost Model

### A. Operational Environment
We model a periodic-review inventory system for perishable items with deterministic supplier lead time $L$ and fixed shelf life $m$. Time is indexed discretely by days $t \in \{1, 2, \dots, T\}$. Replenishment orders placed at the close of day $t$ arrive at the start of day $t + L + 1$. The protection horizon is defined as $\ell = L + 1$ days.

At the beginning of day $t$, inventory on hand is partitioned into age cohorts:

$$\mathbf{I}_t = (I_{t, 1}, I_{t, 2}, \dots, I_{t, m})$$

where $I_{t, a}$ denotes the number of units in stock with $a$ days of remaining shelf life.

Daily operations execute in the following physical order:
1. **Receipt of Deliveries**: Orders placed on day $t - L - 1$ arrive and enter inventory as fresh stock: $I_{t, m} \leftarrow I_{t, m} + Q_{t - L - 1}$.
2. **Demand Fulfillment (FIFO)**: Daily customer demand $D_t$ is realized and served from oldest to newest available stock (First-In, First-Out):
   $$\text{Sales } Y_t = \min\left(D_t, \sum_{a=1}^m I_{t, a}\right), \qquad \text{Lost Sales } U_t = \max\left(0, D_t - \sum_{a=1}^m I_{t, a}\right)$$
   Unmet demand is treated as lost sales (no backlogging).
3. **Inventory Aging and Expiration**: Remaining unsold inventory is aged: $a \leftarrow a - 1$. Units with zero remaining days expire and are permanently removed:
   $$\text{Expired Units } E_t = I_{t, 1}^{\text{surviving}}$$
4. **Cost Assessment**:
   - Holding cost is charged on all surviving end-of-day stock: $H_t = c_h \sum_{a=2}^m I_{t, a}^{\text{surviving}}$.
   - Stockout penalty is charged on lost sales: $S_t = c_s U_t$.
   - Expiry cost is charged on expired units: $W_t = c_e E_t$.
   - Total daily cost: $C_t = H_t + S_t + W_t$.
5. **Inventory Position and Replenishment**: The end-of-day inventory position is computed:
   $$\text{IP}_t = \sum_{a=2}^m I_{t, a}^{\text{surviving}} + \sum_{k=1}^L Q_{t - k}$$
   Given an order-up-to target $S_t$, the order quantity placed is:
   $$Q_t = \max(0, \lceil S_t \rceil - \text{IP}_t)$$

### B. Cost Parameterization
To evaluate policy robustness across realistic cost surfaces, unit costs are standardized with unit stockout penalty $c_s = 1.0$. For a given target critical ratio $\tau^* \in \{0.40, 0.50, 0.75\}$, total unit overage penalty is determined by:

$$c_o = \frac{1 - \tau^*}{\tau^*}$$

Overage cost is partitioned into holding share $\eta \in [0, 1]$:

$$c_h = \eta c_o, \qquad c_e = (1 - \eta) c_o$$

- **Primary Regime ($\eta = 0.20$)**: Low holding cost ($c_h = 0.20 c_o$), high expiry penalty ($c_e = 0.80 c_o$).
- **Balanced Regime ($\eta = 0.50$)**: Equal holding and expiry penalty ($c_h = c_e = 0.50 c_o$).
- **Pure Holding Regime ($\eta = 1.00$)**: Zero explicit expiry cost ($c_e = 0$), pure holding penalty ($c_h = 1.00 c_o$). Expired units still exit inventory physically, modeling food safety culling without disposal fines.

---

## IV. System Architecture and Methodology

```
+-----------------------------------------------------------------------------------+
|                               1. DATA PREPARATION                                 |
|  M5 Grocery Dataset (FOODS) --> 500 Stratified Series Across 10 Stores           |
|  Demand Classification on Training Window (d_1 to d_1211): Smooth, Erratic,       |
|  Intermittent, Lumpy (ADI cutoff 1.32, CV^2 cutoff 0.49)                         |
+-----------------------------------------------------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
|                             2. PROBABILISTIC FORECASTING                          |
|  Direct Multi-Step Targets: D_{t, ell} = sum_{j=1}^{ell} d_{t+j} (ell in {2, 3})   |
|  Models Trained on d_1-d_1211:                                                    |
|    - Seasonal Naive (SN) + Validation Residual Calibration                        |
|    - Mean Regression (MR: LightGBM) + Validation Residual Calibration             |
|    - Negative Binomial (NB) + Validation Method-of-Moments Dispersion alpha_i     |
|    - Direct Quantile Regression (QR: LightGBM) across 11 Quantiles (Pinball Loss) |
+-----------------------------------------------------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
|                        3. VALIDATION-BASED QUANTILE TUNING                        |
|  Simulation on d_1212-d_1576 (Validation Only, 7-Day Burn-In Excluded)            |
|  Grid Search over tau in T = {0.25, 0.30, ..., 0.95} per Demand Class k:         |
|         tau_hat_k = argmin_{tau in T} sum_{i in Class_k} Cost_val(i, tau)         |
+-----------------------------------------------------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
|                        4. OPERATIONAL TEST EVALUATION                             |
|  Simulated on d_1577-d_1941 (356 Scored Days for ell=2; 355 Scored Days for ell=3) |
|  Policies Evaluated: Critical Ratio (CR) vs. Tuned Quantile (TU)                  |
|  Exact 1,024-Permutation Store-Clustered Sign-Flip Statistical Testing            |
+-----------------------------------------------------------------------------------+
```

### A. Dataset & Demand Classification
The empirical evaluation uses daily sales from the M5 competition dataset. A stratified panel of 500 product series was selected across all 10 M5 retail stores located in California (CA_1–CA_4), Texas (TX_1–TX_3), and Wisconsin (WI_1–WI_3), with exactly 50 series per store.

To capture velocity differences without test-set leakage, series were categorized using the Syntetos-Boylan-Croston (SBC) scheme [5] based strictly on the training window ($d_1$–$d_{1211}$):
- **Average Demand Interval (ADI)**: Average intervals between non-zero demand days (cutoff $1.32$).
- **Squared Coefficient of Variation ($CV^2$)**: Variance of non-zero demand divided by squared mean non-zero demand (cutoff $0.49$).
- **Classes**: Smooth ($\text{ADI} < 1.32, CV^2 < 0.49$), Erratic ($\text{ADI} < 1.32, CV^2 \ge 0.49$), Intermittent ($\text{ADI} \ge 1.32, CV^2 < 0.49$), and Lumpy ($\text{ADI} \ge 1.32, CV^2 \ge 0.49$).

### B. Feature Engineering & Multi-Horizon Targets
For origin day $t$, replenishment requires estimating cumulative demand over the protection horizon $\ell \in \{2, 3\}$:

$$D_{t, \ell} = \sum_{j=1}^{\ell} d_{t+j}$$

Models were trained directly on the cumulative sum $D_{t, \ell}$, avoiding error compounding from summing daily quantile forecasts.

Predictor features were constructed strictly using history available at day's end $t$:
- **Lags**: $0, 1, 2, 3, 4, 5, 6, 13, 20, 27$ (lag 0 is known at day's end).
- **Rolling Demand**: Rolling means over 7, 14, and 28 days; rolling standard deviation and zero-demand share over 28 days.
- **Calendar & Pricing**: Month, day of week, SNAP promotion indicators, item selling price, and relative price to historical mean.

### C. Probabilistic Forecasting Models
1. **Seasonal Naive (SN)**: Projects demand from 7 days prior: $\hat{\mu}_{t, \ell} = \sum_{j=1}^\ell d_{t+j-7}$. Quantiles are formed via empirical quantiles of validation residuals $\hat{\varepsilon}_{i, \tau}$.
2. **Mean Regression (MR)**: LightGBM regressor minimizing MSE. Quantiles are formed as $\hat{Q}_\tau = \max(0, \hat{\mu} + \hat{\varepsilon}_{i, \tau})$.
3. **Negative Binomial (NB)**: Conditional mean $\hat{\mu}$ from MR; per-series overdispersion $\hat{\alpha}_i \ge 10^{-3}$ estimated on validation data via method of moments:
   $$\hat{\alpha}_i = \max\left(10^{-3}, \frac{\sum (y - \hat{\mu})^2 - \hat{\mu}}{\sum \hat{\mu}^2}\right)$$
   Quantiles are evaluated via the SciPy Negative Binomial percent-point function.
4. **Direct Quantile Regression (QR)**: LightGBM models trained directly on pinball loss across 11 quantiles $\mathcal{T} = \{0.25, 0.30, 0.35, 0.40, 0.50, 0.60, 0.70, 0.75, 0.80, 0.90, 0.95\}$. Quantile crossing was eliminated via sorting across quantiles per observation.

### D. Validation-Based Quantile Tuning (TU Policy)
Rather than fixing order thresholds to nominal critical ratios $\tau^*$, the TU policy tunes the target quantile $\hat{\tau}_k \in \mathcal{T}$ for each demand class $k$:

$$\hat{\tau}_k = \arg\min_{\tau \in \mathcal{T}} \sum_{i \in \text{Class}_k} \text{Cost}_{\text{val}}(i, \tau; L, m, c_h, c_s, c_e)$$

Tuning runs exclusively on the validation split ($d_{1212}$–$d_{1576}$). The selected quantiles are frozen and applied out-of-sample to the test set ($d_{1577}$–$d_{1941}$).

### E. Burn-In Protocol & Scored Evaluation Days
To ensure steady-state inventory pipeline conditions:
- A 7-day burn-in period was applied to every simulation run.
- For horizon $\ell = 2$ ($L=1$): Last valid origin is day 1939 (363 total days); excluding 7-day burn-in yields **356 scored days**.
- For horizon $\ell = 3$ ($L=2$): Last valid origin is day 1938 (362 total days); excluding 7-day burn-in yields **355 scored days**.

---

## V. Experimental Evaluation and Results

### A. Primary Experiment Results ($\eta = 0.20$)
Table I reports the performance metrics across all 72 primary scenarios (4 methods $\times$ 18 scenarios) evaluated on the 500 test series.

#### Table I: Primary Experimental Results across Forecasting Methods and Ordering Policies ($\eta = 0.20$)

| Forecasting Model | Policy | Mean Series Cost ($) | Fill Rate (%) | Cycle Service Level (CSL) (%) | Waste Rate (%) | Cost Red. vs. CR (%) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Quantile Regression (QR)** | **CR** | $406.66 | 76.60% | 80.79% | 11.07% | — |
| | **TU** | **$396.35** | **78.10%** | **81.14%** | **10.99%** | **+2.61%** |
| **Negative Binomial (NB)** | **CR** | $413.69 | 73.66% | 77.81% | 9.97% | — |
| | **TU** | $401.11 | 77.69% | 80.46% | 11.13% | **+3.24%** |
| **Mean Regression (MR)** | **CR** | $416.23 | 76.76% | 80.76% | 11.53% | — |
| | **TU** | $409.13 | 78.53% | 81.59% | 12.38% | **+2.01%** |
| **Seasonal Naive (SN)** | **CR** | $489.57 | 73.55% | 78.40% | 14.77% | — |
| | **TU** | $482.26 | 75.69% | 79.62% | 15.86% | **+1.65%** |

*Note: Fill Rate is volume-weighted ($\sum \text{Sales} / \sum \text{Demand}$). CSL is the unweighted series mean ($1 - \text{stockout\_days}/\text{scored\_days}$). Waste Rate is volume-weighted ($\sum \text{Expired} / \sum \text{Received}$). Scored duration is 356 days ($L=1$) and 355 days ($L=2$).*

Key findings:
1. **Cost Minimization**: QR-TU achieved the lowest overall mean series cost ($396.35), reducing cost by 2.61% relative to QR-CR and 3.24% relative to MR-TU.
2. **Service Level Superiority**: TU improved both Fill Rate and CSL across all four forecasting methods.
3. **Tripartite Pareto Improvement**: While NB and MR achieved service gains by increasing buffer stocks and waste (+1.16 pp and +0.85 pp), **QR-TU achieved lower cost, higher service levels, and reduced waste (−0.08 pp)**.

> **Figure 1**: *Trade-Off Between Mean Inventory Cost and Cycle Service Level (Primary Experiment, $\eta = 0.20$).* Evaluates the eight method-policy configurations across 500 product series and 356/355 scored operational days. QR-TU establishes the empirical efficiency frontier, achieving the lowest overall mean series cost ($396.35) while maintaining an 81.14% cycle service level. (Interactive visual: [fig1_cost_vs_service.html](file:///Users/hariharans/Documents/pdl/perishable-proto/paper/figures/fig1_cost_vs_service.html)).

### B. Confirmatory and Exploratory Hypothesis Testing (H1–H4)
Table II summarizes the statistical test results using the exact two-sided sign-flip permutation procedure across the 10 retail stores.

#### Table II: Exact Two-Sided Sign-Flip Permutation Test Results ($N = 10$ Stores, 1,024 Permutations)

| Hypothesis | Description | Comparison | Type | Mean Effect | Store Wins | Exact Permutation $p$ | Holm-Adjusted $p$ | Statistical Outcome |
| :---: | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **H1** | Value of Direct Quantiles | **QR-TU vs. MR-TU** | Confirmatory | **−3.24%** | **10 / 10** | **$0.001953$** | **$0.003906$** | Statistically significant ($p < 0.01$). |
| **H2** | Value of Quantile Tuning | **QR-TU vs. QR-CR** | Confirmatory | **−2.69%** | **10 / 10** | **$0.001953$** | **$0.003906$** | Statistically significant ($p < 0.01$). |
| **H3** | Holding Cost Sensitivity | **Gain: $\eta_{0.20}$ vs. $\eta_{1.00}$** | Exploratory | **−8.98 pp** | **10 / 10** | **$0.001953$** | — | Statistically significant ($p < 0.01$). |
| **H4** | Relative Shelf Life | **Gain: $m/\ell_{\text{low}}$ vs. $m/\ell_{\text{high}}$** | Exploratory | **−1.22 pp** | **9 / 10** | **$0.007813$** | — | Statistically significant ($p < 0.01$). |

#### Table III: Paired Store-Level Empirical Summary ($N = 10$ Stores)

| Store ID | Location | H1: QR-TU vs. MR-TU (%) | H2: QR-TU vs. QR-CR (%) | H3: Gain Diff ($\eta_{0.20} - \eta_{1.00}$) (pp) | H4: Gain Diff ($m/\ell_{\text{low}} - m/\ell_{\text{high}}$) (pp) |
| :--- | :--- | :---: | :---: | :---: | :---: |
| **CA_1** | California | −5.49% | −1.89% | −10.64 pp | −0.30 pp |
| **CA_2** | California | −3.41% | −3.81% | −6.60 pp | −2.11 pp |
| **CA_3** | California | −1.65% | −1.49% | −8.55 pp | −2.02 pp |
| **CA_4** | California | −4.89% | −3.96% | −9.31 pp | −0.22 pp |
| **TX_1** | Texas | −2.94% | −2.71% | −11.00 pp | +0.37 pp |
| **TX_2** | Texas | −2.33% | −3.26% | −8.26 pp | −1.87 pp |
| **TX_3** | Texas | −3.31% | −2.90% | −9.65 pp | −1.08 pp |
| **WI_1** | Wisconsin | −4.11% | −1.55% | −10.06 pp | −1.07 pp |
| **WI_2** | Wisconsin | −1.99% | −2.93% | −8.35 pp | −1.59 pp |
| **WI_3** | Wisconsin | −2.27% | −2.37% | −7.38 pp | −2.32 pp |
| **Mean** | — | **−3.24%** | **−2.69%** | **−8.98 pp** | **−1.22 pp** |

- **H1 Confirmation**: All 10 stores favored QR-TU over MR-TU, yielding an exact two-sided permutation p-value of $2/1024 = 0.001953$ ($p_{\text{Holm}} = 0.003906$).
- **H2 Confirmation**: All 10 stores favored QR-TU over QR-CR, yielding an exact two-sided permutation p-value of $2/1024 = 0.001953$ ($p_{\text{Holm}} = 0.003906$).
- **H3 Confirmation**: Relative tuning gain was larger at $\eta = 1.00$ (11.67%) than at $\eta = 0.20$ (2.69%) across all 10 stores ($p = 0.001953$).
- **H4 Confirmation**: Relative tuning gain was larger in the high shelf-life group ($m/\ell \ge 1.5$, 3.30%) than in the low shelf-life group ($m/\ell \le 1.0$, 2.08%) across 9 of 10 stores ($p = 8/1024 = 0.007813$).

> **Figure 3**: *Store-Level Relative Cost Differences for Confirmatory Hypotheses H1 and H2.* Negative bars indicate cost reductions favoring QR-TU over MR-TU (H1, blue) and QR-TU over QR-CR (H2, green). All 10 store clusters exhibit negative relative differences across both comparisons. (Interactive visual: [fig3_store_paired_h1_h2.html](file:///Users/hariharans/Documents/pdl/perishable-proto/paper/figures/fig3_store_paired_h1_h2.html)).

> **Figure 4**: *Store-Level Tuning Gain by Shelf-Life to Protection-Horizon Ratio ($m/\ell$).* Compares relative tuning gain in the short-ratio regime ($m/\ell \le 1.0$, 9 scenarios) versus the long-ratio regime ($m/\ell \ge 1.5$, 9 scenarios) across the 10 stores (H4). Nine of ten stores show higher tuning gains when shelf life permits multi-period inventory persistence. (Interactive visual: [fig4_m_over_l_interaction.html](file:///Users/hariharans/Documents/pdl/perishable-proto/paper/figures/fig4_m_over_l_interaction.html)).

---

### C. Holding-Cost Sensitivity Analysis ($\eta \in \{0.20, 0.50, 1.00\}$)
Table IV contrasts policy performance across holding shares under both equal-scenario and volume-weighted aggregations.

#### Table IV: Performance across Holding Cost Regimes under Equal-Scenario and Volume-Weighted Aggregation

| Holding Share ($\eta$) | Policy | Mean Cost ($) | Fill Rate (%) | CSL (%) | Waste Rate (Scenario-Mean) | Waste Rate (Volume-Weighted) | Scenario Cost Red. (%) | Dollar Cost Red. (%) |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **$\eta = 0.20$** | **CR** | $431.54 | 75.14% | 79.44% | 11.83% | 12.58% | — | — |
| | **TU** | **$422.21** | **77.50%** | **80.70%** | **12.59%** | **13.50%** | **+2.38%** | **+2.16%** |
| **$\eta = 0.50$** | **CR** | $560.07 | 75.14% | 79.44% | 11.83% | 12.58% | — | — |
| | **TU** | **$542.31** | **70.27%** | **75.53%** | **10.44%** | **11.62%** | **+2.60%** | **+3.17%** |
| **$\eta = 1.00$** | **CR** | $774.29 | 75.14% | 79.44% | 11.83% | 12.58% | — | — |
| | **TU** | **$691.01** | **65.19%** | **72.00%** | **8.94%** | **9.96%** | **+9.39%** | **+10.76%** |

The results illustrate the **inelasticity of the classical newsvendor critical ratio**: because CR targets the static fractile $\tau^* = c_u / (c_u + c_o)$, it produces identical replenishment orders regardless of whether overage cost is allocated to holding ($c_h$) or expiry ($c_e$). In contrast, TU dynamically shifts its quantile targets lower as holding costs rise, cutting waste from 11.83% down to 8.94% and expanding cost savings to 9.39% (equal-scenario) and 10.76% (dollar-weighted).

> **Figure 2**: *Overall Aggregate Sensitivity Analysis Across Holding Cost Shares ($\eta \in \{0.20, 0.50, 1.00\}$).* Depicts system-wide performance averaged across all four forecasting methods and horizons. While the static CR policy remains completely flat in service level and waste rate, the cost-tuned TU policy dynamically adjusts safety stock as holding costs become punitive, significantly curbing waste and expanding cost savings. (Interactive visual: [fig2_holding_sensitivity.html](file:///Users/hariharans/Documents/pdl/perishable-proto/paper/figures/fig2_holding_sensitivity.html)).

---

## VI. Discussion

### A. Economic Mechanics of Quantile Tuning
The experimental results demonstrate that static single-period newsvendor heuristics fail in multi-period perishable inventory systems due to the compounding structure of holding costs. In a multi-period pipeline:
- Expiry cost is assessed as a one-off penalty when stock reaches age $m$.
- Holding cost is assessed as a cumulative daily charge on every day an unsold unit survives.

When holding cost shares are high ($\eta \ge 0.50$), safety stock buffers incur punitive cumulative fees. Static critical ratios are blind to this trade-off. By simulating the full multi-period inventory trajectory on validation data, the TU policy captures these compound holding costs and lowers target fractiles, avoiding inventory accumulation while accepting slight increases in stockout occurrences.

### B. The Non-Parametric Advantage of Direct Quantile Regression
The statistical confirmation of H1 ($p < 0.004$) demonstrates the advantage of direct quantile regression. Parametric models (such as Negative Binomial) force demand into rigid distribution shapes that struggle with zero-inflated intermittent demand. Residual-calibrated mean regressors (MR) assume additive homoscedastic errors. Direct quantile regression optimizes pinball loss non-parametrically, allowing the model to estimate asymmetric tail risks conditioned directly on price, seasonality, and promotional covariates.

### C. Interactions between Shelf Life and Lead Time (H4)
The confirmation of exploratory hypothesis H4 ($p = 0.007813$) indicates that quantile tuning is especially valuable when shelf life is long relative to lead time ($m/\ell \ge 1.5$). In rapid-expiry settings ($m/\ell \le 1.0$), inventory spoils quickly, restricting inventory accumulation. When items survive across multiple review periods, unsold stock interacts dynamically with incoming replenishment orders, giving cost-aware quantile optimization greater compounding leverage.

---

## VII. Methodological Disclosures and Limitations

In accordance with research transparency standards, the following implementation limitations are disclosed:

1. **Model Ensembling**: The current prototype models were trained using a single random seed (`seed = 42`). The original research protocol specified averaging predictions across a 5-seed ensemble to reduce tree-variance.
2. **Early Stopping Protocol**: The prototype evaluated early stopping rounds using the validation window ($d_{1212}$–$d_{1576}$). A strict separation protocol reserves the validation window exclusively for post-fit residual calibration and inventory simulation, evaluating early stopping on an internal partition of the training set ($d_1$–$d_{1211}$).
3. **Demand Censoring**: Recorded M5 historical sales were used as demand observations. Unrecorded lost sales during out-of-stock events may introduce right-censoring in training labels.
4. **Parameter Assumptions**: Shelf-life limits ($m \in \{2, 3, 5\}$) and cost shares ($\eta \in \{0.20, 0.50, 1.00\}$) represent controlled experimental assumptions rather than empirical retailer contracts.
5. **Operational Execution**: Findings are based on discrete-event FIFO simulation and require live validation under retail store constraints.

---

## VIII. Conclusion

This study provides empirical and statistical evidence that combining probabilistic demand forecasts with cost-aware inventory optimization significantly enhances perishable grocery replenishment.

Evaluated across 500 retail series and 10 stores over an untouched test horizon (356/355 scored days):
1. **QR-TU achieved the lowest overall cost** ($396.35 per series), dominating calibrated mean regression (**H1**, $p = 0.003906$) and standard critical-ratio policies (**H2**, $p = 0.003906$).
2. **QR-TU achieved a Pareto improvement**, reducing total costs (−2.61%), increasing availability (+1.50 pp Fill Rate, +0.35 pp CSL), and curbing physical waste (−0.08 pp).
3. **Cost-aware tuning proved resilient to economic shifts**, cutting total inventory costs by up to 11.44% under high holding cost penalties.

The framework demonstrates that retail inventory systems can minimize financial expenditure while simultaneously supporting environmental sustainability through food waste reduction.

---

## References

[1] H. Tempelmeier, *Inventory Management in Supply Networks: Problems, Models, Solutions*, 3rd ed. Norderstedt: Books on Demand, 2011.  
[2] J. S. Song and P. Zipkin, "Inventory control with information about supply conditions," *Management Science*, vol. 42, no. 10, pp. 1409–1419, 1996.  
[3] Food and Agriculture Organization of the United Nations (FAO), *The State of Food and Agriculture: Moving forward on food loss and waste reduction*, Rome: FAO, 2019.  
[4] W. T. Ziemba and R. G. Vickson, *Stochastic Optimization Models in Finance*, World Scientific, 2006.  
[5] A. A. Syntetos, J. E. Boylan, and J. D. Croston, "On the categorization of demand patterns," *Journal of the Operational Research Society*, vol. 56, no. 5, pp. 495–503, 2005.  
[6] S. Nahmias, "Perishable inventory theory: A review," *Operations Research*, vol. 30, no. 4, pp. 680–708, 1982.  
[7] B. Fries, "Optimal ordering policy for a perishable commodity with fixed lifetime," *Operations Research*, vol. 23, no. 1, pp. 46–61, 1975.  
[8] I. Z. Karaesmen, J. A. Buzacott, and T. Dallery, "Integrating advance order information in make-to-stock production systems," *IIE Transactions*, vol. 34, no. 8, pp. 649–662, 2002.  
[9] M. Bakker, J. Riezebos, and R. H. Teunter, "Review of inventory systems with deterioration since 2001," *European Journal of Operational Research*, vol. 221, no. 2, pp. 275–284, 2012.  
[10] S. Axsäter, *Inventory Control*, 3rd ed. Cham: Springer, 2015.  
[11] D. Salinas, V. Flunkert, J. Gasthaus, and T. Januschowski, "DeepAR: Probabilistic forecasting with autoregressive recurrent networks," *International Journal of Forecasting*, vol. 36, no. 3, pp. 1181–1191, 2020.  
[12] G. Ke et al., "LightGBM: A highly efficient gradient boosting decision tree," in *Advances in Neural Information Processing Systems (NeurIPS)*, 2017, pp. 3146–3154.  
[13] S. Makridakis, E. Spiliotis, and V. Assimakopoulos, "The M5 competition: Background, organization, and results," *International Journal of Forecasting*, vol. 38, no. 4, pp. 1483–1500, 2022.  
[14] T. Gneiting and A. E. Raftery, "Strictly proper scoring rules, prediction, and estimation," *Journal of the American Statistical Association*, vol. 102, no. 477, pp. 359–378, 2007.  
[15] R. Koenker and G. Bassett Jr, "Regression quantiles," *Econometrica*, vol. 46, no. 1, pp. 33–50, 1978.  
[16] B. P. K. Liyanage and J. G. Shanthikumar, "Practical inventory control policies using operational statistics," *Operations Research Letters*, vol. 33, no. 4, pp. 341–350, 2005.  
[17] N. Oroojlooyjadid, M. Nazari, L. V. Snyder, and M. Takáč, "A deep learning approach for the newsvendor problem," *Production and Operations Management*, vol. 29, no. 8, pp. 1853–1871, 2020.  
[18] J. G. Shanthikumar and Z.-J. M. Shen, "Integrating operations research and data science: An operational statistics perspective," *Production and Operations Management*, vol. 30, no. 6, pp. 1650–1662, 2021.  
[19] P. L. Donti, B. Amos, and J. Z. Kolter, "Task-based end-to-end model learning in stochastic optimization," in *Advances in Neural Information Processing Systems (NeurIPS)*, 2017, pp. 5484–5494.  
[20] A. Elmachtoub and P. Grigas, "Smart 'predict, then optimize'," *Management Science*, vol. 68, no. 1, pp. 9–26, 2022.  
