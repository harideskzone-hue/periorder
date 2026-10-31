export type AppMode = 'store-manager' | 'research';

export type StoreManagerTab = 
  | 'home' 
  | 'inventory' 
  | 'bills'
  | 'sales-profit'
  | 'market-research'
  | 'orders' 
  | 'outlook' 
  | 'alerts'
  | 'suppliers'
  | 'settings'
  | 'reports'
  | 'pos';

export type ResearchTab = 
  | 'executive'
  | 'forecasting'
  | 'monitoring'
  | 'policy'
  | 'simulation'
  | 'research';

export type NavigationTab = StoreManagerTab | ResearchTab;

// --- Multi-Store & Tenant Types ---
export interface StoreInfo {
  store_id: string;
  tenant_id: string;
  store_name: string;
  location: string;
  currency?: string;
  pos_connected: boolean;
  pos_provider?: string | null;
  created_at?: string;
}

export interface StoresResponse {
  tenant_id: string;
  stores: StoreInfo[];
  total_stores: number;
}

// --- Store Manager Types ---
export interface AttentionItem {
  id: string;
  name: string;
  category: string;
  issue_type: string;
  urgency: 'high' | 'medium' | 'low';
  description: string;
  suggested_action: string;
  days_left: number;
  current_stock: number;
}

export interface StoreManagerOverview {
  greeting: string;
  store_id?: string;
  store_name?: string;
  location?: string;
  monitored_products: number;
  need_attention: number;
  orders_to_review: number;
  products_expiring_soon: number;
  business_performance: {
    days_without_stockouts_pct: number;
    customer_demand_fulfilled_pct: number;
    products_expired_pct: number;
    estimated_monthly_savings_usd: number;
  };
  urgent_attention_items: AttentionItem[];
  today_recommendation_summary: {
    title: string;
    description: string;
    total_units_suggested: number;
    estimated_order_value_usd: number;
  };
}

export interface StoreProduct {
  id: string;
  name: string;
  category: string;
  current_stock: number;
  expected_daily_demand: number;
  days_of_supply: number;
  days_remaining: number;
  supplier_lead_time: string;
  status: 'Low stock' | 'Expiring soon' | 'Sufficient' | 'Out of stock';
  action: 'Reorder' | 'Rotate' | 'None';
}

export interface SuggestedOrder {
  id: string;
  product_name: string;
  product_code: string;
  category: string;
  current_stock: number;
  expected_demand_3d: number;
  suggested_order_qty: number;
  unit_cost: number;
  estimated_cost: number;
  supplier_lead_time: string;
  reason: string;
  status: 'Recommended' | 'Approved' | 'Adjusted';
}

export interface DemandOutlookDay {
  day: string;
  expected_demand: number;
  range_low: number;
  range_high: number;
  status: string;
}

export interface FastMovingProduct {
  id: string;
  name: string;
  category: string;
  weekly_expected_units: number;
  momentum: string;
  reason: string;
}

export interface DemandOutlookResponse {
  summary: string;
  weekly_outlook: DemandOutlookDay[];
  recommended_focus: string;
  peak_day?: {
    day: string;
    expected_units: number;
    surge_pct: string;
  };
  tomorrow_forecast?: {
    day: string;
    expected_units: number;
    range_low: number;
    range_high: number;
  };
  weekly_total_units?: number;
  busy_days?: string[];
  fast_moving_products?: FastMovingProduct[];
  data_origin?: string;
}

export interface CategoryPerformanceItem {
  category: string;
  smart_cost: number;
  traditional_cost: number;
  savings: number;
  savings_pct: number;
  stockout_rate: number;
  waste_rate: number;
}

export interface StoreManagerReportsResponse {
  evaluation_horizon: {
    lead_time_1_scored_days: number;
    lead_time_2_scored_days: number;
    burn_in_days: number;
    total_products: number;
    total_stores: number;
  };
  headline_metrics: {
    days_without_stockouts_pct: number;
    days_without_stockouts_expl: string;
    demand_fulfilled_pct: number;
    demand_fulfilled_expl: string;
    stockout_rate_pct: number;
    stockout_rate_expl: string;
    spoilage_waste_pct: number;
    spoilage_waste_expl: string;
    empirical_cost_reduction_pct: number;
    empirical_cost_reduction_expl: string;
    estimated_monthly_savings_usd: number;
    estimated_monthly_savings_expl: string;
  };
  category_performance: CategoryPerformanceItem[];
  data_origin_notice: {
    verified_empirical_data: string;
    illustrative_data: string;
    disclaimer: string;
  };
}

export interface POSTransactionItem {
  product_id: string;
  quantity: number;
  unit_price: number;
}

export interface POSRecentTransaction {
  transaction_id: string;
  timestamp: string;
  total_amount: number;
  items: POSTransactionItem[];
  status: string;
}

