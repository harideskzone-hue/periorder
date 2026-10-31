import React, { useState, useEffect } from 'react';
import { AppMode, NavigationTab, StoreInfo, ShopOnboardingProfile } from './types';
import { AppShell } from './components/layout/AppShell';
import { fetchStores } from './services/api';

// Core Store Manager Views
import { StoreManagerHome } from './components/StoreManagerHome';
import { MyInventory } from './components/MyInventory';
import { WhatShouldIOrder } from './components/WhatShouldIOrder';
import { DemandOutlook } from './components/DemandOutlook';
import { StoreReports } from './components/StoreReports';
import { POSIntegration } from './components/POSIntegration';

// Smart Shop AI Views
import { BillUploadCenter } from './components/BillUploadCenter';
import { SalesProfitView } from './components/SalesProfitView';
import { MarketResearchView } from './components/MarketResearchView';
import { AlertsCenterView } from './components/AlertsCenterView';
import { SuppliersView } from './components/SuppliersView';
import { ShopSettingsView } from './components/ShopSettingsView';
import { ShopOnboardingWizard } from './components/ShopOnboardingWizard';
import { ProductAnalyticsModal } from './components/ProductAnalyticsModal';

// Research & Analytics Views
import { ExecutiveDashboard } from './components/ExecutiveDashboard';
import { DemandForecasting } from './components/DemandForecasting';
import { InventoryMonitoring } from './components/InventoryMonitoring';
import { PolicyComparison } from './components/PolicyComparison';
import { SimulationLab } from './components/SimulationLab';
import { ResearchResults } from './components/ResearchResults';

const DEFAULT_STORE: StoreInfo = {
  store_id: 'CA_1',
  tenant_id: 'tenant_default',
  store_name: 'Downtown Central (CA_1)',
  location: 'Los Angeles, CA',
  pos_connected: true,
  pos_provider: 'generic_mock',
};

