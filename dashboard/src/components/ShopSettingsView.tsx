import React, { useState, useEffect } from 'react';
import { ShopOnboardingProfile, StoreInfo } from '../types';
import { fetchOnboardingProfile, saveOnboardingProfile } from '../services/api';
import {
  Settings,
  Store,
  User,
  MapPin,
  Phone,
  Mail,
  Calendar,
  Save,
  RefreshCw,
  Zap,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';

interface ShopSettingsViewProps {
  currentStore: StoreInfo;
  onLaunchOnboarding: () => void;
  onProfileUpdated?: (profile: ShopOnboardingProfile) => void;
}

export const ShopSettingsView: React.FC<ShopSettingsViewProps> = ({
  currentStore,
  onLaunchOnboarding,
  onProfileUpdated,
}) => {
  const [profile, setProfile] = useState<ShopOnboardingProfile>({
    shop_name: currentStore.store_name,
    owner_name: 'Shop Owner',
    location: currentStore.location,
    contact_phone: '+91 98450 12345',
    contact_email: 'store@example.com',
    category: 'Grocery Store',
    shop_type: 'existing',
    opening_date: '2022-01-15',
    status: 'completed',
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchOnboardingProfile('tenant_default', currentStore.store_id)
      .then((res) => {
        setProfile(res);
      })
      .catch((err) => console.warn('Could not fetch onboarding profile:', err))
      .finally(() => setLoading(false));
  }, [currentStore.store_id]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccess(null);
    try {
      const res = await saveOnboardingProfile(profile, 'tenant_default', currentStore.store_id);
      setSuccess('Shop settings and profile successfully updated!');
      if (onProfileUpdated) {
        onProfileUpdated(res.profile);
      }
    } catch (err: any) {
      console.error(err);
      alert('Failed to save profile: ' + (err.message || 'Server error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header Banner */}
      <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-1.5 rounded-lg bg-slate-100 text-slate-700">
              <Settings className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Shop Configuration & Profile Settings
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Manage your shop identity, category parameters, operating details, and connected POS software.
          </p>
        </div>

        <button
          onClick={onLaunchOnboarding}
          className="px-4 py-2 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-semibold flex items-center space-x-1.5 transition-colors self-start md:self-auto border border-blue-200"
        >
          <Sparkles className="w-4 h-4 text-blue-600" />
          <span>Launch Onboarding Wizard</span>
        </button>
      </div>

      {success && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center space-x-2 shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* POS Gateway Connection Status */}
      <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-white shadow-xs ${
              currentStore.pos_connected ? 'bg-emerald-600' : 'bg-slate-400'
            }`}
          >
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-bold text-slate-900">
                POS Gateway Integration: {currentStore.pos_provider || 'Generic Webhook'}
              </h3>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  currentStore.pos_connected
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {currentStore.pos_connected ? 'Active Live Sync' : 'Disconnected'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Sales transactions are received automatically and deduct shelf inventory in real time.
            </p>
          </div>
        </div>

        <span className="text-xs text-slate-400 font-mono">Store ID: {currentStore.store_id}</span>
      </div>

      {/* Profile Form */}
      <form onSubmit={handleSave} className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6">
        <div className="border-b border-slate-100 pb-3">
          <h2 className="text-sm font-bold text-slate-900">General Shop Information</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            These parameters tune the AI demand forecasting and wholesale Mandi benchmarks for your specific market.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Shop Name</label>
            <div className="relative">
              <Store className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                required
                value={profile.shop_name}
                onChange={(e) => setProfile({ ...profile, shop_name: e.target.value })}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-blue-500 font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Owner Name</label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                required
                value={profile.owner_name}
                onChange={(e) => setProfile({ ...profile, owner_name: e.target.value })}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-blue-500 font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Store Category</label>
            <select
              value={profile.category}
              onChange={(e) => setProfile({ ...profile, category: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-blue-500 font-medium"
            >
              <option value="Grocery Store">Grocery Store / Kirana</option>
              <option value="Fruit & Vegetable Shop">Fruit & Vegetable Shop</option>
              <option value="Medical Shop">Medical Shop / Pharmacy</option>
              <option value="Clothing Store">Clothing Store / Boutique</option>
              <option value="Other">Other Retail Business</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Location / City</label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                required
                value={profile.location}
                onChange={(e) => setProfile({ ...profile, location: e.target.value })}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-blue-500 font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Contact Phone</label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="tel"
                value={profile.contact_phone || ''}
                onChange={(e) => setProfile({ ...profile, contact_phone: e.target.value })}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-blue-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Contact Email</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="email"
                value={profile.contact_email || ''}
                onChange={(e) => setProfile({ ...profile, contact_email: e.target.value })}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 flex items-center justify-end space-x-3">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs flex items-center space-x-1.5 transition-colors disabled:opacity-50"
          >
            {saving ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>Save Settings</span>
          </button>
        </div>
      </form>
    </div>
  );
};