export interface POSStatusResponse {
  tenant_id: string;
  store_id: string;
  store_name: string;
  pos_connected: boolean;
  pos_provider: string | null;
  total_transactions_ingested: number;
  last_sync_timestamp: string | null;
  status: 'active' | 'disconnected' | 'error';
  recent_transactions?: POSRecentTransaction[];
  failed_sync_count?: number;
  webhook_url?: string;
}

export interface TestWebhookPayload {
  transaction_id: string;
  tenant_id: string;
  store_id: string;
  items: POSTransactionItem[];
  total_amount: number;
}

// --- Research Types ---
export interface MethodBenchmark {
  method: string;
  policy: string;
  mean_cost: number;
  fill_rate: number;
  csl: number;
  waste_rate: number;
  holding_cost: number;
  stockout_cost: number;
  expiry_cost: number;
  total_cost: number;
}

export interface ExecutiveKPIs {
  best_configuration: string;
  best_mean_cost: number;
  best_fill_rate: number;
  best_csl: number;
  best_waste_rate: number;
  h1_qr_vs_mr_gain: number;
  h2_tu_vs_cr_gain: number;
  total_series: number;
  total_stores: number;
  scored_days_l2: number;
  scored_days_l3: number;
}

export interface ExecutiveSummaryResponse {
  kpis: ExecutiveKPIs;
  configurations: MethodBenchmark[];
}

export interface ForecastModelInfo {
  name: string;
  type: string;
  features: string;
  pinball_loss_l2?: number;
  pinball_loss_l3?: number;
  mae_l2?: number;
  mae_l3?: number;
  nll_l2?: number;
  nll_l3?: number;
  role: string;
}

export interface SampleSeries {
  id: string;
  class: string;
  store: string;
  item: string;
}

export interface ForecastingOverview {
  models: ForecastModelInfo[];
  sample_series: SampleSeries[];
  quantiles: number[];
}

export interface ForecastRecord {
  day: number;
  actual: number;
  target: number;
  'q_0.25': number;
  'q_0.50': number;
  'q_0.75': number;
  'q_0.90': number;
  'q_0.95': number;
}

export interface ForecastSeriesResponse {
  series_id: string;
  method: string;
  horizon: number;
  records: ForecastRecord[];
}

export interface InventoryTrajectoryPoint {
  day: number;
  demand: number;
  sales: number;
  lost_sales: number;
  arrivals: number;
  ending_inventory: number;
  expired_units: number;
  pipeline_inventory: number;
  order_quantity: number;
  holding_cost: number;
  stockout_cost: number;
  expiry_cost: number;
  total_cost: number;
}

export interface InventoryTrajectoryResponse {
  scenario: {
    method: string;
    policy: string;
    horizon: number;
    shelf_life: number;
    critical_ratio: number;
    holding_share: number;
  };
  trajectory: InventoryTrajectoryPoint[];
}

export interface ScenarioComparison {
  lead_time: number;
  shelf_life: number;
  critical_ratio: number;
  horizon: number;
  m_over_l: number;
  tu_gain_pct?: number;
  methods: Record<string, {
    mean_cost: number;
    fill_rate: number;
    csl: number;
    waste_rate: number;
    holding_cost: number;
    stockout_cost: number;
    expiry_cost: number;
  }>;
}

export interface PolicyComparisonResponse {
  holding_share: number;
  scenarios: ScenarioComparison[];
}

export interface HypothesisResult {
  hypothesis: string;
  name: string;
  comparison: string;
  mean_effect: number;
  exact_p_value: number;
  adjusted_p_value: number | null;
  type: string;
  significant_01: boolean;
  significant_05: boolean;
  favors_first: number;
  total_stores: number;
}

export interface StoreHypothesisResult {
  store: string;
  H1_qr_tu_vs_mr_tu: number;
  H2_qr_tu_vs_qr_cr: number;
  H3_tu_gain_diff_eta: number;
  H4_tu_gain_diff_ratio: number;
  [key: string]: any;
}

export interface ResearchHypothesesResponse {
  hypotheses: HypothesisResult[];
  stores: StoreHypothesisResult[];
  evaluation_horizons: {
    horizon_2: { simulated_days: number; burn_in: number; scored_days: number };
    horizon_3: { simulated_days: number; burn_in: number; scored_days: number };
  };
}

export interface SensitivityPoint {
  holding_share: number;
  qr_tu_cost: number;
  qr_cr_cost: number;
  cost_saving_pct: number;
  qr_tu_csl: number;
  qr_cr_csl: number;
  qr_tu_waste: number;
  qr_cr_waste: number;
}

export interface ResearchSensitivityResponse {
  holding_share_sensitivity: SensitivityPoint[];
  note: string;
}

export interface SimulationParams {
  method: 'QR' | 'MR' | 'NB' | 'SN';
  policy: 'TU' | 'CR';
  lead_time: number;
  shelf_life: number;
  critical_ratio: number;
  holding_share: number;
  series_id?: string;
  target_quantile?: number;
}

