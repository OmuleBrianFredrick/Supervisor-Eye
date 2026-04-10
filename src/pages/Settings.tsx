import React, { useState, useEffect } from 'react';
import { 
  User, 
  Mail, 
  Shield, 
  Bell, 
  Lock, 
  Eye, 
  EyeOff, 
  Save, 
  LogOut,
  Smartphone,
  Globe,
  Camera,
  Building,
  Zap,
  Plus,
  X
} from 'lucide-react';
import { auth } from '../firebase';
import { updateProfile, signOut } from 'firebase/auth';
import { getUserProfile, logAudit, uploadFile, updateUserProfile, getOrganizationByCode, updateOrganization, getOrganizationById, getWorkflowRules, createWorkflowRule, updateWorkflowRule, deleteWorkflowRule } from '../services/firebaseService';
import { UserProfile, Organization, WorkflowRule } from '../types';
import { useNavigate } from 'react-router-dom';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function Settings() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [org, setOrg] = useState<Organization | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#4f46e5'); // Default indigo-600
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'notifications' | 'security' | 'devices' | 'organization' | 'workflows' | 'language'>('profile');
  const [workflows, setWorkflows] = useState<WorkflowRule[]>([]);
  const [loadingWorkflows, setLoadingWorkflows] = useState(false);
  const [showWorkflowModal, setShowWorkflowModal] = useState(false);
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged(async (authUser) => {
      if (authUser) {
        const profile = await getUserProfile(authUser.uid);
        setUser(profile);
        if (profile) {
          setDisplayName(profile.displayName);
          setPhotoURL(profile.photoURL || '');
          
          // Fetch Organization if Admin
          if (['SUPER_ADMIN', 'ORG_ADMIN'].includes(profile.role)) {
            const orgData = await getOrganizationById(profile.orgId);
            if (orgData) {
              setOrg(orgData);
              if (orgData.branding) {
                setLogoUrl(orgData.branding.logoUrl || '');
                setPrimaryColor(orgData.branding.primaryColor || '#4f46e5');
              }
            }
          }
        }
        setLoading(false);
      }
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (activeTab === 'workflows' && user?.orgId) {
      loadWorkflows();
    }
  }, [activeTab, user?.orgId]);

  const loadWorkflows = async () => {
    if (!user?.orgId) return;
    setLoadingWorkflows(true);
    try {
      const rules = await getWorkflowRules(user.orgId);
      setWorkflows(rules);
    } catch (error) {
      console.error('Error loading workflows:', error);
    } finally {
      setLoadingWorkflows(false);
    }
  };

  const handleUpdateProfile = async () => {
    if (!auth.currentUser || !user) return;
    setSaving(true);
    try {
      await updateProfile(auth.currentUser, { displayName, photoURL });
      await updateUserProfile(user.uid, { displayName, photoURL });
      
      if (org && ['SUPER_ADMIN', 'ORG_ADMIN'].includes(user.role)) {
        await updateOrganization(org.id, {
          branding: {
            logoUrl,
            primaryColor
          }
        });
      }
      
      await logAudit('user:profile_updated', user.uid, user.orgId, { displayName, photoURL });
      alert('Settings updated successfully!');
    } catch (error) {
      console.error('Error updating settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !org) return;

    setUploadingLogo(true);
    try {
      const path = `organizations/${org.id}/logo-${Date.now()}`;
      const url = await uploadFile(file, path);
      setLogoUrl(url);
      alert('Logo uploaded successfully!');
    } catch (error: any) {
      console.error('Error uploading logo:', error);
      alert('Failed to upload logo.');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    try {
      const path = `profiles/${user.uid}/${file.name}`;
      const url = await uploadFile(file, path);
      setPhotoURL(url);
      
      // Update immediately in Auth and Firestore
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { photoURL: url });
        await updateUserProfile(user.uid, { photoURL: url });
        setUser({ ...user, photoURL: url });
      }
      
      alert('Profile picture uploaded successfully!');
    } catch (error: any) {
      console.error('Error uploading photo:', error);
      alert('Failed to upload photo.');
    } finally {
      setUploading(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  if (loading) return <div className="p-8 text-center">Loading settings...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">User Settings</h1>
        <p className="text-slate-500 dark:text-slate-400">Manage your personal profile and account preferences.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Sidebar Navigation */}
        <div className="flex md:flex-col gap-2 overflow-x-auto md:overflow-x-visible pb-4 md:pb-0 scrollbar-hide">
          <button 
            onClick={() => setActiveTab('profile')}
            className={cn(
              "whitespace-nowrap flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-all shrink-0",
              activeTab === 'profile' ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            )}
          >
            <User className="w-5 h-5" />
            My Profile
          </button>
          <button 
            onClick={() => setActiveTab('notifications')}
            className={cn(
              "whitespace-nowrap flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-all shrink-0",
              activeTab === 'notifications' ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            )}
          >
            <Bell className="w-5 h-5" />
            Notifications
          </button>
          <button 
            onClick={() => setActiveTab('security')}
            className={cn(
              "whitespace-nowrap flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-all shrink-0",
              activeTab === 'security' ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            )}
          >
            <Lock className="w-5 h-5" />
            Security & Privacy
          </button>
          <button 
            onClick={() => setActiveTab('devices')}
            className={cn(
              "whitespace-nowrap flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-all shrink-0",
              activeTab === 'devices' ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            )}
          >
            <Smartphone className="w-5 h-5" />
            Devices
          </button>
          <button 
            onClick={() => setActiveTab('language')}
            className={cn(
              "whitespace-nowrap flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-all shrink-0",
              activeTab === 'language' ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            )}
          >
            <Globe className="w-5 h-5" />
            {t('Language')}
          </button>
          {user && ['SUPER_ADMIN', 'ORG_ADMIN'].includes(user.role) && (
            <>
              <button 
                onClick={() => setActiveTab('organization')}
                className={cn(
                  "whitespace-nowrap flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-all shrink-0",
                  activeTab === 'organization' ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                )}
              >
                <Building className="w-5 h-5" />
                Organization
              </button>
              <button 
                onClick={() => setActiveTab('workflows')}
                className={cn(
                  "whitespace-nowrap flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-all shrink-0",
                  activeTab === 'workflows' ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                )}
              >
                <Zap className="w-5 h-5" />
                Workflows
              </button>
            </>
          )}
          <div className="md:pt-4 shrink-0">
            <button 
              onClick={handleLogout}
              className="whitespace-nowrap flex items-center gap-3 px-4 py-3 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl font-medium transition-all"
            >
              <LogOut className="w-5 h-5" />
              Logout Session
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="md:col-span-2 space-y-8">
          {activeTab === 'profile' && (
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="flex items-center gap-6 mb-8">
                <div className="relative group">
                  <div className="w-24 h-24 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-full flex items-center justify-center text-3xl font-bold border-4 border-white dark:border-slate-800 shadow-lg overflow-hidden">
                    {photoURL ? (
                      <img src={photoURL} alt={displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      displayName.charAt(0)
                    )}
                    {uploading && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                  </div>
                  <label className="absolute bottom-0 right-0 p-2 bg-indigo-600 text-white rounded-full shadow-lg cursor-pointer hover:bg-indigo-700 transition-all">
                    <Camera className="w-4 h-4" />
                    <input 
                      type="file" 
                      className="hidden" 
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      disabled={uploading}
                    />
                  </label>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">{displayName}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{user?.email}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                      {user?.role.replace('_', ' ')}
                    </span>
                    <span className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                      {user?.status}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Display Name</label>
                  <div className="relative">
                    <User className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      type="text" 
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900/30 outline-none transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Profile Photo URL (Optional Fallback)</label>
                  <div className="relative">
                    <Globe className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      type="text" 
                      value={photoURL}
                      onChange={(e) => setPhotoURL(e.target.value)}
                      placeholder="https://example.com/photo.jpg"
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900/30 outline-none transition-all"
                    />
                  </div>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">If file upload fails, you can paste a direct image link here.</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Email Address</label>
                  <div className="relative">
                    <Mail className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      type="email" 
                      value={user?.email}
                      disabled
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 outline-none cursor-not-allowed"
                    />
                  </div>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">Email cannot be changed as it is linked to your Google account.</p>
                </div>
              </div>
            </div>
          )}

          {/* Preferences */}
          {activeTab === 'notifications' && (
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-300">
              <h3 className="font-bold text-slate-900 dark:text-white mb-6">Preferences</h3>
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
                      <Bell className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">Email Notifications</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Receive weekly report summaries via email.</p>
                    </div>
                  </div>
                  <button className="w-12 h-6 bg-indigo-600 rounded-full relative">
                    <div className="w-4 h-4 bg-white rounded-full absolute top-1 right-1" />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
                      <Globe className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">Language</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Select your preferred system language.</p>
                    </div>
                  </div>
                  <select className="text-sm font-semibold text-slate-700 dark:text-slate-300 border-none bg-slate-100 dark:bg-slate-800 rounded-lg px-3 py-1 outline-none">
                    <option>English (US)</option>
                    <option>French</option>
                    <option>Spanish</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Organization Settings (Admins Only) */}
          {activeTab === 'organization' && user && ['SUPER_ADMIN', 'ORG_ADMIN'].includes(user.role) && org && (
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-300">
              <h3 className="font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                <Building className="w-5 h-5 text-indigo-600" />
                Organization Branding
              </h3>
              
              <div className="space-y-6">
                <div className="flex items-center gap-6">
                  <div className="relative group">
                    <div className="w-24 h-24 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center text-3xl font-bold border-2 border-dashed border-slate-300 dark:border-slate-700 overflow-hidden">
                      {logoUrl ? (
                        <img src={logoUrl} alt="Org Logo" className="w-full h-full object-contain" />
                      ) : (
                        <Building className="w-8 h-8 text-slate-400" />
                      )}
                      {uploadingLogo && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        </div>
                      )}
                    </div>
                    <label className="absolute -bottom-2 -right-2 p-2 bg-indigo-600 text-white rounded-full shadow-lg cursor-pointer hover:bg-indigo-700 transition-all">
                      <Camera className="w-4 h-4" />
                      <input 
                        type="file" 
                        className="hidden" 
                        accept="image/*"
                        onChange={handleLogoUpload}
                        disabled={uploadingLogo}
                      />
                    </label>
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 dark:text-white">Company Logo</h4>
                    <p className="text-sm text-slate-500">Upload a transparent PNG or SVG for best results.</p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Primary Brand Color</label>
                  <div className="flex items-center gap-4">
                    <input 
                      type="color" 
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="w-12 h-12 rounded cursor-pointer border-0 p-0"
                    />
                    <input 
                      type="text" 
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="flex-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:border-indigo-500 outline-none uppercase font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Security & Privacy */}
          {activeTab === 'security' && (
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-300">
              <h3 className="font-bold text-slate-900 dark:text-white mb-6">Security & Privacy</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">Security settings are managed by your organization administrator.</p>
            </div>
          )}

          {/* Devices */}
          {activeTab === 'devices' && (
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-300">
              <h3 className="font-bold text-slate-900 dark:text-white mb-6">Active Devices</h3>
              <div className="flex items-center gap-4 p-4 border border-slate-100 dark:border-slate-800 rounded-xl">
                <Smartphone className="w-8 h-8 text-indigo-600" />
                <div>
                  <p className="font-bold text-slate-900 dark:text-white">Current Session</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Web Browser • Active Now</p>
                </div>
              </div>
            </div>
          )}

          {/* Language */}
          {activeTab === 'language' && (
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-300">
              <h3 className="font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                <Globe className="w-5 h-5 text-indigo-600" />
                {t('Language')}
              </h3>
              <div className="space-y-4">
                <button 
                  onClick={() => i18n.changeLanguage('en')}
                  className={cn(
                    "w-full flex items-center justify-between p-4 rounded-xl border transition-all",
                    i18n.language === 'en' ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30" : "border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"
                  )}
                >
                  <span className="font-medium text-slate-900 dark:text-white">{t('English')}</span>
                  {i18n.language === 'en' && <div className="w-2 h-2 rounded-full bg-indigo-600" />}
                </button>
                <button 
                  onClick={() => i18n.changeLanguage('es')}
                  className={cn(
                    "w-full flex items-center justify-between p-4 rounded-xl border transition-all",
                    i18n.language === 'es' ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30" : "border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"
                  )}
                >
                  <span className="font-medium text-slate-900 dark:text-white">{t('Spanish')}</span>
                  {i18n.language === 'es' && <div className="w-2 h-2 rounded-full bg-indigo-600" />}
                </button>
                <button 
                  onClick={() => i18n.changeLanguage('fr')}
                  className={cn(
                    "w-full flex items-center justify-between p-4 rounded-xl border transition-all",
                    i18n.language === 'fr' ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30" : "border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"
                  )}
                >
                  <span className="font-medium text-slate-900 dark:text-white">{t('French')}</span>
                  {i18n.language === 'fr' && <div className="w-2 h-2 rounded-full bg-indigo-600" />}
                </button>
              </div>
            </div>
          )}

          {/* Workflows (Admins Only) */}
          {activeTab === 'workflows' && user && ['SUPER_ADMIN', 'ORG_ADMIN'].includes(user.role) && (
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Zap className="w-5 h-5 text-indigo-600" />
                  Automated Workflows
                </h3>
                <button 
                  onClick={() => setShowWorkflowModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  New Workflow
                </button>
              </div>
              
              {loadingWorkflows ? (
                <div className="flex justify-center py-8">
                  <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : workflows.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                  <Zap className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                  <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-2">No workflows yet</h4>
                  <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                    Create automated rules to send notifications, assign tasks, or trigger webhooks when specific events occur.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {workflows.map(workflow => (
                    <div key={workflow.id} className="flex items-center justify-between p-4 border border-slate-100 dark:border-slate-800 rounded-xl hover:border-indigo-200 dark:hover:border-indigo-900/50 transition-colors">
                      <div>
                        <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          {workflow.name}
                          {!workflow.isActive && (
                            <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] uppercase tracking-wider rounded font-bold">
                              Inactive
                            </span>
                          )}
                        </h4>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                          When <span className="font-semibold text-indigo-600 dark:text-indigo-400">{workflow.trigger.replace('_', ' ')}</span>
                          {' '}then <span className="font-semibold text-emerald-600 dark:text-emerald-400">{workflow.actions.length} action(s)</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={async () => {
                            await updateWorkflowRule(workflow.id, { isActive: !workflow.isActive });
                            loadWorkflows();
                          }}
                          className={cn(
                            "w-12 h-6 rounded-full relative transition-colors",
                            workflow.isActive ? "bg-indigo-600" : "bg-slate-300 dark:bg-slate-700"
                          )}
                        >
                          <div className={cn(
                            "w-4 h-4 bg-white rounded-full absolute top-1 transition-all",
                            workflow.isActive ? "right-1" : "left-1"
                          )} />
                        </button>
                        <button 
                          onClick={async () => {
                            if (window.confirm('Are you sure you want to delete this workflow?')) {
                              await deleteWorkflowRule(workflow.id);
                              loadWorkflows();
                            }
                          }}
                          className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end">
            <button 
              onClick={handleUpdateProfile}
              disabled={saving}
              className="flex items-center gap-2 bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 dark:shadow-none disabled:opacity-50"
            >
              <Save className="w-5 h-5" />
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </div>
      </div>
      {/* Workflow Modal */}
      {showWorkflowModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Zap className="w-5 h-5 text-indigo-600" />
                Create Workflow Rule
              </h2>
              <button 
                onClick={() => setShowWorkflowModal(false)}
                className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Workflow Name</label>
                <input 
                  type="text" 
                  placeholder="e.g., High Risk Incident Alert"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900/30 outline-none transition-all"
                  id="workflow-name"
                />
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800">
                <h4 className="font-bold text-slate-900 dark:text-white mb-4">1. Trigger</h4>
                <select 
                  id="workflow-trigger"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:border-indigo-500 outline-none"
                >
                  <option value="report_submitted">When a Report is Submitted</option>
                  <option value="report_approved">When a Report is Approved</option>
                  <option value="report_rejected">When a Report is Rejected</option>
                  <option value="task_created">When a Task is Created</option>
                  <option value="task_completed">When a Task is Completed</option>
                </select>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800">
                <h4 className="font-bold text-slate-900 dark:text-white mb-4">2. Conditions (Optional)</h4>
                <div className="flex items-center gap-2 mb-2">
                  <select id="workflow-condition-field" className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm">
                    <option value="riskLevel">Risk Level</option>
                    <option value="status">Status</option>
                    <option value="typeId">Report Type</option>
                  </select>
                  <select id="workflow-condition-operator" className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm">
                    <option value="equals">Equals</option>
                    <option value="not_equals">Not Equals</option>
                    <option value="contains">Contains</option>
                  </select>
                  <input id="workflow-condition-value" type="text" placeholder="Value" className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm" />
                </div>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800">
                <h4 className="font-bold text-slate-900 dark:text-white mb-4">3. Action</h4>
                <select 
                  id="workflow-action"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:border-indigo-500 outline-none mb-4"
                >
                  <option value="notify_user">Send In-App Notification</option>
                  <option value="send_email">Send Email</option>
                  <option value="create_task">Create a Task</option>
                  <option value="webhook">Trigger Webhook</option>
                </select>
                <input 
                  type="text" 
                  id="workflow-action-config"
                  placeholder="Recipient ID, Email, or Webhook URL"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:border-indigo-500 outline-none"
                />
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 bg-slate-50 dark:bg-slate-900">
              <button 
                onClick={() => setShowWorkflowModal(false)}
                className="px-6 py-2.5 text-slate-600 dark:text-slate-400 font-semibold hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={async () => {
                  if (!user?.orgId) return;
                  const name = (document.getElementById('workflow-name') as HTMLInputElement).value;
                  const trigger = (document.getElementById('workflow-trigger') as HTMLSelectElement).value as any;
                  const field = (document.getElementById('workflow-condition-field') as HTMLSelectElement).value;
                  const operator = (document.getElementById('workflow-condition-operator') as HTMLSelectElement).value as any;
                  const value = (document.getElementById('workflow-condition-value') as HTMLInputElement).value;
                  const actionType = (document.getElementById('workflow-action') as HTMLSelectElement).value as any;
                  const actionConfig = (document.getElementById('workflow-action-config') as HTMLInputElement).value;

                  if (!name) return alert('Please enter a workflow name');

                  await createWorkflowRule({
                    orgId: user.orgId,
                    name,
                    trigger,
                    conditions: value ? [{ field, operator, value }] : [],
                    actions: [{ type: actionType, config: { target: actionConfig } }],
                    isActive: true
                  });

                  setShowWorkflowModal(false);
                  loadWorkflows();
                }}
                className="px-6 py-2.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors"
              >
                Create Rule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