export const App: React.FC = () => {
  // Store Manager is the default experience
  const [mode, setMode] = useState<AppMode>('store-manager');
  const [currentTab, setCurrentTab] = useState<NavigationTab>('home');

  // Multi-Store State
  const [stores, setStores] = useState<StoreInfo[]>([DEFAULT_STORE]);
  const [activeStore, setActiveStore] = useState<StoreInfo>(() => {
    const savedId = localStorage.getItem('periorder_active_store_id');
    return savedId ? { ...DEFAULT_STORE, store_id: savedId } : DEFAULT_STORE;
  });

  // Smart Shop AI Modals State
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [selectedProductIdForAnalytics, setSelectedProductIdForAnalytics] = useState<string | null>(null);

  useEffect(() => {
    fetchStores('tenant_default')
      .then((res) => {
        if (res.stores && res.stores.length > 0) {
          setStores(res.stores);
          const savedId = localStorage.getItem('periorder_active_store_id');
          const matched = res.stores.find((s) => s.store_id === savedId) || res.stores[0];
          setActiveStore(matched);
        }
      })
      .catch((err) => console.warn('Could not load stores from API:', err));
  }, []);

  const handleSelectStore = (store: StoreInfo) => {
    setActiveStore(store);
    localStorage.setItem('periorder_active_store_id', store.store_id);
  };

  const handleStoreCreated = (newStore: StoreInfo) => {
    setStores((prev) => {
      const exists = prev.some((s) => s.store_id === newStore.store_id);
      return exists ? prev : [...prev, newStore];
    });
    setActiveStore(newStore);
    localStorage.setItem('periorder_active_store_id', newStore.store_id);
  };

  const handleModeChange = (newMode: AppMode) => {
    setMode(newMode);
    setCurrentTab(newMode === 'store-manager' ? 'home' : 'executive');
  };

  const handleLaunchOnboarding = () => {
    setIsOnboardingOpen(true);
  };

  const handleOnboardingCompleted = (profile: ShopOnboardingProfile, store?: StoreInfo) => {
    setIsOnboardingOpen(false);
    if (store) {
      setStores((prev) => {
        const exists = prev.some((s) => s.store_id === store.store_id);
        return exists ? prev.map((s) => (s.store_id === store.store_id ? store : s)) : [...prev, store];
      });
      setActiveStore(store);
      localStorage.setItem('periorder_active_store_id', store.store_id);
    } else {
      setActiveStore((prev) => ({
        ...prev,
        store_name: profile.shop_name,
        location: profile.location,
      }));
    }
    // Switch to Dashboard to see the freshly initialized store
    setCurrentTab('home');
  };

  const handleOpenProductAnalytics = (productId: string) => {
    setSelectedProductIdForAnalytics(productId);
  };

  const handleCloseProductAnalytics = () => {
    setSelectedProductIdForAnalytics(null);
  };

  return (
    <>
      <AppShell
        mode={mode}
        onModeChange={handleModeChange}
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        currentStore={activeStore}
        stores={stores}
        onSelectStore={handleSelectStore}
        onStoreCreated={handleStoreCreated}
        onLaunchOnboarding={handleLaunchOnboarding}
      >
        {mode === 'store-manager' ? (
          <>
            {currentTab === 'home' && (
              <StoreManagerHome
                storeId={activeStore.store_id}
                storeName={activeStore.store_name}
                location={activeStore.location}
                onNavigateToOrders={() => setCurrentTab('orders')}
                onNavigateToInventory={() => setCurrentTab('inventory')}
                onNavigateToReports={() => setCurrentTab('reports')}
                onNavigateToPOS={() => setCurrentTab('pos')}
              />
            )}
            {currentTab === 'inventory' && (
              <MyInventory
                storeId={activeStore.store_id}
                storeName={activeStore.store_name}
                onReorderProduct={() => setCurrentTab('orders')}
                onSelectProductForDeepDive={handleOpenProductAnalytics}
              />
            )}
            {currentTab === 'bills' && (
              <BillUploadCenter
                storeId={activeStore.store_id}
                storeName={activeStore.store_name}
                onInventoryUpdated={() => {
                  // After bill committed, user can view inventory
                }}
              />
            )}
            {currentTab === 'sales-profit' && (
              <SalesProfitView
                storeId={activeStore.store_id}
                storeName={activeStore.store_name}
                onSelectProduct={(name) => handleOpenProductAnalytics('FOODS_3_090_CA_1')}
              />
            )}
            {currentTab === 'market-research' && (
              <MarketResearchView
                storeId={activeStore.store_id}
                storeName={activeStore.store_name}
                onSelectProductForDeepDive={handleOpenProductAnalytics}
              />
            )}
            {currentTab === 'orders' && (
              <WhatShouldIOrder
                storeId={activeStore.store_id}
                storeName={activeStore.store_name}
              />
            )}
            {currentTab === 'outlook' && (
              <DemandOutlook
                storeId={activeStore.store_id}
                storeName={activeStore.store_name}
              />
            )}
            {currentTab === 'alerts' && (
              <AlertsCenterView
                storeId={activeStore.store_id}
                storeName={activeStore.store_name}
                onNavigateToOrders={() => setCurrentTab('orders')}
                onOpenProductAnalytics={handleOpenProductAnalytics}
              />
            )}
            {currentTab === 'suppliers' && (
              <SuppliersView
                storeId={activeStore.store_id}
                storeName={activeStore.store_name}
                onPlaceOrder={() => setCurrentTab('orders')}
              />
            )}
            {currentTab === 'pos' && (
              <POSIntegration
                storeId={activeStore.store_id}
                storeName={activeStore.store_name}
              />
            )}
            {currentTab === 'reports' && (
              <StoreReports
                storeId={activeStore.store_id}
                storeName={activeStore.store_name}
              />
            )}
            {currentTab === 'settings' && (
              <ShopSettingsView
                currentStore={activeStore}
                onLaunchOnboarding={handleLaunchOnboarding}
                onProfileUpdated={(prof) => {
                  setActiveStore((prev) => ({
                    ...prev,
                    store_name: prof.shop_name,
                    location: prof.location,
                  }));
                }}
              />
            )}
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

      {/* Onboarding Wizard Modal */}
      <ShopOnboardingWizard
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
        storeId={activeStore.store_id}
        storeName={activeStore.store_name}
        onCompleted={handleOnboardingCompleted}
      />

      {/* Product Deep-Dive Analytics Modal */}
      {selectedProductIdForAnalytics && (
        <ProductAnalyticsModal
          productId={selectedProductIdForAnalytics}
          storeId={activeStore.store_id}
          onClose={handleCloseProductAnalytics}
          onReorder={(sku, qty) => {
            setCurrentTab('orders');
          }}
        />
      )}
    </>
  );
};

export default App;
