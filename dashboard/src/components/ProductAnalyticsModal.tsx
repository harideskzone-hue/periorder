import React, { useState, useEffect } from 'react';
import { ProductAnalyticsData } from '../types';
import { fetchProductAnalytics } from '../services/api';
import { 
  X, 
  TrendingUp, 
  Package, 
  AlertTriangle, 
  DollarSign, 
  Clock, 
  ShoppingCart, 
  Calendar,
  Sparkles,
  ArrowUpRight,
  ShieldAlert,
  Loader2,
  RefreshCw
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
  BarChart,
  Bar,
  Legend
} from 'recharts';

interface ProductAnalyticsModalProps {
  productId: string;
  storeId?: string;
  onClose: () => void;
  onReorder?: (productId: string, quantity: number) => void;
}

export const ProductAnalyticsModal: React.FC<ProductAnalyticsModalProps> = ({
  productId,
  storeId = 'CA_1',
  onClose,
  onReorder,
}) => {
  const [data, setData] = useState<ProductAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeChartTab, setActiveChartTab] = useState<'sales' | 'forecast' | 'cost'>('sales');

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchProductAnalytics(productId, 'tenant_default', storeId);
      setData(res);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to load product analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [productId, storeId]);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-blue-50/30">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                  {data?.product_name || productId}
                </h2>
                {data?.category && (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                    {data.category}
                  </span>
                )}
                {data && data.days_of_supply <= 2 && (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 flex items-center space-x-1">
                    <AlertTriangle className="w-3 h-3" />
                    <span>Low Stock</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                SKU: {productId} · Store: {storeId}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-200/70 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-800">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center space-y-3">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              <p className="text-sm text-slate-500 font-medium">Analyzing product sales & market dynamics...</p>
            </div>
          ) : error ? (
            <div className="p-6 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm">Failed to load product analytics</p>
                <p className="text-xs text-rose-600 mt-0.5">{error}</p>
              </div>
              <button
                onClick={loadData}
                className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 flex items-center space-x-1"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry</span>
              </button>
            </div>
          ) : data ? (
            <>
              {/* AI Explanation Banner */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-blue-50/80 via-indigo-50/40 to-white border border-blue-100 flex items-start space-x-3 shadow-xs">
                <div className="p-2 rounded-lg bg-blue-600 text-white shrink-0 mt-0.5 shadow-xs">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-blue-800">
                      Smart Assistant Diagnosis
                    </span>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">
                      Automated
                    </span>
                  </div>
                  <p className="text-sm font-medium text-slate-800 mt-1 leading-relaxed">
                    {data.ai_explanation}
                  </p>
                </div>
              </div>

              {/* Core KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-xs">
                  <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                    <span>Current Stock</span>
                    <Package className="w-3.5 h-3.5 text-blue-600" />
                  </div>
                  <div className="mt-1 flex items-baseline space-x-1.5">
                    <span className="text-2xl font-bold text-slate-900">{data.current_stock}</span>
                    <span className="text-xs text-slate-500">units</span>
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500 flex items-center space-x-1">
                    <Clock className="w-3 h-3 text-amber-500" />
                    <span>{data.days_of_supply.toFixed(1)} days supply left</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-xs">
                  <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                    <span>Unit Margin</span>
                    <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                  </div>
                  <div className="mt-1 flex items-baseline space-x-1.5">
                    <span className="text-2xl font-bold text-emerald-700">₹{data.margin_amount.toFixed(1)}</span>
                    <span className="text-xs font-semibold text-emerald-600">({data.margin_pct}%)</span>
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500">
                    Buy ₹{data.purchase_price} → Sell ₹{data.selling_price}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-xs">
                  <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                    <span>30-Day Sales</span>
                    <TrendingUp className="w-3.5 h-3.5 text-indigo-600" />
                  </div>
                  <div className="mt-1 flex items-baseline space-x-1.5">
                    <span className="text-2xl font-bold text-slate-900">{data.total_units_sold_30d}</span>
                    <span className="text-xs text-slate-500">sold</span>
                  </div>
                  <div className="mt-1 text-[11px] text-emerald-600 font-medium">
                    ₹{data.total_gross_profit_30d.toLocaleString()} gross profit
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-xs">
                  <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                    <span>Suggested Order</span>
                    <ShoppingCart className="w-3.5 h-3.5 text-purple-600" />
                  </div>
                  <div className="mt-1 flex items-baseline space-x-1.5">
                    <span className="text-2xl font-bold text-purple-700">
                      {data.recommended_reorder_qty > 0 ? `+${data.recommended_reorder_qty}` : '0'}
                    </span>
                    <span className="text-xs text-slate-500">units</span>
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500">
                    Lead time: {data.lead_time_days} days
                  </div>
                </div>
              </div>

              {/* Chart Section with Tabs */}
              <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
                  <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg">
                    <button
                      onClick={() => setActiveChartTab('sales')}
                      className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                        activeChartTab === 'sales'
                          ? 'bg-white text-blue-700 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      30-Day Sales Velocity
                    </button>
                    <button
                      onClick={() => setActiveChartTab('forecast')}
                      className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                        activeChartTab === 'forecast'
                          ? 'bg-white text-blue-700 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      7-Day Demand Outlook
                    </button>
                    <button
                      onClick={() => setActiveChartTab('cost')}
                      className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                        activeChartTab === 'cost'
                          ? 'bg-white text-blue-700 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Purchase Cost Trend
                    </button>
                  </div>
                  <div className="text-[11px] text-slate-500 flex items-center space-x-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>Real shop transactions & calibrated forecasts</span>
                  </div>
                </div>

                <div className="pt-4 h-64 w-full">
                  {activeChartTab === 'sales' && (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={data.daily_sales_history}>
                        <defs>
                          <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#2563EB" stopOpacity={0.25} />
                            <stop offset="95%" stopColor="#2563EB" stopOpacity={0.0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                        <XAxis 
                          dataKey="date" 
                          tick={{ fontSize: 11, fill: '#64748B' }} 
                          tickLine={false} 
                          axisLine={{ stroke: '#E2E8F0' }}
                          tickFormatter={(val) => val.slice(5)}
                        />
                        <YAxis 
                          tick={{ fontSize: 11, fill: '#64748B' }} 
                          tickLine={false} 
                          axisLine={false}
                          unit="u"
                        />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const item = payload[0].payload;
                              return (
                                <div className="p-2.5 bg-slate-900 text-white rounded-lg shadow-lg text-xs">
                                  <div className="font-semibold text-slate-300">{item.date}</div>
                                  <div className="text-white font-bold text-sm mt-0.5">
                                    {item.units_sold} units sold
                                  </div>
                                  <div className="text-emerald-400 mt-0.5">
                                    Revenue: ₹{item.revenue}
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="units_sold"
                          stroke="#2563EB"
                          strokeWidth={2.5}
                          fill="url(#salesGrad)"
                          name="Units Sold"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}

                  {activeChartTab === 'forecast' && (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={data.demand_forecast_7d}>
                        <defs>
                          <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#7C3AED" stopOpacity={0.0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                        <XAxis 
                          dataKey="day" 
                          tick={{ fontSize: 11, fill: '#64748B' }} 
                          tickLine={false} 
                          axisLine={{ stroke: '#E2E8F0' }}
                        />
                        <YAxis 
                          tick={{ fontSize: 11, fill: '#64748B' }} 
                          tickLine={false} 
                          axisLine={false}
                          unit="u"
                        />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const item = payload[0].payload;
                              return (
                                <div className="p-2.5 bg-slate-900 text-white rounded-lg shadow-lg text-xs">
                                  <div className="font-semibold text-slate-300">{item.day}</div>
                                  <div className="text-purple-300 font-bold text-sm mt-0.5">
                                    Forecast: {item.forecast_units} units
                                  </div>
                                  <div className="text-slate-400 text-[10px] mt-0.5">
                                    Expected range: {item.lower_bound} – {item.upper_bound} units
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="forecast_units"
                          stroke="#7C3AED"
                          strokeWidth={2.5}
                          fill="url(#forecastGrad)"
                          name="Forecast"
                        />
                        <Line
                          type="monotone"
                          dataKey="upper_bound"
                          stroke="#C4B5FD"
                          strokeDasharray="4 4"
                          strokeWidth={1.5}
                          dot={false}
                          name="Upper Bound"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}

                  {activeChartTab === 'cost' && (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={data.purchase_cost_history}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                        <XAxis 
                          dataKey="month" 
                          tick={{ fontSize: 11, fill: '#64748B' }} 
                          tickLine={false} 
                          axisLine={{ stroke: '#E2E8F0' }}
                        />
                        <YAxis 
                          tick={{ fontSize: 11, fill: '#64748B' }} 
                          tickLine={false} 
                          axisLine={false}
                          unit="₹"
                        />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const item = payload[0].payload;
                              return (
                                <div className="p-2.5 bg-slate-900 text-white rounded-lg shadow-lg text-xs">
                                  <div className="font-semibold text-slate-300">{item.month}</div>
                                  <div className="text-amber-300 font-bold text-sm mt-0.5">
                                    Wholesale Cost: ₹{item.cost}/unit
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="cost"
                          stroke="#D97706"
                          strokeWidth={2.5}
                          dot={{ r: 4, fill: '#D97706' }}
                          name="Wholesale Cost"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Product Specifications & Batch Shelf-Life */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-slate-500 font-medium">Perishability & Shelf Life</div>
                  <div className="mt-1 text-sm font-bold text-slate-800">
                    {data.shelf_life_days} days max shelf life
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Managed automatically using First-In First-Out (FIFO) batch tracking.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-slate-500 font-medium">Estimated Stockout Date</div>
                  <div className="mt-1 text-sm font-bold text-slate-800">
                    {data.days_of_supply <= 1.5 ? (
                      <span className="text-rose-600 font-bold">Tomorrow morning</span>
                    ) : (
                      `In ~${Math.round(data.days_of_supply)} days`
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Based on recent 7-day velocity and local customer purchasing frequency.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-slate-500 font-medium">Supplier Lead Time</div>
                  <div className="mt-1 text-sm font-bold text-slate-800">
                    {data.lead_time_days} days delivery
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Orders placed before 2 PM arrive on scheduled delivery rounds.
                  </p>
                </div>
              </div>
            </>
          ) : null}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            Source: Store ledger, POS sync & regional retail price benchmark.
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Close
            </button>
            {data && data.recommended_reorder_qty > 0 && onReorder && (
              <button
                onClick={() => {
                  onReorder(data.product_id, data.recommended_reorder_qty);
                  onClose();
                }}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs flex items-center space-x-1.5 transition-colors"
              >
                <ShoppingCart className="w-4 h-4" />
                <span>Reorder {data.recommended_reorder_qty} Units</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
