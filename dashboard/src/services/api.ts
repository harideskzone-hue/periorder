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
} from '../types';

const API_BASE = 'http://127.0.0.1:8000/api';

// --- Store Manager API ---

export async function fetchStoreManagerOverview(): Promise<StoreManagerOverview> {
  const res = await fetch(`${API_BASE}/store-manager/overview`);
  if (!res.ok) throw new Error('Failed to fetch store manager overview');
  return res.json();
}

export async function fetchStoreManagerProducts(
  category?: string,
  status?: string
): Promise<{ products: StoreProduct[]; total_count: number }> {
  let url = `${API_BASE}/store-manager/products`;
  const params = new URLSearchParams();
  if (category && category !== 'All') params.append('category', category);
  if (status && status !== 'All') params.append('status', status);
  if (params.toString()) url += `?${params.toString()}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch store products');
  return res.json();
}

export async function fetchSuggestedOrders(): Promise<{
  orders: SuggestedOrder[];
  total_orders: number;
  total_units: number;
  total_estimated_cost: number;
}> {
  const res = await fetch(`${API_BASE}/store-manager/suggested-orders`);
  if (!res.ok) throw new Error('Failed to fetch suggested orders');
  return res.json();
}

export async function approveOrders(orderIds: string[]): Promise<{
  status: string;
  approved_count: number;
  message: string;
  confirmation_code: string;
}> {
  const res = await fetch(`${API_BASE}/store-manager/orders/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order_ids: orderIds }),
  });
  if (!res.ok) throw new Error('Failed to approve orders');
  return res.json();
}

export async function fetchDemandOutlook(): Promise<DemandOutlookResponse> {
  const res = await fetch(`${API_BASE}/store-manager/demand-outlook`);
  if (!res.ok) throw new Error('Failed to fetch demand outlook');
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
