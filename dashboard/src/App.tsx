import React, { useState } from 'react';
import { AppMode, NavigationTab } from './types';
import { Header } from './components/Header';

// Store Manager Views
import { StoreManagerHome } from './components/StoreManagerHome';
import { MyInventory } from './components/MyInventory';
import { WhatShouldIOrder } from './components/WhatShouldIOrder';
import { DemandOutlook } from './components/DemandOutlook';
import { StoreReports } from './components/StoreReports';

// Research & Analytics Views
import { ExecutiveDashboard } from './components/ExecutiveDashboard';
import { DemandForecasting } from './components/DemandForecasting';
import { InventoryMonitoring } from './components/InventoryMonitoring';
import { PolicyComparison } from './components/PolicyComparison';
import { SimulationLab } from './components/SimulationLab';
import { ResearchResults } from './components/ResearchResults';

export const App: React.FC = () => {
  // Store Manager is the default experience
  const [mode, setMode] = useState<AppMode>('store-manager');
  const [currentTab, setCurrentTab] = useState<NavigationTab>('home');

  const handleModeChange = (newMode: AppMode) => {
    setMode(newMode);
    setCurrentTab(newMode === 'store-manager' ? 'home' : 'executive');
  };

  return (
    <div className="min-h-screen bg-[#fbfbfd] text-[#1d1d1f] flex flex-col font-sans selection:bg-[#0071e3]/10 selection:text-[#0071e3]">
      {/* Top Header with Dual-Mode Switcher */}
      <Header
        mode={mode}
        onModeChange={handleModeChange}
        currentTab={currentTab}
        onTabChange={setCurrentTab}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {mode === 'store-manager' ? (
          <>
            {currentTab === 'home' && (
              <StoreManagerHome
                onNavigateToOrders={() => setCurrentTab('orders')}
                onNavigateToInventory={() => setCurrentTab('inventory')}
              />
            )}
            {currentTab === 'inventory' && (
              <MyInventory
                onReorderProduct={() => setCurrentTab('orders')}
              />
            )}
            {currentTab === 'orders' && <WhatShouldIOrder />}
            {currentTab === 'outlook' && <DemandOutlook />}
            {currentTab === 'reports' && <StoreReports />}
          </>
        ) : (
          <>
            {currentTab === 'executive' && <ExecutiveDashboard />}
            {currentTab === 'forecasting' && <DemandForecasting />}
            {currentTab === 'monitoring' && <InventoryMonitoring />}
            {currentTab === 'policy' && <PolicyComparison />}
            {currentTab === 'simulation' && <SimulationLab />}
            {currentTab === 'research' && <ResearchResults />}
          </>
        )}
      </main>

      {/* Clean Enterprise Footer */}
      <footer className="mt-auto border-t border-[#e8e8ed] bg-[#ffffff] py-5 text-xs text-[#86868b]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-[#1d1d1f]">PeriOrder</span>
            <span>·</span>
            <span>{mode === 'store-manager' ? 'Store Manager Operations' : 'Academic Research Edition'}</span>
            <span>·</span>
            <span>FIFO Depletion &amp; Probabilistic Forecasts</span>
          </div>

          <div className="flex items-center space-x-3">
            <span>500 Monitored Series</span>
            <span>·</span>
            <span className="text-[#0071e3] font-medium">Scored Days: 356d (ℓ=2) · 355d (ℓ=3)</span>
            <span>·</span>
            <span>LightGBM &amp; Validation Tuning</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
