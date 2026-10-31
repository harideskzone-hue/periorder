import React, { useState } from 'react';
import { AppMode, NavigationTab, StoreManagerTab, ResearchTab, StoreInfo } from '../../types';
import { StoreSwitcher } from './StoreSwitcher';
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
  Menu,
  X,
  Info,
  CheckCircle2,
  ChevronRight,
  ShieldCheck,
  AlertCircle,
  Zap
} from 'lucide-react';

interface AppShellProps {
  mode: AppMode;
  onModeChange: (mode: AppMode) => void;
  currentTab: NavigationTab;
  onTabChange: (tab: NavigationTab) => void;
  currentStore: StoreInfo;
  stores: StoreInfo[];
  onSelectStore: (store: StoreInfo) => void;
  onStoreCreated: (store: StoreInfo) => void;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  mode,
  onModeChange,
  currentTab,
  onTabChange,
  currentStore,
  stores,
  onSelectStore,
  onStoreCreated,
  children,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Store Manager Navigation items
  const storeNavItems: { id: StoreManagerTab; label: string; icon: React.ReactNode; badge?: string }[] = [
    { id: 'home', label: 'Home', icon: <Home className="w-4 h-4" /> },
    { id: 'inventory', label: 'My Inventory', icon: <Package className="w-4 h-4" /> },
    { id: 'orders', label: 'Order Suggestions', icon: <ShoppingCart className="w-4 h-4" />, badge: '8' },
    { id: 'outlook', label: 'Demand Outlook', icon: <TrendingUp className="w-4 h-4" /> },
    { id: 'reports', label: 'Reports', icon: <FileText className="w-4 h-4" /> },
    { id: 'pos', label: 'POS Integration', icon: <Zap className="w-4 h-4" />, badge: 'Live' },
  ];

  // Research Navigation items
  const researchNavItems: { id: ResearchTab; label: string; icon: React.ReactNode }[] = [
    { id: 'executive', label: 'Executive Benchmark', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'forecasting', label: 'Demand Forecasting', icon: <TrendingUp className="w-4 h-4" /> },
    { id: 'monitoring', label: 'Pipeline Monitoring', icon: <Activity className="w-4 h-4" /> },
    { id: 'policy', label: 'Policy Comparison', icon: <GitCompare className="w-4 h-4" /> },
    { id: 'simulation', label: 'Simulation Lab', icon: <FlaskConical className="w-4 h-4" /> },
    { id: 'research', label: 'Hypotheses & Tests', icon: <BookOpenCheck className="w-4 h-4" /> },
  ];

