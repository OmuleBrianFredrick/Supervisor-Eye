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
  Plus,
  LayoutTemplate,
  Image as ImageIcon
} from 'lucide-react';
import { auth, db } from '../firebase';
import { doc, getDoc, updateDoc, collection, addDoc, getDocs, deleteDoc, query, where } from 'firebase/firestore';
import { getUserProfile, logAudit, getPublicContent, updatePublicContent } from '../services/firebaseService';
import { UserProfile, Organization, Webhook, PublicContent } from '../types';
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
  const [localStorageEnabled, setLocalStorageEnabled] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'webhooks' | 'security' | 'storage' | 'public'>('general');

  // Webhooks State
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [newWebhookUrl, setNewWebhookUrl] = useState('');
  const [isAddingWebhook, setIsAddingWebhook] = useState(false);

  // Public Content State
  const [publicContent, setPublicContent] = useState<Partial<PublicContent>>({
    companyName: '',
    description: '',
    activities: [],
    news: [],
    gallery: []
  });
  const [newActivity, setNewActivity] = useState('');
  const [newNewsTitle, setNewNewsTitle] = useState('');
  const [newNewsContent, setNewNewsContent] = useState('');
  const [newGalleryUrl, setNewGalleryUrl] = useState('');
  const [newGalleryCaption, setNewGalleryCaption] = useState('');

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
            setLocalStorageEnabled(orgData.settings.localStorage);
            
            // Fetch webhooks
            const webhooksSnap = await getDocs(query(collection(db, 'webhooks'), where('orgId', '==', profile.orgId)));
            setWebhooks(webhooksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Webhook)));

            // Fetch public content
            const pContent = await getPublicContent();
            if (pContent) {
              setPublicContent(pContent);
            }
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
          localStorage: localStorageEnabled
        }
      });
      await logAudit('org:settings_updated', org.id, org.id, { orgName, gpsEnabled, localStorage: localStorageEnabled });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleSavePublicContent = async () => {
    if (!user) return;
    setSaving(true);
    setSaveSuccess(false);
    try {
      await updatePublicContent(publicContent);
      await logAudit('public_content:updated', 'home', user.orgId, { companyName: publicContent.companyName });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Error saving public content:', error);
    } finally {
      setSaving(false);
    }
  };

  const addActivity = () => {
    if (newActivity.trim()) {
      setPublicContent({
        ...publicContent,
        activities: [...(publicContent.activities || []), newActivity.trim()]
      });
      setNewActivity('');
    }
  };

  const removeActivity = (index: number) => {
    const newActivities = [...(publicContent.activities || [])];
    newActivities.splice(index, 1);
    setPublicContent({ ...publicContent, activities: newActivities });
  };

  const addNews = () => {
    if (newNewsTitle.trim() && newNewsContent.trim()) {
      const newsItem = {
        id: Math.random().toString(36).substring(2, 9),
        title: newNewsTitle.trim(),
        content: newNewsContent.trim(),
        date: new Date().toISOString()
      };
      setPublicContent({
        ...publicContent,
        news: [newsItem, ...(publicContent.news || [])]
      });
      setNewNewsTitle('');
      setNewNewsContent('');
    }
  };

  const removeNews = (id: string) => {
    setPublicContent({
      ...publicContent,
      news: (publicContent.news || []).filter(n => n.id !== id)
    });
  };

  const addGalleryImage = () => {
    if (newGalleryUrl.trim() && newGalleryCaption.trim()) {
      const imageItem = {
        id: Math.random().toString(36).substring(2, 9),
        url: newGalleryUrl.trim(),
        caption: newGalleryCaption.trim()
      };
      setPublicContent({
        ...publicContent,
        gallery: [imageItem, ...(publicContent.gallery || [])]
      });
      setNewGalleryUrl('');
      setNewGalleryCaption('');
    }
  };

  const removeGalleryImage = (id: string) => {
    setPublicContent({
      ...publicContent,
      gallery: (publicContent.gallery || []).filter(g => g.id !== id)
    });
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
        <div className="flex md:flex-col gap-2 overflow-x-auto md:overflow-x-visible pb-4 md:pb-0 scrollbar-hide">
          <button 
            onClick={() => setActiveTab('general')}
            className={cn(
              "whitespace-nowrap flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-all shrink-0",
              activeTab === 'general' ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            )}
          >
            <Building2 className="w-5 h-5" />
            General Settings
          </button>
          <button 
            onClick={() => setActiveTab('public')}
            className={cn(
              "whitespace-nowrap flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-all shrink-0",
              activeTab === 'public' ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            )}
          >
            <LayoutTemplate className="w-5 h-5" />
            Public Home Page
          </button>
          <button 
            onClick={() => setActiveTab('webhooks')}
            className={cn(
              "whitespace-nowrap flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-all shrink-0",
              activeTab === 'webhooks' ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            )}
          >
            <WebhookIcon className="w-5 h-5" />
            Webhooks & API
          </button>
          <button 
            onClick={() => setActiveTab('security')}
            className={cn(
              "whitespace-nowrap flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-all shrink-0",
              activeTab === 'security' ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            )}
          >
            <Lock className="w-5 h-5" />
            Security & Roles
          </button>
          <button 
            onClick={() => setActiveTab('storage')}
            className={cn(
              "whitespace-nowrap flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-all shrink-0",
              activeTab === 'storage' ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            )}
          >
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
                      onClick={() => setLocalStorageEnabled(!localStorageEnabled)}
                      className={cn(
                        "w-12 h-6 rounded-full transition-all relative",
                        localStorageEnabled ? "bg-indigo-600" : "bg-slate-200 dark:bg-slate-700"
                      )}
                    >
                      <div className={cn(
                        "w-4 h-4 bg-white rounded-full absolute top-1 transition-all",
                        localStorageEnabled ? "right-1" : "left-1"
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
          ) : activeTab === 'public' ? (
            <div className="space-y-6">
              <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <h3 className="font-bold text-slate-900 dark:text-white mb-6">Company Information</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Company Name</label>
                    <input 
                      type="text" 
                      value={publicContent.companyName || ''}
                      onChange={(e) => setPublicContent({...publicContent, companyName: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900/30 outline-none transition-all"
                      placeholder="e.g. Acme Corp"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Description</label>
                    <textarea 
                      value={publicContent.description || ''}
                      onChange={(e) => setPublicContent({...publicContent, description: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900/30 outline-none transition-all min-h-[100px]"
                      placeholder="A brief description of your company..."
                    />
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <h3 className="font-bold text-slate-900 dark:text-white mb-6">Key Activities</h3>
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={newActivity}
                      onChange={(e) => setNewActivity(e.target.value)}
                      className="flex-1 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:border-indigo-500 outline-none"
                      placeholder="Add a new activity..."
                    />
                    <button 
                      onClick={addActivity}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all"
                    >
                      Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(publicContent.activities || []).map((activity, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg text-sm text-slate-700 dark:text-slate-300">
                        <span>{activity}</span>
                        <button onClick={() => removeActivity(idx)} className="text-slate-400 hover:text-red-500">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <h3 className="font-bold text-slate-900 dark:text-white mb-6">Company News & Updates</h3>
                <div className="space-y-4 mb-6 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                  <input 
                    type="text" 
                    value={newNewsTitle}
                    onChange={(e) => setNewNewsTitle(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:border-indigo-500 outline-none mb-2"
                    placeholder="News Title"
                  />
                  <textarea 
                    value={newNewsContent}
                    onChange={(e) => setNewNewsContent(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:border-indigo-500 outline-none min-h-[80px] mb-2"
                    placeholder="News Content..."
                  />
                  <button 
                    onClick={addNews}
                    className="w-full py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-all"
                  >
                    Post Update
                  </button>
                </div>
                <div className="space-y-3">
                  {(publicContent.news || []).map((item) => (
                    <div key={item.id} className="p-4 border border-slate-100 dark:border-slate-800 rounded-xl flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-slate-900 dark:text-white">{item.title}</h4>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{item.content}</p>
                        <p className="text-[10px] text-slate-400 mt-2">{new Date(item.date).toLocaleDateString()}</p>
                      </div>
                      <button onClick={() => removeNews(item.id)} className="text-slate-400 hover:text-red-500 p-2">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <h3 className="font-bold text-slate-900 dark:text-white mb-6">Gallery</h3>
                <div className="space-y-4 mb-6 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                  <input 
                    type="url" 
                    value={newGalleryUrl}
                    onChange={(e) => setNewGalleryUrl(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:border-indigo-500 outline-none mb-2"
                    placeholder="Image URL (https://...)"
                  />
                  <input 
                    type="text" 
                    value={newGalleryCaption}
                    onChange={(e) => setNewGalleryCaption(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:border-indigo-500 outline-none mb-2"
                    placeholder="Image Caption"
                  />
                  <button 
                    onClick={addGalleryImage}
                    className="w-full py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-all"
                  >
                    Add Image
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {(publicContent.gallery || []).map((img) => (
                    <div key={img.id} className="relative group rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800">
                      <img src={img.url} alt={img.caption} className="w-full h-32 object-cover" referrerPolicy="no-referrer" />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button onClick={() => removeGalleryImage(img.id)} className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 bg-black/70 p-2 text-xs text-white truncate">
                        {img.caption}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-4">
                {saveSuccess && (
                  <span className="text-sm text-emerald-600 dark:text-emerald-400 font-bold animate-pulse">
                    Public content saved successfully!
                  </span>
                )}
                <button 
                  onClick={handleSavePublicContent}
                  disabled={saving}
                  className="flex items-center gap-2 bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 dark:shadow-none disabled:opacity-50"
                >
                  <Save className="w-5 h-5" />
                  {saving ? 'Saving...' : 'Save Public Content'}
                </button>
              </div>
            </div>
          ) : activeTab === 'webhooks' ? (
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
          ) : activeTab === 'security' ? (
            <div className="space-y-6">
              <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <h3 className="font-bold text-slate-900 dark:text-white mb-6">Security Policies</h3>
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">Two-Factor Authentication</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Enforce 2FA for all administrative roles.</p>
                    </div>
                    <button className="w-12 h-6 bg-slate-200 dark:bg-slate-700 rounded-full relative">
                      <div className="w-4 h-4 bg-white rounded-full absolute top-1 left-1" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">Session Timeout</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Automatically log out inactive users after 30 minutes.</p>
                    </div>
                    <button className="w-12 h-6 bg-indigo-600 rounded-full relative">
                      <div className="w-4 h-4 bg-white rounded-full absolute top-1 right-1" />
                    </button>
                  </div>
                </div>
              </div>
              <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <h3 className="font-bold text-slate-900 dark:text-white mb-6">Role Hierarchy</h3>
                <div className="space-y-4">
                  {['SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER', 'SUPERVISOR', 'WORKER'].map((role) => (
                    <div key={role} className="flex items-center justify-between p-3 border border-slate-100 dark:border-slate-800 rounded-xl">
                      <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{role.replace('_', ' ')}</span>
                      <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-slate-500">SYSTEM ROLE</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <h3 className="font-bold text-slate-900 dark:text-white mb-6">Data Retention</h3>
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Report Retention Period</label>
                    <select className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white outline-none">
                      <option>1 Year</option>
                      <option>3 Years</option>
                      <option>5 Years</option>
                      <option>Indefinite</option>
                    </select>
                  </div>
                  <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-900/30 rounded-xl">
                    <p className="text-xs text-indigo-700 dark:text-indigo-300">
                      Data is backed up daily to our secure cloud storage. You can request a full data export at any time.
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <h3 className="font-bold text-slate-900 dark:text-white mb-6">Export Organization Data</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Download a complete archive of all reports, tasks, and audit logs in JSON format.</p>
                <button className="w-full py-3 bg-slate-900 dark:bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-800 dark:hover:bg-slate-700 transition-all flex items-center justify-center gap-2">
                  <Database className="w-5 h-5" />
                  Generate Data Export
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
