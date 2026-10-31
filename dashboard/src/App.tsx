import React, { useState } from 'react';
import { AppMode, NavigationTab } from './types';
import { AppShell } from './components/layout/AppShell';

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
    <AppShell
      mode={mode}
      onModeChange={handleModeChange}
      currentTab={currentTab}
      onTabChange={setCurrentTab}
    >
      {mode === 'store-manager' ? (
        <>
          {currentTab === 'home' && (
            <StoreManagerHome
              onNavigateToOrders={() => setCurrentTab('orders')}
              onNavigateToInventory={() => setCurrentTab('inventory')}
              onNavigateToReports={() => setCurrentTab('reports')}
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
    </AppShell>
  );
};

export default App;
