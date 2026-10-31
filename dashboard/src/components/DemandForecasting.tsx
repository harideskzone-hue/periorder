import React, { useEffect, useState } from 'react';
import { ForecastingOverview, ForecastSeriesResponse, SampleSeries } from '../types';
import { fetchForecastingOverview, fetchForecastSeries } from '../services/api';
import { 
  TrendingUp, 
  Layers, 
  Sliders, 
  HelpCircle, 
  CheckCircle2, 
  Calendar,
  Sparkles
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend 
} from 'recharts';

export const DemandForecasting: React.FC = () => {
  const [overview, setOverview] = useState<ForecastingOverview | null>(null);
  const [selectedSeries, setSelectedSeries] = useState<string>('FOODS_1_012_TX_1_evaluation');
  const [selectedMethod, setSelectedMethod] = useState<string>('QR');
  const [selectedHorizon, setSelectedHorizon] = useState<number>(2);
  const [seriesData, setSeriesData] = useState<ForecastSeriesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(false);

  useEffect(() => {
    fetchForecastingOverview()
      .then((res) => {
        setOverview(res);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    setChartLoading(true);
    fetchForecastSeries(selectedSeries, selectedMethod, selectedHorizon, 60)
      .then((res) => {
        setSeriesData(res);
        setChartLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setChartLoading(false);
      });
  }, [selectedSeries, selectedMethod, selectedHorizon]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0071e3]"></div>
      </div>
    );
  }

  const sampleSeriesList = overview?.sample_series || [];
  const models = overview?.models || [];

  return (
    <div className="space-y-6">
      {/* Page Title & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-2 border-b border-[#e8e8ed] gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#1d1d1f]">
            Probabilistic Demand Forecasting
          </h1>
          <p className="text-sm text-[#6e6e73] mt-0.5">
            Full conditional distribution predictions over protection periods ℓ = 2 and ℓ = 3
          </p>
        </div>

        {/* Global Selectors */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Method selector */}
          <div className="flex rounded-lg bg-[#f5f5f7] p-1 border border-[#e8e8ed] text-xs">
            {['QR', 'MR', 'NB', 'SN'].map((m) => (
              <button
                key={m}
                onClick={() => setSelectedMethod(m)}
                className={`px-3 py-1 rounded-md font-medium transition-all ${
                  selectedMethod === m
                    ? 'bg-[#ffffff] text-[#0071e3] shadow-subtle'
                    : 'text-[#6e6e73] hover:text-[#1d1d1f]'
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          {/* Horizon selector */}
          <div className="flex rounded-lg bg-[#f5f5f7] p-1 border border-[#e8e8ed] text-xs">
            <button
              onClick={() => setSelectedHorizon(2)}
              className={`px-3 py-1 rounded-md font-medium transition-all ${
                selectedHorizon === 2
                  ? 'bg-[#ffffff] text-[#0071e3] shadow-subtle'
                  : 'text-[#6e6e73] hover:text-[#1d1d1f]'
              }`}
            >
              ℓ = 2 (356 days)
            </button>
            <button
              onClick={() => setSelectedHorizon(3)}
              className={`px-3 py-1 rounded-md font-medium transition-all ${
                selectedHorizon === 3
                  ? 'bg-[#ffffff] text-[#0071e3] shadow-subtle'
                  : 'text-[#6e6e73] hover:text-[#1d1d1f]'
              }`}
            >
              ℓ = 3 (355 days)
            </button>
          </div>
        </div>
      </div>

      {/* Product Series Selector Bar */}
      <div className="card-apple p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-2 text-xs">
          <span className="font-semibold text-[#1d1d1f]">Select Product Series:</span>
          <div className="flex flex-wrap gap-1.5">
            {sampleSeriesList.map((item) => {
              const isSelected = selectedSeries === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setSelectedSeries(item.id)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-all ${
                    isSelected
                      ? 'bg-[#0071e3] text-white border-[#0071e3]'
                      : 'bg-[#ffffff] text-[#6e6e73] border-[#e8e8ed] hover:border-[#d2d2d7]'
                  }`}
                >
                  {item.item} ({item.store} · {item.class})
                </button>
              );
            })}
          </div>
        </div>

        <div className="text-xs text-[#86868b] flex items-center space-x-1.5">
          <Calendar className="w-3.5 h-3.5 text-[#0071e3]" />
          <span>Active: {selectedSeries}</span>
        </div>
      </div>

      {/* Main Fan Chart */}
      <div className="card-apple p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
          <div>
            <h2 className="text-base font-semibold text-[#1d1d1f] flex items-center space-x-2">
              <span>Actual Demand vs. Quantile Forecast Fan</span>
              <span className="text-xs font-normal text-[#86868b]">
                ({selectedMethod} · Horizon ℓ = {selectedHorizon})
              </span>
            </h2>
            <p className="text-xs text-[#6e6e73]">
              Shaded fan represents 25th, 50th, 75th, 90th, and 95th percentiles of conditional demand
            </p>
          </div>

          <div className="flex items-center space-x-3 text-xs text-[#6e6e73]">
            <div className="flex items-center space-x-1">
              <span className="w-3 h-0.5 bg-[#1d1d1f]"></span>
              <span>Actual Sales</span>
            </div>
            <div className="flex items-center space-x-1">
              <span className="w-3 h-0.5 bg-[#0071e3]"></span>
              <span>Median (q_0.50)</span>
            </div>
            <div className="flex items-center space-x-1">
              <span className="w-3 h-2 bg-[#0071e3]/20 rounded-sm"></span>
              <span>Quantile Fan (25%-95%)</span>
            </div>
          </div>
        </div>

        {chartLoading ? (
          <div className="h-80 flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#0071e3]"></div>
          </div>
        ) : (
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={seriesData?.records || []} margin={{ top: 10, right: 10, bottom: 20, left: 10 }}>
                <defs>
                  <linearGradient id="quantileFan" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0071e3" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#0071e3" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f4" />
                <XAxis 
                  dataKey="day" 
                  tick={{ fontSize: 11, fill: '#6e6e73' }}
                  label={{ value: 'Simulation Test Day (1577 - 1941)', position: 'insideBottom', offset: -10, fontSize: 11, fill: '#86868b' }}
                />
                <YAxis 
                  tick={{ fontSize: 11, fill: '#6e6e73' }}
                  label={{ value: 'Units (Protection Period Demand)', angle: -90, position: 'insideLeft', offset: 0, fontSize: 11, fill: '#86868b' }}
                />
                <Tooltip 
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload;
                      return (
                        <div className="bg-[#ffffff] p-3 rounded-lg shadow-apple-card border border-[#e8e8ed] text-xs space-y-1">
                          <p className="font-semibold text-[#1d1d1f]">Day {label}</p>
                          <p className="text-[#1d1d1f] font-medium">Actual Demand: {d.actual}</p>
                          <div className="pt-1 border-t border-[#f0f0f4] text-[#6e6e73] space-y-0.5">
                            <p>q_0.95 (Peak): {Number(d['q_0.95'] || 0).toFixed(2)}</p>
                            <p>q_0.90: {Number(d['q_0.90'] || 0).toFixed(2)}</p>
                            <p>q_0.75: {Number(d['q_0.75'] || 0).toFixed(2)}</p>
                            <p className="text-[#0071e3] font-medium">q_0.50 (Median): {Number(d['q_0.50'] || 0).toFixed(2)}</p>
                            <p>q_0.25: {Number(d['q_0.25'] || 0).toFixed(2)}</p>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="q_0.95" 
                  stroke="#93c5fd" 
                  strokeWidth={1}
                  fill="url(#quantileFan)" 
                  name="q_0.95"
                />
                <Area 
                  type="monotone" 
                  dataKey="q_0.75" 
                  stroke="#60a5fa" 
                  strokeWidth={1}
                  fill="#0071e3" 
                  fillOpacity={0.08}
                  name="q_0.75"
                />
                <Line 
                  type="monotone" 
                  dataKey="q_0.50" 
                  stroke="#0071e3" 
                  strokeWidth={2} 
                  dot={false}
                  name="Median Forecast"
                />
                <Line 
                  type="stepAfter" 
                  dataKey="actual" 
                  stroke="#1d1d1f" 
                  strokeWidth={1.5} 
                  dot={{ r: 2, fill: '#1d1d1f' }}
                  name="Actual Demand"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="text-[11px] text-[#86868b] text-center pt-2 border-t border-[#f0f0f4]">
          Under the Tuning Policy (TU), inventory order-up-to fractiles adapt to cost parameters rather than fixing to nominal critical ratio.
        </div>
      </div>

      {/* Model Architectures & Diagnostic Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {models.map((m) => {
          const isSelected = selectedMethod === m.name.slice(0, 2);
          return (
            <div 
              key={m.name} 
              onClick={() => setSelectedMethod(m.name.slice(0, 2))}
              className={`card-apple p-4 cursor-pointer transition-all border ${
                isSelected 
                  ? 'border-[#0071e3] ring-1 ring-[#0071e3]/20 bg-[#f0f7ff]/20' 
                  : 'hover:border-[#d2d2d7]'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm text-[#1d1d1f]">{m.name}</span>
                {isSelected && <CheckCircle2 className="w-4 h-4 text-[#0071e3]" />}
              </div>
              <p className="text-xs text-[#0071e3] font-medium mt-0.5">{m.type}</p>
              <p className="text-[11px] text-[#6e6e73] mt-2 leading-relaxed">{m.features}</p>
              
              <div className="mt-3 pt-3 border-t border-[#f0f0f4] flex items-center justify-between text-xs">
                <span className="text-[#86868b]">Empirical Role:</span>
                <span className="font-medium text-[#1d1d1f]">{m.role}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