  const currentNavItems = mode === 'store-manager' ? storeNavItems : researchNavItems;

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col md:flex-row font-sans">
      {/* =========================================================================
          Desktop Left Sidebar (Compact, Task-Oriented)
         ========================================================================= */}
      <aside className="hidden md:flex flex-col w-64 bg-[#FFFFFF] border-r border-[#E2E8F0] h-screen sticky top-0 z-30 shadow-subtle">
        {/* Brand Header */}
        <div className="p-5 border-b border-[#F1F5F9]">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#2563EB] text-white flex items-center justify-center shadow-sm">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="font-bold text-base tracking-tight text-[#0F172A]">
                  PeriOrder
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]">
                  v1.0
                </span>
              </div>
              <p className="text-[11px] text-[#64748B] leading-tight mt-0.5 font-medium">
                Your inventory. Under control.
              </p>
            </div>
          </div>

          {/* Store Location Badge */}
          <div className="mt-3.5 p-2 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-between text-xs">
            <div className="flex items-center space-x-1.5 text-[#334155] min-w-0">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  currentStore.pos_connected ? 'bg-[#16A34A]' : 'bg-[#94A3B8]'
                }`}
              />
              <span className="font-semibold truncate">{currentStore.store_name}</span>
            </div>
            <span className="text-[10px] text-[#64748B] font-mono shrink-0 ml-1">
              {currentStore.store_id}
            </span>
          </div>
        </div>

        {/* Experience Mode Toggle Switcher */}
        <div className="px-4 py-3 bg-[#F8FAFC] border-b border-[#F1F5F9]">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[#64748B] mb-1.5">
            Experience Mode
          </div>
          <div className="grid grid-cols-2 gap-1 bg-[#E2E8F0] p-1 rounded-xl">
            <button
              onClick={() => {
                onModeChange('store-manager');
                onTabChange('home');
              }}
              className={`flex items-center justify-center space-x-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                mode === 'store-manager'
                  ? 'bg-white text-[#2563EB] shadow-subtle'
                  : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              <Store className="w-3.5 h-3.5" />
              <span>Store</span>
            </button>
            <button
              onClick={() => {
                onModeChange('research');
                onTabChange('executive');
              }}
              className={`flex items-center justify-center space-x-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                mode === 'research'
                  ? 'bg-white text-[#2563EB] shadow-subtle'
                  : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              <FlaskConical className="w-3.5 h-3.5" />
              <span>Research</span>
            </button>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8] px-3 mb-2">
            {mode === 'store-manager' ? 'Daily Store Workflow' : 'Research & Analytics'}
          </div>

          {currentNavItems.map((item) => {
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-[#EFF6FF] text-[#2563EB] font-bold shadow-subtle'
                    : 'text-[#475569] hover:text-[#0F172A] hover:bg-[#F1F5F9]'
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  <span className={isActive ? 'text-[#2563EB]' : 'text-[#64748B]'}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </div>
                {'badge' in item && item.badge && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#DC2626] text-white">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Mode Switch Shortcut Footer */}
        <div className="p-4 border-t border-[#F1F5F9] bg-[#FFFFFF]">
          {mode === 'store-manager' ? (
            <button
              onClick={() => {
                onModeChange('research');
                onTabChange('executive');
              }}
              className="w-full py-2 px-3 rounded-lg border border-[#E2E8F0] hover:bg-[#F8FAFC] text-[11px] font-medium text-[#475569] flex items-center justify-between transition-colors"
            >
              <span className="flex items-center space-x-1.5">
                <FlaskConical className="w-3.5 h-3.5 text-[#2563EB]" />
                <span>Switch to Research Mode</span>
              </span>
              <ChevronRight className="w-3 h-3 text-[#94A3B8]" />
            </button>
          ) : (
            <button
              onClick={() => {
                onModeChange('store-manager');
                onTabChange('home');
              }}
              className="w-full py-2 px-3 rounded-lg border border-[#E2E8F0] hover:bg-[#F8FAFC] text-[11px] font-medium text-[#475569] flex items-center justify-between transition-colors"
            >
              <span className="flex items-center space-x-1.5">
                <Store className="w-3.5 h-3.5 text-[#16A34A]" />
                <span>Return to Store Manager</span>
              </span>
              <ChevronRight className="w-3 h-3 text-[#94A3B8]" />
            </button>
          )}
        </div>
      </aside>

      {/* =========================================================================
          Mobile Header & Bottom Navigation
         ========================================================================= */}
      <header className="md:hidden sticky top-0 z-40 bg-white border-b border-[#E2E8F0] px-4 py-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center space-x-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-[#2563EB] text-white flex items-center justify-center shrink-0">
            <Store className="w-4 h-4" />
          </div>
          <span className="font-bold text-sm text-[#0F172A] truncate">PeriOrder</span>
        </div>

        <div className="flex items-center space-x-2">
          <StoreSwitcher
            currentStore={currentStore}
            stores={stores}
            onSelectStore={onSelectStore}
            onStoreCreated={onStoreCreated}
          />
          <button
            onClick={() => {
              const nextMode = mode === 'store-manager' ? 'research' : 'store-manager';
              onModeChange(nextMode);
              onTabChange(nextMode === 'store-manager' ? 'home' : 'executive');
            }}
            className="px-2 py-1 rounded-lg border border-[#E2E8F0] text-[11px] font-medium text-[#2563EB] bg-[#EFF6FF] shrink-0"
          >
            {mode === 'store-manager' ? 'Research' : 'Store'}
          </button>
        </div>
      </header>

      {/* =========================================================================
          Main Content Container
         ========================================================================= */}
      <div className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0">
        {/* Top Header Navigation Bar with Store Switcher & Integrity Badges */}
        <header className="bg-[#FFFFFF] border-b border-[#E2E8F0] px-4 sm:px-6 lg:px-8 py-2.5 hidden md:flex items-center justify-between text-xs gap-3 shadow-2xs">
          <div className="flex items-center space-x-3">
            <StoreSwitcher
              currentStore={currentStore}
              stores={stores}
              onSelectStore={onSelectStore}
              onStoreCreated={onStoreCreated}
            />
            <div className="flex items-center space-x-2 text-[#475569] pl-3 border-l border-[#E2E8F0]">
              <span className="font-semibold text-[#0F172A]">Current View:</span>
              <span className="px-2 py-0.5 rounded-full font-medium bg-[#F1F5F9] text-[#334155]">
                {mode === 'store-manager' ? 'Store Manager (Operations)' : 'Research & Analytics (Empirical)'}
              </span>
            </div>
          </div>

          {/* Honest Data Origin Labeling */}
          <div className="flex items-center space-x-2">
            {mode === 'store-manager' ? (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A]">
                <Info className="w-3.5 h-3.5 mr-1 text-[#D97706]" />
                Illustrative Store Demonstration (M5 Sales Data)
              </span>
            ) : (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#F0FDF4] text-[#166534] border border-[#BBF7D0]">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-[#16A34A]" />
                Empirically Verified Results (356/355 Scored Days)
              </span>
            )}
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </main>

        {/* Footer */}
        <footer className="border-t border-[#E2E8F0] bg-[#FFFFFF] py-4 px-4 sm:px-6 lg:px-8 text-xs text-[#64748B]">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
            <p>
              <strong>PeriOrder</strong> · Your inventory. Under control. · {mode === 'store-manager' ? 'Store Manager Experience' : 'Advanced Research Experience'}
            </p>
            <p className="text-[11px] text-[#94A3B8]">
              FIFO Simulation &amp; Quantile Regression Engine · Scored Horizon: 356d (ℓ=2) · 355d (ℓ=3)
            </p>
          </div>
        </footer>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-[#E2E8F0] px-2 py-1.5 flex justify-around z-40 shadow-lg">
        {currentNavItems.slice(0, 5).map((item) => {
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`flex flex-col items-center py-1 px-2 rounded-lg text-[10px] font-medium ${
                isActive ? 'text-[#2563EB] font-bold' : 'text-[#64748B]'
              }`}
            >
              {item.icon}
              <span className="mt-0.5 truncate max-w-[64px]">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