export interface SimulationSummary {
  scored_days: number;
  stockout_days: number;
  csl: number;
  fill_rate: number;
  waste_rate: number;
  total_demand: number;
  total_sales: number;
  total_lost_sales: number;
  total_expired: number;
  total_cost: number;
  holding_cost: number;
  stockout_cost: number;
  expiry_cost: number;
}

export interface SimulationDailySample {
  day: number;
  demand: number;
  sales: number;
  lost_sales: number;
  arrivals: number;
  ending_inventory: number;
  expired: number;
  order_quantity: number;
  total_cost: number;
}

export interface SimulationResponse {
  parameters: SimulationParams;
  summary: SimulationSummary;
  daily_sample: SimulationDailySample[];
}

// --- Smart Shop AI Types ---

export type ShopCategory = 
  | 'Grocery Store' 
  | 'Fruit & Vegetable Shop' 
  | 'Medical Shop' 
  | 'Clothing Store' 
  | 'Other';

export type ShopType = 'new' | 'existing';

export interface ShopOnboardingProfile {
  shop_name: string;
  owner_name: string;
  location: string;
  contact_phone?: string;
  contact_email?: string;
  category: ShopCategory | string;
  shop_type: ShopType;
  opening_date?: string;
  status: 'completed' | 'uncompleted';
  tenant_id?: string;
  store_id?: string;
  initial_products?: Array<{
    name: string;
    category?: string;
    quantity: number;
    purchase_price: number;
    selling_price?: number;
    shelf_life?: number;
    supplier?: string;
  }>;
  uploaded_bill_count?: number;
}

export interface OCRExtractedItem {
  product_name: string;
  quantity: number;
  unit_price: number;
  suggested_selling_price?: number;
  total: number;
  confidence: number;
  status: 'verified' | 'review_suggested';
}

export interface OCRBillResult {
  document_id: string;
  filename: string;
  bill_type: 'purchase' | 'sales';
  party_name: string;
  invoice_number: string;
  date: string;
  total_amount: number;
  ocr_engine: string;
  average_confidence: number;
  items: OCRExtractedItem[];
  status: 'ready_for_confirmation';
}

export interface MarketProductResearch {
  product_id: string;
  name: string;
  category: string;
  wholesale_mandi_price: number;
  your_purchase_cost: number;
  retail_benchmark_price: number;
  your_selling_price: number;
  gross_margin_pct: number;
  demand_index: number;
  demand_trajectory: string;
  seasonality: string;
  market_risk: string;
  source: string;
  price_history_30d: number[];
}

export interface MarketResearchResponse {
  total_products_monitored: number;
  research_date: string;
  market_coverage: string;
  products: MarketProductResearch[];
}

export interface ProductAnalyticsData {
  product_id: string;
  product_name: string;
  category: string;
  current_stock: number;
  shelf_life_days: number;
  days_of_supply: number;
  purchase_price: number;
  selling_price: number;
  margin_amount: number;
  margin_pct: number;
  total_units_sold_30d: number;
  total_revenue_30d: number;
  total_gross_profit_30d: number;
  daily_sales_history: Array<{ date: string; units_sold: number; revenue: number }>;
  purchase_cost_history: Array<{ month: string; cost: number }>;
  demand_forecast_7d: Array<{ day: string; forecast_units: number; lower_bound: number; upper_bound: number }>;
  recommended_reorder_qty: number;
  lead_time_days: number;
  stockout_risk_days: number;
  ai_explanation: string;
}

export interface SalesProfitSummary {
  store_id: string;
  total_revenue_month: number;
  total_cost_month: number;
  gross_profit_month: number;
  gross_margin_pct: number;
  today_revenue: number;
  today_profit: number;
  monthly_trend: Array<{ month: string; revenue: number; cost: number; profit: number }>;
  category_profitability: Array<{ category: string; revenue: number; cost: number; profit: number; margin_pct: number }>;
  top_profitable_products: Array<{ name: string; units_sold: number; profit: number; margin_pct: number }>;
}

export interface SupplierInfo {
  id: string;
  name: string;
  contact_person: string;
  phone: string;
  email: string;
  location: string;
  lead_time_days: number;
  reliability_score_pct: number;
  categories: string[];
  active_orders: number;
}

export interface ShopAlert {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  type: 'low_stock' | 'overstock' | 'expiry_risk' | 'demand_surge' | 'price_drop';
  product_name: string;
  category: string;
  current_stock: number;
  days_remaining: number;
  reorder_quantity: number;
  title: string;
  message: string;
  action_label: string;
}

export interface AlertsResponse {
  total_active_alerts: number;
  critical_count: number;
  warning_count: number;
  info_count: number;
  alerts: ShopAlert[];
}

