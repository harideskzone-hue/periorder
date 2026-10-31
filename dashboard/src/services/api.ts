import {
  ExecutiveSummaryResponse,
  ForecastingOverview,
  ForecastSeriesResponse,
  InventoryTrajectoryResponse,
  PolicyComparisonResponse,
  ResearchHypothesesResponse,
  ResearchSensitivityResponse,
  SimulationParams,
  SimulationResponse,
  StoreManagerOverview,
  StoreProduct,
  SuggestedOrder,
  DemandOutlookResponse,
  StoreManagerReportsResponse,
  POSStatusResponse,
  TestWebhookPayload,
  StoreInfo,
  StoresResponse,
  ShopOnboardingProfile,
  OCRBillResult,
  MarketResearchResponse,
  ProductAnalyticsData,
  SalesProfitSummary,
  SupplierInfo,
  AlertsResponse,
} from '../types';

const API_BASE = 'http://127.0.0.1:8000/api';

// --- Multi-Store & Tenant API ---

export async function fetchStores(tenantId = 'tenant_default'): Promise<StoresResponse> {
  const res = await fetch(`${API_BASE}/stores?tenant_id=${tenantId}`);
  if (!res.ok) throw new Error('Failed to fetch stores list');
  return res.json();
}

export async function fetchStoreDetails(storeId: string, tenantId = 'tenant_default'): Promise<StoreInfo> {
  const res = await fetch(`${API_BASE}/stores/${storeId}?tenant_id=${tenantId}`);
  if (!res.ok) throw new Error(`Failed to fetch store details for ${storeId}`);
  return res.json();
}

export async function selectStoreAPI(storeId: string, tenantId = 'tenant_default'): Promise<{
  status: string;
  store_id: string;
  store_name: string;
  location: string;
  pos_connected: boolean;
  message: string;
}> {
  const res = await fetch(`${API_BASE}/stores/${storeId}/select?tenant_id=${tenantId}`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(`Failed to select store ${storeId}`);
  return res.json();
}

export async function createStoreAPI(
  storeName: string,
  location: string,
  storeId?: string,
  tenantId = 'tenant_default'
): Promise<{ status: string; store: StoreInfo; message: string }> {
  const res = await fetch(`${API_BASE}/stores`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      store_name: storeName,
      location,
      store_id: storeId || undefined,
      tenant_id: tenantId,
    }),
  });
  if (!res.ok) throw new Error('Failed to create store branch');
  return res.json();
}

// --- Store Manager API ---

export async function fetchStoreManagerOverview(
  tenantId = 'tenant_default',
  storeId = 'CA_1'
): Promise<StoreManagerOverview> {
  const res = await fetch(`${API_BASE}/store-manager/overview?tenant_id=${tenantId}&store_id=${storeId}`);
  if (!res.ok) throw new Error('Failed to fetch store manager overview');
  return res.json();
}

export async function fetchStoreManagerProducts(
  category?: string,
  status?: string,
  tenantId = 'tenant_default',
  storeId = 'CA_1'
): Promise<{ products: StoreProduct[]; total_count: number }> {
  let url = `${API_BASE}/store-manager/products?tenant_id=${tenantId}&store_id=${storeId}`;
  const params = new URLSearchParams();
  if (category && category !== 'All') params.append('category', category);
  if (status && status !== 'All') params.append('status', status);
  if (params.toString()) url += `&${params.toString()}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch store products');
  return res.json();
}

export async function fetchSuggestedOrders(
  tenantId = 'tenant_default',
  storeId = 'CA_1'
): Promise<{
  orders: SuggestedOrder[];
  total_orders: number;
  total_units: number;
  total_estimated_cost: number;
}> {
  const res = await fetch(`${API_BASE}/store-manager/suggested-orders?tenant_id=${tenantId}&store_id=${storeId}`);
  if (!res.ok) throw new Error('Failed to fetch suggested orders');
  return res.json();
}

export async function approveOrders(
  orderIds: string[],
  quantities?: Record<string, number>,
  tenantId = 'tenant_default',
  storeId = 'CA_1'
): Promise<{
  status: string;
  approved_count: number;
  message: string;
  confirmation_code: string;
  transmission: string;
}> {
  const res = await fetch(`${API_BASE}/store-manager/orders/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      order_ids: orderIds,
      quantities: quantities ?? {},
      tenant_id: tenantId,
      store_id: storeId,
    }),
  });
  if (!res.ok) throw new Error('Failed to approve orders');
  return res.json();
}

