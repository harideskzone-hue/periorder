import React, { useState, useEffect } from 'react';
import { MarketResearchResponse, MarketProductResearch } from '../types';
import { fetchMarketResearch } from '../services/api';
import {
  Search,
  Filter,
  TrendingUp,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  Calendar,
  Building2,
  ChevronRight,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Info
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip
} from 'recharts';

interface MarketResearchViewProps {
  storeId?: string;
  storeName?: string;
  onSelectProductForDeepDive?: (productId: string) => void;
}

export const MarketResearchView: React.FC<MarketResearchViewProps> = ({
  storeId = 'CA_1',
  storeName = 'Downtown Central',
  onSelectProductForDeepDive,
}) => {
  const [data, setData] = useState<MarketResearchResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const loadMarketData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchMarketResearch('tenant_default', storeId);
      setData(res);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to load market research data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMarketData();
  }, [storeId]);

  const categories = ['All', ...new Set(data?.products.map((p) => p.category) || [])];

  const filteredProducts = (data?.products || []).filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.product_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-1.5 rounded-lg bg-indigo-100 text-indigo-700">
              <TrendingUp className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Retail Product Market Intelligence
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Live wholesale Mandi rates, regional retail benchmarks, and 30-day price trends. 
            Compare what you pay your supplier against prevailing market rates to maximize your shop margin.
          </p>
        </div>

        {data && (
          <div className="flex items-center space-x-2 text-xs text-slate-500 bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span>Updated: {data.research_date}</span>
            <span className="text-slate-300">|</span>
            <span className="font-semibold text-slate-700">{data.market_coverage}</span>
          </div>
        )}
      </div>

      {/* Advisory Note on Retail vs Stock Exchange */}
      <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-100 text-xs text-blue-900 flex items-start space-x-3">
        <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">Transparent Regional Market Benchmarks: </span>
          This data reflects retail goods, Agricultural Produce Market Committee (APMC) Mandi rates, and FMCG wholesale distributions. Every benchmark shows the verified source and date.
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by product name or SKU..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:border-blue-500"
          />
        </div>

        <div className="flex items-center space-x-1.5 overflow-x-auto w-full sm:w-auto">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                selectedCategory === cat
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Products Grid */}
      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center space-y-3 bg-white rounded-2xl border border-slate-200">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          <p className="text-sm text-slate-500 font-medium">Gathering market price benchmarks and demand velocity...</p>
        </div>
      ) : error ? (
        <div className="p-8 text-center bg-white rounded-2xl border border-rose-200 text-rose-700">
          <p className="font-semibold text-sm">Failed to load market research</p>
          <p className="text-xs text-rose-500 mt-1">{error}</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-500">
          No products found matching "{searchQuery}"
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProducts.map((p) => {
            const costDiff = p.your_purchase_cost - p.wholesale_mandi_price;
            const isSaving = costDiff <= 0;

            // Prepare sparkline data
            const sparklineData = p.price_history_30d.map((val, idx) => ({ day: idx + 1, price: val }));

            return (
              <div
                key={p.product_id}
                className="bg-white rounded-2xl border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all p-5 flex flex-col justify-between"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        {p.category}
                      </span>
                      <h3 className="text-base font-bold text-slate-900 leading-snug mt-0.5">
                        {p.name}
                      </h3>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        p.market_risk === 'Low Risk'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : p.market_risk === 'Moderate Risk'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}
                    >
                      {p.market_risk}
                    </span>
                  </div>

                  {/* Price Comparison Block */}
                  <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Wholesale Mandi Rate:</span>
                      <span className="font-bold text-slate-900 font-mono">
                        ₹{p.wholesale_mandi_price}/unit
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Your Current Cost:</span>
                      <div className="flex items-center space-x-1.5 font-mono">
                        <span className="font-bold text-slate-900">₹{p.your_purchase_cost}/unit</span>
                        {isSaving ? (
                          <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100 px-1.5 py-0.2 rounded">
                            -₹{Math.abs(costDiff)} (Good Rate)
                          </span>
                        ) : (
                          <span className="text-[10px] text-amber-700 font-bold bg-amber-100 px-1.5 py-0.2 rounded">
                            +₹{costDiff} (Above Mandi)
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-200/70">
                      <span className="text-slate-500">Retail Benchmark:</span>
                      <span className="font-semibold text-slate-700 font-mono">
                        ₹{p.retail_benchmark_price}/unit
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Your Selling Price:</span>
                      <div className="flex items-center space-x-1.5 font-mono">
                        <span className="font-bold text-blue-700">₹{p.your_selling_price}/unit</span>
                        <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1 rounded">
                          {p.gross_margin_pct}% margin
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 30-Day Trend Sparkline */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                      <span>30-Day Wholesale Price Trend</span>
                      <span className="font-mono text-slate-700">
                        ₹{p.price_history_30d[0]} → ₹{p.price_history_30d[p.price_history_30d.length - 1]}
                      </span>
                    </div>
                    <div className="h-16 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={sparklineData}>
                          <Tooltip
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                return (
                                  <div className="px-2 py-1 bg-slate-900 text-white text-[10px] rounded font-mono">
                                    ₹{payload[0].value}
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Line
                            type="monotone"
                            dataKey="price"
                            stroke="#2563EB"
                            strokeWidth={2}
                            dot={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Demand & Seasonality Badges */}
                  <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
                    <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center space-x-1">
                      <Sparkles className="w-3 h-3" />
                      <span>{p.demand_trajectory}</span>
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                      {p.seasonality}
                    </span>
                  </div>
                </div>

                {/* Card Footer */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div className="text-[10px] text-slate-400 truncate max-w-[180px]" title={p.source}>
                    Source: {p.source}
                  </div>
                  {onSelectProductForDeepDive && (
                    <button
                      onClick={() => onSelectProductForDeepDive(p.product_id)}
                      className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center space-x-1 transition-colors"
                    >
                      <span>Deep Dive</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
