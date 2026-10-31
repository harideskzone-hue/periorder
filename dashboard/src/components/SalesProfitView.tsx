import React, { useState, useEffect } from 'react';
import { SalesProfitSummary } from '../types';
import { fetchSalesProfitSummary } from '../services/api';
import {
  DollarSign,
  TrendingUp,
  Percent,
  Calendar,
  Layers,
  ArrowUpRight,
  Loader2,
  PieChart as PieIcon,
  CheckCircle2,
  Package
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from 'recharts';

interface SalesProfitViewProps {
  storeId?: string;
  storeName?: string;
  onSelectProduct?: (productName: string) => void;
}

export const SalesProfitView: React.FC<SalesProfitViewProps> = ({
  storeId = 'CA_1',
  storeName = 'Downtown Central',
  onSelectProduct,
}) => {
  const [data, setData] = useState<SalesProfitSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchSalesProfitSummary('tenant_default', storeId);
      setData(res);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to load sales and profit analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [storeId]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700">
              <DollarSign className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Sales, Revenue & Profitability Analysis
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Track gross margins, evaluate category-wise returns, and see exactly which products generate the highest net profit for your store.
          </p>
        </div>

        <div className="text-xs text-slate-500 bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200 self-start md:self-auto">
          Active Store: <span className="font-semibold text-slate-800">{storeName}</span>
        </div>
      </div>

      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center space-y-3 bg-white rounded-2xl border border-slate-200">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          <p className="text-sm text-slate-500 font-medium">Aggregating transactions and computing margins...</p>
        </div>
      ) : error ? (
        <div className="p-8 text-center bg-white rounded-2xl border border-rose-200 text-rose-700">
          <p className="font-semibold text-sm">Failed to load sales analytics</p>
          <p className="text-xs text-rose-500 mt-1">{error}</p>
        </div>
      ) : data ? (
        <>
          {/* Top KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                <span>Month-to-Date Revenue</span>
                <DollarSign className="w-4 h-4 text-blue-600" />
              </div>
              <div className="mt-2 text-2xl font-bold text-slate-900 font-mono">
                ₹{data.total_revenue_month.toLocaleString()}
              </div>
              <div className="mt-1 text-xs text-emerald-600 font-medium flex items-center space-x-1">
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>+12.4% vs last month</span>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                <span>Gross Profit (MTD)</span>
                <TrendingUp className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="mt-2 text-2xl font-bold text-emerald-700 font-mono">
                ₹{data.gross_profit_month.toLocaleString()}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Cost of goods: ₹{data.total_cost_month.toLocaleString()}
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                <span>Average Gross Margin</span>
                <Percent className="w-4 h-4 text-purple-600" />
              </div>
              <div className="mt-2 text-2xl font-bold text-purple-700 font-mono">
                {data.gross_margin_pct}%
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Healthy retail benchmark: 18–25%
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                <span>Today's Sales & Profit</span>
                <Calendar className="w-4 h-4 text-amber-600" />
              </div>
              <div className="mt-2 text-2xl font-bold text-slate-900 font-mono">
                ₹{data.today_revenue.toLocaleString()}
              </div>
              <div className="mt-1 text-xs text-emerald-700 font-semibold">
                ₹{data.today_profit.toLocaleString()} estimated profit
              </div>
            </div>
          </div>

          {/* Revenue vs Cost vs Profit Chart */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Monthly Financial Performance Overview
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Gross Revenue vs Wholesale Procurement Cost vs Net Gross Profit
                </p>
              </div>
            </div>

            <div className="pt-4 h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.monthly_trend}>
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
                          <div className="p-3 bg-slate-900 text-white rounded-xl shadow-lg text-xs space-y-1">
                            <div className="font-bold text-slate-200">{item.month}</div>
                            <div className="text-blue-300">Revenue: ₹{item.revenue.toLocaleString()}</div>
                            <div className="text-slate-400">Wholesale Cost: ₹{item.cost.toLocaleString()}</div>
                            <div className="text-emerald-400 font-bold">Gross Profit: ₹{item.profit.toLocaleString()}</div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                  <Bar dataKey="revenue" name="Revenue" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="cost" name="Procurement Cost" fill="#94A3B8" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="profit" name="Gross Profit" fill="#10B981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Two-Column Section: Category Profitability & Top Products */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Category Breakdown Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Layers className="w-4 h-4 text-slate-500" />
                  <h3 className="text-sm font-bold text-slate-900">
                    Category-Wise Profit Margins
                  </h3>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-2.5 px-4">Category</th>
                      <th className="py-2.5 px-4">Revenue</th>
                      <th className="py-2.5 px-4">Profit</th>
                      <th className="py-2.5 px-4 text-right">Margin %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.category_profitability.map((cat, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="py-3 px-4 font-semibold text-slate-900">{cat.category}</td>
                        <td className="py-3 px-4 font-mono text-slate-600">₹{cat.revenue.toLocaleString()}</td>
                        <td className="py-3 px-4 font-mono font-bold text-emerald-700">₹{cat.profit.toLocaleString()}</td>
                        <td className="py-3 px-4 text-right">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono">
                            {cat.margin_pct}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Top Profitable Products */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-sm font-bold text-slate-900">
                    Top Profitable Products (This Month)
                  </h3>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-2.5 px-4">Product</th>
                      <th className="py-2.5 px-4">Units Sold</th>
                      <th className="py-2.5 px-4">Net Profit</th>
                      <th className="py-2.5 px-4 text-right">Margin %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.top_profitable_products.map((prod, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="py-3 px-4 font-semibold text-slate-900 flex items-center space-x-2">
                          <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <span>{prod.name}</span>
                        </td>
                        <td className="py-3 px-4 text-slate-600">{prod.units_sold} units</td>
                        <td className="py-3 px-4 font-mono font-bold text-emerald-700">₹{prod.profit.toLocaleString()}</td>
                        <td className="py-3 px-4 text-right font-mono font-semibold text-slate-700">
                          {prod.margin_pct}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
};