export async function fetchDemandOutlook(
  tenantId = 'tenant_default',
  storeId = 'CA_1'
): Promise<DemandOutlookResponse> {
  const res = await fetch(`${API_BASE}/store-manager/demand-outlook?tenant_id=${tenantId}&store_id=${storeId}`);
  if (!res.ok) throw new Error('Failed to fetch demand outlook');
  return res.json();
}

export async function fetchStoreManagerReports(
  tenantId = 'tenant_default',
  storeId = 'CA_1'
): Promise<StoreManagerReportsResponse> {
  const res = await fetch(`${API_BASE}/store-manager/reports?tenant_id=${tenantId}&store_id=${storeId}`);
  if (!res.ok) throw new Error('Failed to fetch store reports');
  return res.json();
}

export async function fetchPOSStatus(tenantId = 'tenant_default', storeId = 'CA_1'): Promise<POSStatusResponse> {
  const res = await fetch(`${API_BASE}/pos/status?tenant_id=${tenantId}&store_id=${storeId}`);
  if (!res.ok) throw new Error('Failed to fetch POS status');
  return res.json();
}

export async function sendPOSTransactionWebhook(payload: TestWebhookPayload): Promise<{
  status: string;
  transaction_id: string;
  is_duplicate: boolean;
  items_deducted: number;
  reconciled_stock: Record<string, number>;
  message: string;
}> {
  const res = await fetch(`${API_BASE}/pos/webhooks/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({ detail: 'Webhook submission failed' }));
    throw new Error(errorBody.detail || 'Webhook processing failed');
  }
  return res.json();
}

export async function connectPOSProvider(
  provider = 'generic_mock',
  tenantId = 'tenant_default',
  storeId = 'CA_1',
  credentials: Record<string, any> = {}
): Promise<any> {
  const res = await fetch(`${API_BASE}/pos/connect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenant_id: tenantId,
      store_id: storeId,
      provider,
      credentials,
    }),
  });
  if (!res.ok) throw new Error('Failed to connect POS provider');
  return res.json();
}

// --- Smart Shop AI API ---

export async function fetchOnboardingProfile(
  tenantId = 'tenant_default',
  storeId = 'CA_1'
): Promise<ShopOnboardingProfile> {
  const res = await fetch(`${API_BASE}/onboarding/profile?tenant_id=${tenantId}&store_id=${storeId}`);
  if (!res.ok) throw new Error('Failed to fetch shop profile');
  return res.json();
}

export async function saveOnboardingProfile(
  profile: ShopOnboardingProfile,
  tenantId = 'tenant_default',
  storeId = 'CA_1'
): Promise<{ status: string; message: string; profile: ShopOnboardingProfile; seeded_products_count?: number }> {
  const res = await fetch(`${API_BASE}/onboarding/profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenant_id: tenantId,
      store_id: storeId,
      ...profile,
    }),
  });
  if (!res.ok) throw new Error('Failed to save shop profile');
  return res.json();
}

export async function processBillOCR(
  file: File,
  billType: 'purchase' | 'sales' = 'purchase',
  tenantId = 'tenant_default',
  storeId = 'CA_1'
): Promise<OCRBillResult> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('bill_type', billType);
  formData.append('tenant_id', tenantId);
  formData.append('store_id', storeId);

  const res = await fetch(`${API_BASE}/bills/ocr`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Bill processing failed' }));
    throw new Error(err.detail || 'Bill processing failed');
  }
  return res.json();
}

export async function confirmBillIngestion(
  billData: {
    document_id: string;
    bill_type: string;
    party_name: string;
    invoice_number: string;
    date: string;
    items: Array<{ product_name: string; quantity: number; unit_price: number; total?: number }>;
  },
  tenantId = 'tenant_default',
  storeId = 'CA_1'
): Promise<{ status: string; message: string; items_processed: number; document_id: string }> {
  const res = await fetch(`${API_BASE}/bills/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenant_id: tenantId,
      store_id: storeId,
      ...billData,
    }),
  });
  if (!res.ok) throw new Error('Failed to confirm and commit bill');
  return res.json();
}

export async function fetchMarketResearch(
  tenantId = 'tenant_default',
  storeId = 'CA_1'
): Promise<MarketResearchResponse> {
  const res = await fetch(`${API_BASE}/market-research?tenant_id=${tenantId}&store_id=${storeId}`);
  if (!res.ok) throw new Error('Failed to fetch market research data');
  return res.json();
}

