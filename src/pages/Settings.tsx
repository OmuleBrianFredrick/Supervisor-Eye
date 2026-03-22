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
  Camera
} from 'lucide-react';
import { auth } from '../firebase';
import { updateProfile, signOut } from 'firebase/auth';
import { getUserProfile, logAudit } from '../services/firebaseService';
import { UserProfile } from '../types';
import { useNavigate } from 'react-router-dom';

export default function Settings() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged(async (authUser) => {
      if (authUser) {
        const profile = await getUserProfile(authUser.uid);
        setUser(profile);
        if (profile) {
          setDisplayName(profile.displayName);
        }
        setLoading(false);
      }
    });
    return () => unsubscribeAuth();
  }, []);

  const handleUpdateProfile = async () => {
    if (!auth.currentUser || !user) return;
    setSaving(true);
    try {
      await updateProfile(auth.currentUser, { displayName });
      await logAudit('user:profile_updated', user.uid, user.orgId, { displayName });
      alert('Profile updated successfully!');
    } catch (error) {
      console.error('Error updating profile:', error);
    } finally {
      setSaving(false);
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
        <div className="space-y-2">
          <button className="w-full flex items-center gap-3 px-4 py-3 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-xl font-semibold transition-all">
            <User className="w-5 h-5" />
            My Profile
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl font-medium transition-all">
            <Bell className="w-5 h-5" />
            Notifications
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl font-medium transition-all">
            <Lock className="w-5 h-5" />
            Security & Privacy
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl font-medium transition-all">
            <Smartphone className="w-5 h-5" />
            Devices
          </button>
          <div className="pt-4">
            <button 
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl font-medium transition-all"
            >
              <LogOut className="w-5 h-5" />
              Logout Session
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="md:col-span-2 space-y-8">
          {/* Profile Section */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center gap-6 mb-8">
              <div className="relative group">
                <div className="w-24 h-24 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-full flex items-center justify-center text-3xl font-bold border-4 border-white dark:border-slate-800 shadow-lg">
                  {displayName.charAt(0)}
                </div>
                <button className="absolute bottom-0 right-0 p-2 bg-indigo-600 text-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera className="w-4 h-4" />
                </button>
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

          {/* Preferences */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
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
    </div>
  );
}
