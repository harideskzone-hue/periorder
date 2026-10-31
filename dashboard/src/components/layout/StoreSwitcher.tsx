import React, { useState, useRef, useEffect } from 'react';
import { StoreInfo } from '../../types';
import { createStoreAPI, selectStoreAPI } from '../../services/api';
import { 
  Store, 
  ChevronDown, 
  Check, 
  PlusCircle, 
  MapPin, 
  Zap, 
  ZapOff, 
  X, 
  Loader2,
  Building2,
  AlertCircle
} from 'lucide-react';

interface StoreSwitcherProps {
  currentStore: StoreInfo;
  stores: StoreInfo[];
  onSelectStore: (store: StoreInfo) => void;
  onStoreCreated: (store: StoreInfo) => void;
}

export const StoreSwitcher: React.FC<StoreSwitcherProps> = ({
  currentStore,
  stores,
  onSelectStore,
  onStoreCreated,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // New store form state
  const [newStoreName, setNewStoreName] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newStoreCode, setNewStoreCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = async (store: StoreInfo) => {
    setIsOpen(false);
    try {
      await selectStoreAPI(store.store_id, store.tenant_id);
    } catch (e) {
      console.warn('Backend store select ping failed, switching client-side:', e);
    }
    onSelectStore(store);
  };

  const handleCreateStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStoreName.trim() || !newLocation.trim()) {
      setFormError('Please enter both store branch name and location.');
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    try {
      const res = await createStoreAPI(
        newStoreName.trim(),
        newLocation.trim(),
        newStoreCode.trim() ? newStoreCode.trim().toUpperCase() : undefined
      );
      setIsSubmitting(false);
      setIsModalOpen(false);
      setNewStoreName('');
      setNewLocation('');
      setNewStoreCode('');
      onStoreCreated(res.store);
      onSelectStore(res.store);
    } catch (err: unknown) {
      console.error(err);
      setIsSubmitting(false);
      setFormError(err instanceof Error ? err.message : 'Failed to register store branch.');
    }
  };

  const otherStores = stores.filter((s) => s.store_id !== currentStore.store_id);

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* =========================================================================
          Top Nav Switcher Trigger Button
         ========================================================================= */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2.5 px-3 py-1.5 rounded-xl bg-white hover:bg-[#F8FAFC] border border-[#E2E8F0] shadow-2xs hover:border-[#CBD5E1] transition-all text-left focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <div className="w-8 h-8 rounded-lg bg-[#EFF6FF] border border-[#BFDBFE] flex items-center justify-center text-[#2563EB] shrink-0">
          <Store className="w-4 h-4" />
        </div>

        <div className="flex flex-col min-w-0 pr-1">
          <div className="flex items-center space-x-1.5">
            <span className="text-[10px] uppercase font-bold tracking-wider text-[#64748B]">
              Current Store
            </span>
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                currentStore.pos_connected ? 'bg-[#10B981]' : 'bg-[#94A3B8]'
              }`}
              title={currentStore.pos_connected ? 'POS Connected' : 'POS Disconnected'}
            />
          </div>
          <div className="flex items-center space-x-1">
            <span className="text-xs font-bold text-[#0F172A] truncate max-w-[140px] sm:max-w-[180px]">
              {currentStore.store_name}
            </span>
            <span className="text-[11px] text-[#64748B] font-medium shrink-0">
              · {currentStore.store_id}
            </span>
          </div>
        </div>

        <ChevronDown
          className={`w-4 h-4 text-[#64748B] transition-transform duration-200 shrink-0 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* =========================================================================
          Dropdown Panel
         ========================================================================= */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-88 rounded-2xl bg-white shadow-xl border border-[#E2E8F0] py-2 z-50 text-xs animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Current Store Header Block */}
          <div className="px-4 pt-2 pb-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-2">
              Current Store
            </div>
            <div className="p-3 rounded-xl bg-[#EFF6FF] border border-[#BFDBFE] flex items-start justify-between">
              <div className="flex items-start space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#2563EB] text-white flex items-center justify-center shrink-0 mt-0.5">
                  <Store className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-xs text-[#0F172A]">
                    {currentStore.store_name}
                  </div>
                  <div className="flex items-center space-x-1 text-[11px] text-[#475569] mt-0.5">
                    <span className="font-semibold text-[#2563EB]">{currentStore.store_id}</span>
                    <span>·</span>
                    <span className="flex items-center">
                      <MapPin className="w-3 h-3 text-[#64748B] mr-0.5" />
                      {currentStore.location}
                    </span>
                  </div>
                  <div className="flex items-center space-x-1.5 mt-2">
                    {currentStore.pos_connected ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0]">
                        <Zap className="w-3 h-3 mr-1 text-[#10B981]" />
                        POS Connected ({currentStore.pos_provider || 'Active'})
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F1F5F9] text-[#64748B] border border-[#E2E8F0]">
                        <ZapOff className="w-3 h-3 mr-1 text-[#94A3B8]" />
                        No POS Connection
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="w-5 h-5 rounded-full bg-[#2563EB] text-white flex items-center justify-center shrink-0">
                <Check className="w-3 h-3 stroke-[2.5]" />
              </div>
            </div>
          </div>

          {/* Switch Store Section */}
          <div className="border-t border-[#F1F5F9] px-4 py-2.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-2">
              Switch Store ({otherStores.length})
            </div>

            {otherStores.length === 0 ? (
              <p className="text-[11px] text-[#94A3B8] py-2 italic">
                No other registered stores. Click below to add one.
              </p>
            ) : (
              <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
                {otherStores.map((store) => (
                  <button
                    key={store.store_id}
                    onClick={() => handleSelect(store)}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-[#F8FAFC] border border-transparent hover:border-[#E2E8F0] transition-colors text-left group"
                  >
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-[#F1F5F9] group-hover:bg-[#EFF6FF] text-[#64748B] group-hover:text-[#2563EB] flex items-center justify-center shrink-0 transition-colors">
                        <Store className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-xs text-[#0F172A] group-hover:text-[#2563EB] truncate">
                          {store.store_name}
                        </div>
                        <div className="flex items-center space-x-1 text-[11px] text-[#64748B] truncate">
                          <MapPin className="w-3 h-3 text-[#94A3B8] shrink-0" />
                          <span className="truncate">{store.location}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1.5 shrink-0 ml-2">
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#F1F5F9] text-[#475569] border border-[#E2E8F0]">
                        {store.store_id}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Add Another Store Action Footer */}
          <div className="border-t border-[#F1F5F9] px-4 pt-2.5 pb-1">
            <button
              onClick={() => {
                setIsOpen(false);
                setIsModalOpen(true);
              }}
              className="w-full flex items-center justify-center space-x-2 py-2 px-3 rounded-xl bg-[#F8FAFC] hover:bg-[#EFF6FF] border border-[#E2E8F0] hover:border-[#BFDBFE] text-xs font-semibold text-[#2563EB] transition-colors"
            >
              <PlusCircle className="w-4 h-4 text-[#2563EB]" />
              <span>Add another store</span>
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          Modal: Register New Store Branch
         ========================================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-[#E2E8F0] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-[#F1F5F9] flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[#0F172A]">Register New Store Branch</h3>
                  <p className="text-[11px] text-[#64748B]">Add a grocery branch to your PeriOrder business account</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-7 h-7 rounded-lg hover:bg-[#F1F5F9] flex items-center justify-center text-[#64748B] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateStore} className="p-6 space-y-4 text-xs">
              {formError && (
                <div className="p-3 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-[#DC2626] flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block font-semibold text-[#334155] mb-1">
                  Branch Name <span className="text-[#DC2626]">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Uptown Fresh Market, Westside Grocers"
                  value={newStoreName}
                  onChange={(e) => setNewStoreName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#CBD5E1] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] text-xs text-[#0F172A]"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-[#334155] mb-1">
                  Location (City, State / Region) <span className="text-[#DC2626]">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. San Francisco, CA or Austin, TX"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#CBD5E1] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] text-xs text-[#0F172A]"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-[#334155] mb-1">
                  Store Code / Identifier <span className="text-[#94A3B8] font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. CA_2, TX_2 (leave blank to auto-generate)"
                  value={newStoreCode}
                  onChange={(e) => setNewStoreCode(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#CBD5E1] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] text-xs font-mono uppercase text-[#0F172A]"
                />
                <p className="text-[10px] text-[#94A3B8] mt-1">
                  Used for POS sync webhook routing and inventory identification.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[#E2E8F0] text-[#475569] hover:bg-[#F8FAFC] font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold flex items-center space-x-1.5 transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Registering...</span>
                    </>
                  ) : (
                    <span>Register Branch</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
