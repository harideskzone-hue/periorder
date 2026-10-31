import React, { useEffect, useState } from 'react';
import { InventoryTrajectoryResponse, InventoryTrajectoryPoint } from '../types';
import { fetchInventoryTrajectory } from '../services/api';
import { 
  Activity, 
  AlertTriangle, 
  Package, 
  Truck, 
  Trash2, 
  DollarSign,
  Calendar,
  Layers,
  CheckCircle2,
  Filter
} from 'lucide-react';
import { 
  ComposedChart, 
  Line, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend 
} from 'recharts';

export const InventoryMonitoring: React.FC = () => {
  const [method, setMethod] = useState<string>('QR');
  const [policy, setPolicy] = useState<string>('TU');
  const [horizon, setHorizon] = useState<number>(2);
  const [shelfLife, setShelfLife] = useState<number>(3);
  const [criticalRatio, setCriticalRatio] = useState<number>(0.50);
  const [holdingShare, setHoldingShare] = useState<number>(0.20);

  const [data, setData] = useState<InventoryTrajectoryResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchInventoryTrajectory(method, policy, horizon, shelfLife, criticalRatio, holdingShare)
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [method, policy, horizon, shelfLife, criticalRatio, holdingShare]);

  const points: InventoryTrajectoryPoint[] = data?.trajectory || [];

  // Summary stats across this trajectory sample
  const totalDemand = points.reduce((acc, p) => acc + p.demand, 0);
  const totalSales = points.reduce((acc, p) => acc + p.sales, 0);
  const totalLostSales = points.reduce((acc, p) => acc + p.lost_sales, 0);
  const totalExpired = points.reduce((acc, p) => acc + p.expired_units, 0);
  const totalArrivals = points.reduce((acc, p) => acc + p.arrivals, 0);
  const totalCost = points.reduce((acc, p) => acc + p.total_cost, 0);
  const stockoutDaysCount = points.filter((p) => p.lost_sales > 0).length;
  const sampleCsl = points.length > 0 ? (1 - stockoutDaysCount / points.length) * 100 : 0;
  const sampleFillRate = totalDemand > 0 ? (totalSales / totalDemand) * 100 : 0;
  const sampleWasteRate = totalArrivals > 0 ? (totalExpired / totalArrivals) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Header & Scenario Filters */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-2 border-b border-[#e8e8ed] gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#1d1d1f]">
            Inventory Trajectory &amp; Pipeline Monitoring
          </h1>
          <p className="text-sm text-[#6e6e73] mt-0.5">
            Daily physical inventory state, order pipeline, spoilage, and stockout risk
          </p>
        </div>

        {/* Evaluation Horizon Indicator */}
        <div className="flex items-center space-x-2 text-xs bg-[#ffffff] px-3.5 py-2 rounded-xl border border-[#e8e8ed] shadow-subtle">
          <Calendar className="w-3.5 h-3.5 text-[#0071e3]" />
          <span className="text-[#6e6e73]">Scored Horizon:</span>
          <span className="font-semibold text-[#1d1d1f]">
            {horizon === 2 ? '356 Days (ℓ=2)' : '355 Days (ℓ=3)'}
          </span>
        </div>
      </div>

      {/* Scenario Control Panel */}
      <div className="card-apple p-4 space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-[#f0f0f4] text-xs font-semibold text-[#1d1d1f]">
          <div className="flex items-center space-x-1.5">
            <Filter className="w-3.5 h-3.5 text-[#0071e3]" />
            <span>Operational Scenario Parameters</span>
          </div>
          <span className="text-[#86868b] font-normal">Active Configuration: {method}-{policy} (m={shelfLife}, L={horizon-1}, CR={criticalRatio})</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 text-xs">
          {/* Method */}
          <div>
            <label className="block text-[#86868b] font-medium mb-1">Model</label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="w-full bg-[#f5f5f7] border border-[#e8e8ed] rounded-lg px-2.5 py-1.5 font-medium text-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-[#0071e3]"
            >
              <option value="QR">QR (Quantile Reg)</option>
              <option value="MR">MR (Mean Reg)</option>
              <option value="NB">NB (Neg Binomial)</option>
              <option value="SN">SN (Seasonal Naive)</option>
            </select>
          </div>

          {/* Policy */}
          <div>
            <label className="block text-[#86868b] font-medium mb-1">Policy</label>
            <select
              value={policy}
              onChange={(e) => setPolicy(e.target.value)}
              className="w-full bg-[#f5f5f7] border border-[#e8e8ed] rounded-lg px-2.5 py-1.5 font-medium text-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-[#0071e3]"
            >
              <option value="TU">TU (Validation Tuned)</option>
              <option value="CR">CR (Static Critical Ratio)</option>
            </select>
          </div>

          {/* Horizon */}
          <div>
            <label className="block text-[#86868b] font-medium mb-1">Horizon (ℓ = L+1)</label>
            <select
              value={horizon}
              onChange={(e) => setHorizon(Number(e.target.value))}
              className="w-full bg-[#f5f5f7] border border-[#e8e8ed] rounded-lg px-2.5 py-1.5 font-medium text-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-[#0071e3]"
            >
              <option value={2}>ℓ = 2 (L = 1, 356d)</option>
              <option value={3}>ℓ = 3 (L = 2, 355d)</option>
            </select>
          </div>

          {/* Shelf Life */}
          <div>
            <label className="block text-[#86868b] font-medium mb-1">Shelf Life (m)</label>
            <select
              value={shelfLife}
              onChange={(e) => setShelfLife(Number(e.target.value))}
              className="w-full bg-[#f5f5f7] border border-[#e8e8ed] rounded-lg px-2.5 py-1.5 font-medium text-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-[#0071e3]"
            >
              <option value={2}>m = 2 Days</option>
              <option value={3}>m = 3 Days</option>
              <option value={5}>m = 5 Days</option>
            </select>
          </div>

          {/* Critical Ratio */}
          <div>
            <label className="block text-[#86868b] font-medium mb-1">Critical Ratio (CR)</label>
            <select
              value={criticalRatio}
              onChange={(e) => setCriticalRatio(Number(e.target.value))}
              className="w-full bg-[#f5f5f7] border border-[#e8e8ed] rounded-lg px-2.5 py-1.5 font-medium text-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-[#0071e3]"
            >
              <option value={0.40}>0.40 (Under-critical)</option>
              <option value={0.50}>0.50 (Symmetric)</option>
              <option value={0.75}>0.75 (Over-critical)</option>
            </select>
          </div>

          {/* Holding Share */}
          <div>
            <label className="block text-[#86868b] font-medium mb-1">Holding Share (η)</label>
            <select
              value={holdingShare}
              onChange={(e) => setHoldingShare(Number(e.target.value))}
              className="w-full bg-[#f5f5f7] border border-[#e8e8ed] rounded-lg px-2.5 py-1.5 font-medium text-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-[#0071e3]"
            >
              <option value={0.20}>η = 0.20 (Primary)</option>
              <option value={0.50}>η = 0.50 (Sensitivity)</option>
              <option value={1.00}>η = 1.00 (Pure Holding)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Trajectory Key Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="card-apple p-3.5">
          <span className="text-[11px] font-medium text-[#86868b] block">Total Sample Cost</span>
          <span className="text-xl font-bold text-[#1d1d1f]">${(totalCost / 1000).toFixed(1)}k</span>
        </div>
        <div className="card-apple p-3.5">
          <span className="text-[11px] font-medium text-[#86868b] block">Cycle Service Level</span>
          <span className="text-xl font-bold text-[#16a34a]">{sampleCsl.toFixed(1)}%</span>
        </div>
        <div className="card-apple p-3.5">
          <span className="text-[11px] font-medium text-[#86868b] block">Volume Fill Rate</span>
          <span className="text-xl font-bold text-[#0071e3]">{sampleFillRate.toFixed(1)}%</span>
        </div>
        <div className="card-apple p-3.5">
          <span className="text-[11px] font-medium text-[#86868b] block">Waste Rate</span>
          <span className="text-xl font-bold text-[#d97706]">{sampleWasteRate.toFixed(2)}%</span>
        </div>
        <div className="card-apple p-3.5">
          <span className="text-[11px] font-medium text-[#86868b] block">Stockout Days</span>
          <span className="text-xl font-bold text-[#f43f5e]">{stockoutDaysCount} / {points.length}</span>
        </div>
        <div className="card-apple p-3.5">
          <span className="text-[11px] font-medium text-[#86868b] block">Expired Units</span>
          <span className="text-xl font-bold text-[#1d1d1f]">{totalExpired.toLocaleString()}</span>
        </div>
      </div>

      {/* Main Trajectory Chart */}
      <div className="card-apple p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
          <div>
            <h2 className="text-base font-semibold text-[#1d1d1f]">
              Daily Inventory State &amp; Pipeline Trajectory
            </h2>
            <p className="text-xs text-[#6e6e73]">
              On-hand stock, orders in transit, daily customer demand, and spoilage events
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-[#6e6e73]">
            <span className="flex items-center space-x-1">
              <span className="w-3 h-0.5 bg-[#0071e3]"></span>
              <span>Ending Stock</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-3 h-0.5 bg-[#10b981]"></span>
              <span>Pipeline In-Flight</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 bg-[#94a3b8] rounded-sm"></span>
              <span>Orders Placed</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 bg-[#f43f5e] rounded-sm"></span>
              <span>Expired Units</span>
            </span>
          </div>
        </div>

        {loading ? (
          <div className="h-80 flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#0071e3]"></div>
          </div>
        ) : (
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={points} margin={{ top: 10, right: 10, bottom: 20, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f4" />
                <XAxis 
                  dataKey="day" 
                  tick={{ fontSize: 11, fill: '#6e6e73' }}
                  label={{ value: 'Simulation Day', position: 'insideBottom', offset: -10, fontSize: 11, fill: '#86868b' }}
                />
                <YAxis 
                  tick={{ fontSize: 11, fill: '#6e6e73' }}
                  label={{ value: 'Units', angle: -90, position: 'insideLeft', offset: 0, fontSize: 11, fill: '#86868b' }}
                />
                <Tooltip 
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload;
                      return (
                        <div className="bg-[#ffffff] p-3 rounded-lg shadow-apple-card border border-[#e8e8ed] text-xs space-y-1">
                          <p className="font-semibold text-[#1d1d1f]">Day {label}</p>
                          <p className="text-[#0071e3]">Ending Inventory: {d.ending_inventory.toLocaleString()} units</p>
                          <p className="text-[#10b981]">Pipeline In-Transit: {d.pipeline_inventory.toLocaleString()} units</p>
                          <p className="text-[#6e6e73]">Orders Placed: {d.order_quantity.toLocaleString()} units</p>
                          <p className="text-[#1d1d1f]">Demand: {d.demand.toLocaleString()} units (Sales: {d.sales.toLocaleString()})</p>
                          {d.lost_sales > 0 && (
                            <p className="text-[#f43f5e] font-medium">⚠️ Stockout / Lost Sales: {d.lost_sales.toLocaleString()} units</p>
                          )}
                          {d.expired_units > 0 && (
                            <p className="text-[#d97706] font-medium">🍂 Expired Stock: {d.expired_units.toLocaleString()} units</p>
                          )}
                          <p className="pt-1 border-t border-[#f0f0f4] text-[#1d1d1f] font-semibold">Daily Cost: ${d.total_cost}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="order_quantity" fill="#e2e8f0" name="Order Placed" />
                <Bar dataKey="expired_units" fill="#f43f5e" name="Expired Units" />
                <Line type="monotone" dataKey="ending_inventory" stroke="#0071e3" strokeWidth={2} dot={false} name="Ending Inventory" />
                <Line type="monotone" dataKey="pipeline_inventory" stroke="#10b981" strokeWidth={1.5} strokeDasharray="3 3" dot={false} name="Pipeline In-Flight" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
};
