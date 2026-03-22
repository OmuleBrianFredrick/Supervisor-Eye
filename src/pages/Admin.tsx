import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  ShieldCheck, 
  Settings as SettingsIcon, 
  Database, 
  Lock, 
  Globe, 
  Save, 
  RefreshCw,
  AlertCircle,
  Copy,
  Check,
  Webhook as WebhookIcon,
  Trash2,
  Plus
} from 'lucide-react';
import { auth, db } from '../firebase';
import { doc, getDoc, updateDoc, collection, addDoc, getDocs, deleteDoc, query, where } from 'firebase/firestore';
import { getUserProfile, logAudit } from '../services/firebaseService';
import { UserProfile, Organization, Webhook } from '../types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function Admin() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [org, setOrg] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Form State
  const [orgName, setOrgName] = useState('');
  const [gpsEnabled, setGpsEnabled] = useState(true);
  const [localStorage, setLocalStorage] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'webhooks'>('general');

  // Webhooks State
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [newWebhookUrl, setNewWebhookUrl] = useState('');
  const [isAddingWebhook, setIsAddingWebhook] = useState(false);

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged(async (authUser) => {
      if (authUser) {
        const profile = await getUserProfile(authUser.uid);
        setUser(profile);
        if (profile) {
          const orgDoc = await getDoc(doc(db, 'organizations', profile.orgId));
          if (orgDoc.exists()) {
            const orgData = { id: orgDoc.id, ...orgDoc.data() } as Organization;
            setOrg(orgData);
            setOrgName(orgData.name);
            setGpsEnabled(orgData.settings.gpsEnabled);
            setLocalStorage(orgData.settings.localStorage);
            
            // Fetch webhooks
            const webhooksSnap = await getDocs(query(collection(db, 'webhooks'), where('orgId', '==', profile.orgId)));
            setWebhooks(webhooksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Webhook)));
          }
          setLoading(false);
        }
      }
    });
    return () => unsubscribeAuth();
  }, []);

  const handleAddWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newWebhookUrl) return;

    try {
      const webhookData = {
        orgId: user.orgId,
        url: newWebhookUrl,
        events: ['report_submitted', 'task_created', 'report_approved'],
        active: true,
        createdAt: new Date().toISOString()
      };
      const docRef = await addDoc(collection(db, 'webhooks'), webhookData);
      setWebhooks([...webhooks, { id: docRef.id, ...webhookData }]);
      setNewWebhookUrl('');
      setIsAddingWebhook(false);
      await logAudit('webhook:created', docRef.id, user.orgId, { url: newWebhookUrl });
    } catch (error) {
      console.error('Error adding webhook:', error);
    }
  };

  const handleDeleteWebhook = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'webhooks', id));
      setWebhooks(webhooks.filter(w => w.id !== id));
      await logAudit('webhook:deleted', id, user?.orgId || '', {});
    } catch (error) {
      console.error('Error deleting webhook:', error);
    }
  };

  const handleSaveSettings = async () => {
    if (!user || !org) return;
    setSaving(true);
    setSaveSuccess(false);
    try {
      await updateDoc(doc(db, 'organizations', org.id), {
        name: orgName,
        settings: {
          gpsEnabled,
          localStorage
        }
      });
      await logAudit('org:settings_updated', org.id, org.id, { orgName, gpsEnabled, localStorage });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const copyCode = () => {
    if (org?.code) {
      navigator.clipboard.writeText(org.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) return <div className="p-8 text-center">Loading admin panel...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Organization Administration</h1>
        <p className="text-slate-500 dark:text-slate-400">Manage system-wide settings and organization configuration.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Sidebar Navigation */}
        <div className="space-y-2">
          <button 
            onClick={() => setActiveTab('general')}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-all",
              activeTab === 'general' ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            )}
          >
            <Building2 className="w-5 h-5" />
            General Settings
          </button>
          <button 
            onClick={() => setActiveTab('webhooks')}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-all",
              activeTab === 'webhooks' ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            )}
          >
            <WebhookIcon className="w-5 h-5" />
            Webhooks & API
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl font-medium transition-all">
            <Lock className="w-5 h-5" />
            Security & Roles
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl font-medium transition-all">
            <Database className="w-5 h-5" />
            Storage & Data
          </button>
        </div>

        {/* Main Content */}
        <div className="md:col-span-2 space-y-8">
          {activeTab === 'general' ? (
            <>
              {/* Organization Info */}
              <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <h3 className="font-bold text-slate-900 dark:text-white mb-6">Organization Details</h3>
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Organization Name</label>
                    <input 
                      type="text" 
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900/30 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Network Join Code</label>
                    <div className="flex gap-2">
                      <div className="flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl font-mono text-lg tracking-widest text-slate-700 dark:text-slate-300 flex items-center justify-center">
                        {org?.code}
                      </div>
                      <button 
                        onClick={copyCode}
                        className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                      >
                        {copied ? <Check className="w-5 h-5 text-emerald-500" /> : <Copy className="w-5 h-5 text-slate-400 dark:text-slate-500" />}
                      </button>
                      <button className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
                        <RefreshCw className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                      </button>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">Share this code with new members to join your organization.</p>
                  </div>
                </div>
              </div>

              {/* System Settings */}
              <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <h3 className="font-bold text-slate-900 dark:text-white mb-6">System Configuration</h3>
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">GPS Location Tracking</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Require GPS coordinates for all report submissions.</p>
                    </div>
                    <button 
                      onClick={() => setGpsEnabled(!gpsEnabled)}
                      className={cn(
                        "w-12 h-6 rounded-full transition-all relative",
                        gpsEnabled ? "bg-indigo-600" : "bg-slate-200 dark:bg-slate-700"
                      )}
                    >
                      <div className={cn(
                        "w-4 h-4 bg-white rounded-full absolute top-1 transition-all",
                        gpsEnabled ? "right-1" : "left-1"
                      )} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">Local Storage Adapter</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Store evidence files on organization's local server instead of cloud.</p>
                    </div>
                    <button 
                      onClick={() => setLocalStorage(!localStorage)}
                      className={cn(
                        "w-12 h-6 rounded-full transition-all relative",
                        localStorage ? "bg-indigo-600" : "bg-slate-200 dark:bg-slate-700"
                      )}
                    >
                      <div className={cn(
                        "w-4 h-4 bg-white rounded-full absolute top-1 transition-all",
                        localStorage ? "right-1" : "left-1"
                      )} />
                    </button>
                  </div>

                  <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/30 rounded-xl flex gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                    <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
                      <span className="font-bold">Important:</span> Enabling Local Storage requires the Supervisor Eye Local Agent to be installed on your organization's network.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-4">
                {saveSuccess && (
                  <span className="text-sm text-emerald-600 dark:text-emerald-400 font-bold animate-pulse">
                    Settings saved successfully!
                  </span>
                )}
                <button 
                  onClick={handleSaveSettings}
                  disabled={saving}
                  className="flex items-center gap-2 bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 dark:shadow-none disabled:opacity-50"
                >
                  <Save className="w-5 h-5" />
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </>
          ) : (
            <div className="space-y-6">
              <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-bold text-slate-900 dark:text-white">Outgoing Webhooks</h3>
                  <button 
                    onClick={() => setIsAddingWebhook(true)}
                    className="flex items-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-2 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    ADD WEBHOOK
                  </button>
                </div>

                {isAddingWebhook && (
                  <form onSubmit={handleAddWebhook} className="mb-6 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 animate-in slide-in-from-top-2 duration-200">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Target URL</label>
                        <input 
                          required
                          type="url" 
                          value={newWebhookUrl}
                          onChange={(e) => setNewWebhookUrl(e.target.value)}
                          placeholder="https://hooks.slack.com/services/..."
                          className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:border-indigo-500 outline-none text-sm"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button 
                          type="submit"
                          className="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-xs font-bold hover:bg-indigo-700 transition-all"
                        >
                          SAVE WEBHOOK
                        </button>
                        <button 
                          type="button"
                          onClick={() => setIsAddingWebhook(false)}
                          className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 py-2 rounded-lg text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                        >
                          CANCEL
                        </button>
                      </div>
                    </div>
                  </form>
                )}

                <div className="space-y-4">
                  {webhooks.length === 0 ? (
                    <div className="text-center py-8">
                      <WebhookIcon className="w-10 h-10 text-slate-200 dark:text-slate-800 mx-auto mb-2" />
                      <p className="text-sm text-slate-500 dark:text-slate-400">No webhooks configured.</p>
                    </div>
                  ) : (
                    webhooks.map((webhook) => (
                      <div key={webhook.id} className="flex items-center justify-between p-4 border border-slate-100 dark:border-slate-800 rounded-xl hover:border-indigo-100 dark:hover:border-indigo-900/30 transition-all group">
                        <div className="flex items-center gap-4">
                          <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/50 transition-all">
                            <Globe className="w-5 h-5 text-slate-400 dark:text-slate-500 group-hover:text-indigo-600 dark:group-hover:text-indigo-400" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-[200px]">{webhook.url}</p>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase">EVENTS: {webhook.events.join(', ')}</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => handleDeleteWebhook(webhook.id)}
                          className="p-2 text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="bg-slate-900 dark:bg-slate-950 p-6 rounded-2xl text-white border border-slate-800">
                <h4 className="text-sm font-bold mb-2 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  API Documentation
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed mb-4">
                  Use your organization ID and join code to authenticate external requests. 
                  Incoming API support is currently in restricted beta.
                </p>
                <div className="bg-black/40 p-3 rounded-lg font-mono text-[10px] text-emerald-400 overflow-x-auto">
                  curl -X POST https://ais-dev.../api/v1/reports \<br/>
                  &nbsp;&nbsp;-H "X-Org-ID: {org?.id}" \<br/>
                  &nbsp;&nbsp;-H "X-Join-Code: {org?.code}"
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