export async function fetchProductAnalytics(
  productId: string,
  tenantId = 'tenant_default',
  storeId = 'CA_1'
): Promise<ProductAnalyticsData> {
  const res = await fetch(`${API_BASE}/products/${encodeURIComponent(productId)}/analytics?tenant_id=${tenantId}&store_id=${storeId}`);
  if (!res.ok) throw new Error(`Failed to fetch analytics for product ${productId}`);
  return res.json();
}

export async function fetchSalesProfitSummary(
  tenantId = 'tenant_default',
  storeId = 'CA_1'
): Promise<SalesProfitSummary> {
  const res = await fetch(`${API_BASE}/analytics/sales-profit?tenant_id=${tenantId}&store_id=${storeId}`);
  if (!res.ok) throw new Error('Failed to fetch sales and profit analytics');
  return res.json();
}

export async function fetchSuppliers(
  tenantId = 'tenant_default',
  storeId = 'CA_1'
): Promise<{ suppliers: SupplierInfo[]; total_suppliers: number }> {
  const res = await fetch(`${API_BASE}/suppliers?tenant_id=${tenantId}&store_id=${storeId}`);
  if (!res.ok) throw new Error('Failed to fetch suppliers');
  return res.json();
}

export async function fetchShopAlerts(
  tenantId = 'tenant_default',
  storeId = 'CA_1'
): Promise<AlertsResponse> {
  const res = await fetch(`${API_BASE}/alerts?tenant_id=${tenantId}&store_id=${storeId}`);
  if (!res.ok) throw new Error('Failed to fetch shop alerts');
  return res.json();
}

// --- Research & Analytics API ---

export async function fetchExecutiveSummary(): Promise<ExecutiveSummaryResponse> {
  const res = await fetch(`${API_BASE}/executive/summary`);
  if (!res.ok) throw new Error('Failed to fetch executive summary');
  return res.json();
}

export async function fetchForecastingOverview(): Promise<ForecastingOverview> {
  const res = await fetch(`${API_BASE}/forecasting/overview`);
  if (!res.ok) throw new Error('Failed to fetch forecasting overview');
  return res.json();
}

export async function fetchForecastSeries(
  seriesId: string,
  method: string = 'QR',
  horizon: number = 2,
  limit: number = 60
): Promise<ForecastSeriesResponse> {
  const res = await fetch(
    `${API_BASE}/forecasting/series?series_id=${encodeURIComponent(
      seriesId
    )}&method=${method}&horizon=${horizon}&limit=${limit}`
  );
  if (!res.ok) throw new Error('Failed to fetch forecast series');
  return res.json();
}

export async function fetchInventoryTrajectory(
  method: string = 'QR',
  policy: string = 'TU',
  horizon: number = 2,
  shelfLife: number = 3,
  criticalRatio: number = 0.50,
  holdingShare: number = 0.20
): Promise<InventoryTrajectoryResponse> {
  const res = await fetch(
    `${API_BASE}/inventory/trajectory?method=${method}&policy=${policy}&horizon=${horizon}&shelf_life=${shelfLife}&critical_ratio=${criticalRatio}&holding_share=${holdingShare}`
  );
  if (!res.ok) throw new Error('Failed to fetch inventory trajectory');
  return res.json();
}

export async function fetchPolicyComparison(
  holdingShare: number = 0.20
): Promise<PolicyComparisonResponse> {
  const res = await fetch(`${API_BASE}/policy/comparison?holding_share=${holdingShare}`);
  if (!res.ok) throw new Error('Failed to fetch policy comparison');
  return res.json();
}

export async function fetchResearchHypotheses(): Promise<ResearchHypothesesResponse> {
  const res = await fetch(`${API_BASE}/research/hypotheses`);
  if (!res.ok) throw new Error('Failed to fetch research hypotheses');
  return res.json();
}

export async function fetchResearchSensitivity(): Promise<ResearchSensitivityResponse> {
  const res = await fetch(`${API_BASE}/research/sensitivity`);
  if (!res.ok) throw new Error('Failed to fetch research sensitivity');
  return res.json();
}

export async function runSimulation(params: SimulationParams): Promise<SimulationResponse> {
  const res = await fetch(`${API_BASE}/simulate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error('Failed to run simulation');
  return res.json();
}
