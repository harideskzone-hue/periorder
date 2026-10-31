import React from 'react';
import { AppMode, NavigationTab, StoreManagerTab, ResearchTab } from '../types';
import { 
  Store, 
  FlaskConical, 
  Home, 
  Package, 
  ShoppingCart, 
  TrendingUp, 
  FileText, 
  LayoutDashboard, 
  Activity, 
  GitCompare, 
  BookOpenCheck,
  Calendar,
  CheckCircle2,
  Sparkles
} from 'lucide-react';

interface HeaderProps {
  mode: AppMode;
  onModeChange: (mode: AppMode) => void;
  currentTab: NavigationTab;
  onTabChange: (tab: NavigationTab) => void;
}

export const Header: React.FC<HeaderProps> = ({ 
  mode, 
  onModeChange, 
  currentTab, 
  onTabChange 
}) => {
  const storeManagerTabs: { id: StoreManagerTab; label: string; icon: React.ReactNode }[] = [
    { id: 'home', label: 'Home', icon: <Home className="w-4 h-4" /> },
    { id: 'inventory', label: 'My Inventory', icon: <Package className="w-4 h-4" /> },
    { id: 'orders', label: 'What Should I Order?', icon: <ShoppingCart className="w-4 h-4" /> },
    { id: 'outlook', label: 'Demand Outlook', icon: <TrendingUp className="w-4 h-4" /> },
    { id: 'reports', label: 'Reports', icon: <FileText className="w-4 h-4" /> },
  ];

  const researchTabs: { id: ResearchTab; label: string; icon: React.ReactNode }[] = [
    { id: 'executive', label: 'Executive Benchmark', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'forecasting', label: 'Demand Forecasting', icon: <TrendingUp className="w-4 h-4" /> },
    { id: 'monitoring', label: 'Pipeline Monitoring', icon: <Activity className="w-4 h-4" /> },
    { id: 'policy', label: 'Policy Comparison', icon: <GitCompare className="w-4 h-4" /> },
    { id: 'simulation', label: 'Simulation Lab', icon: <FlaskConical className="w-4 h-4" /> },
    { id: 'research', label: 'Hypotheses & Tests', icon: <BookOpenCheck className="w-4 h-4" /> },
  ];

  const activeTabs = mode === 'store-manager' ? storeManagerTabs : researchTabs;

  return (
    <header className="sticky top-0 z-50 bg-[#ffffff]/95 backdrop-blur-md border-b border-[#e8e8ed] shadow-subtle">
      {/* Top Bar with Mode Switcher */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-[#0071e3] text-white flex items-center justify-center shadow-sm">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg tracking-tight text-[#1d1d1f]">
                  PeriOrder
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#f5f5f7] text-[#6e6e73] font-medium border border-[#e8e8ed]">
                  {mode === 'store-manager' ? 'Grocery Operations' : 'Academic Research'}
                </span>
              </div>
              <p className="text-[11px] text-[#86868b] leading-tight">
                {mode === 'store-manager' 
                  ? 'Smart inventory decisions, made simple.' 
                  : 'Probabilistic Forecasting & Cost-Aware Ordering Research'}
              </p>
            </div>
          </div>

          {/* Center Mode Switcher */}
          <div className="flex items-center bg-[#f5f5f7] p-1 rounded-xl border border-[#e8e8ed] shadow-subtle">
            <button
              onClick={() => {
                onModeChange('store-manager');
                onTabChange('home');
              }}
              className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                mode === 'store-manager'
                  ? 'bg-white text-[#0071e3] shadow-subtle'
                  : 'text-[#6e6e73] hover:text-[#1d1d1f]'
              }`}
            >
              <Store className="w-3.5 h-3.5" />
              <span>Store Manager</span>
              <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-[#f0f7ff] text-[#0071e3] border border-[#d0e5ff] font-bold">
                Default
              </span>
            </button>

            <button
              onClick={() => {
                onModeChange('research');
                onTabChange('executive');
              }}
              className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                mode === 'research'
                  ? 'bg-white text-[#0071e3] shadow-subtle'
                  : 'text-[#6e6e73] hover:text-[#1d1d1f]'
              }`}
            >
              <FlaskConical className="w-3.5 h-3.5" />
              <span>Research &amp; Analytics</span>
            </button>
          </div>

          {/* Right Evaluation Status Indicator */}
          <div className="hidden lg:flex items-center space-x-2 text-xs">
            <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-[#f0fdf4] border border-[#bbf7d0] text-[#16a34a]">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#16a34a]" />
              <span className="font-medium">Live Inventory Engine</span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <nav className="flex space-x-1 overflow-x-auto no-scrollbar py-1.5">
          {activeTabs.map((tab) => {
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id as NavigationTab)}
                className={`flex items-center space-x-2 px-3.5 py-2 text-xs font-medium rounded-lg transition-all duration-150 whitespace-nowrap ${
                  isActive
                    ? 'bg-[#f5f5f7] text-[#0071e3] shadow-subtle font-semibold'
                    : 'text-[#6e6e73] hover:text-[#1d1d1f] hover:bg-[#fafafc]'
                }`}
              >
                <span className={isActive ? 'text-[#0071e3]' : 'text-[#86868b]'}>
                  {tab.icon}
                </span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
