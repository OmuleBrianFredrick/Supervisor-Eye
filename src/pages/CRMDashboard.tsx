import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Users, Building2, MessageSquare, ShieldCheck, Mail, Calendar, CheckCircle2 } from 'lucide-react';
import { auth, db } from '../firebase';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { getInquiries, updateInquiryStatus } from '../services/firebaseService';
import { Inquiry, Organization, UserProfile } from '../types';

export default function CRMDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'inquiries' | 'orgs' | 'users'>('inquiries');
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user || user.email !== 'omulebrianfredrick@gmail.com') {
        navigate('/crm/login');
      } else {
        fetchData();
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch inquiries
      const inqData = await getInquiries();
      setInquiries(inqData as Inquiry[]);

      // Fetch organizations
      const orgQuery = query(collection(db, 'organizations'), orderBy('createdAt', 'desc'), limit(50));
      const orgSnap = await getDocs(orgQuery);
      setOrgs(orgSnap.docs.map(d => ({ id: d.id, ...d.data() } as Organization)));

      // Fetch users
      const userQuery = query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(100));
      const userSnap = await getDocs(userQuery);
      setUsers(userSnap.docs.map(d => ({ id: d.id, ...d.data() } as unknown as UserProfile)));
    } catch (error) {
      console.error("Error fetching CRM data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    auth.signOut();
    navigate('/crm/login');
  };

  const markInquiryResolved = async (id: string | undefined) => {
    if (!id) return;
    try {
      await updateInquiryStatus(id, 'resolved');
      setInquiries(inquiries.map(inq => 
        inq.id === id ? { ...inq, status: 'resolved' } : inq
      ));
    } catch (error) {
      console.error("Failed to update status", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-300 font-sans">
      {/* Top Navigation */}
      <nav className="bg-slate-800 border-b border-slate-700 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-white text-lg">Developer CRM</h1>
              <p className="text-xs text-slate-400">Platform Management Backend</p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-white transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Stats Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div 
            onClick={() => setActiveTab('inquiries')}
            className={`cursor-pointer p-6 rounded-2xl border ${activeTab === 'inquiries' ? 'bg-blue-900/40 border-blue-500' : 'bg-slate-800 border-slate-700 hover:bg-slate-800/80'} transition-all`}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-white">Total Inquiries</h3>
              <MessageSquare className="text-blue-400 w-5 h-5" />
            </div>
            <p className="text-3xl font-bold text-white">{inquiries.length}</p>
            <p className="text-sm text-slate-400 mt-2">
              {inquiries.filter(i => i.status === 'new').length} new
            </p>
          </div>
          <div 
            onClick={() => setActiveTab('orgs')}
            className={`cursor-pointer p-6 rounded-2xl border ${activeTab === 'orgs' ? 'bg-indigo-900/40 border-indigo-500' : 'bg-slate-800 border-slate-700 hover:bg-slate-800/80'} transition-all`}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-white">Organizations</h3>
              <Building2 className="text-indigo-400 w-5 h-5" />
            </div>
            <p className="text-3xl font-bold text-white">{orgs.length}</p>
            <p className="text-sm text-slate-400 mt-2">Active platforms</p>
          </div>
          <div 
            onClick={() => setActiveTab('users')}
            className={`cursor-pointer p-6 rounded-2xl border ${activeTab === 'users' ? 'bg-violet-900/40 border-violet-500' : 'bg-slate-800 border-slate-700 hover:bg-slate-800/80'} transition-all`}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-white">Total Users</h3>
              <Users className="text-violet-400 w-5 h-5" />
            </div>
            <p className="text-3xl font-bold text-white">{users.length}</p>
            <p className="text-sm text-slate-400 mt-2">Across all organizations</p>
          </div>
        </div>

        {/* Content Area */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-2xl">
          {activeTab === 'inquiries' && (
            <div>
              <div className="px-6 py-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  Contact Form Inquiries
                </h2>
              </div>
              <div className="divide-y divide-slate-700/50">
                {inquiries.length === 0 ? (
                  <p className="p-8 text-center text-slate-500">No inquiries received yet.</p>
                ) : inquiries.map(inquiry => (
                  <div key={inquiry.id} className={`p-6 transition-colors hover:bg-slate-700/30 ${inquiry.status === 'new' ? 'bg-blue-900/10' : ''}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="font-bold text-white">{inquiry.subject}</h3>
                          {inquiry.status === 'new' && (
                            <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded-full font-medium">New</span>
                          )}
                          {inquiry.status === 'resolved' && (
                            <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full font-medium">Resolved</span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-slate-400 mb-4">
                          <span className="flex items-center gap-1"><Users className="w-4 h-4" /> {inquiry.name}</span>
                          <span className="flex items-center gap-1"><Mail className="w-4 h-4" /> {inquiry.email}</span>
                          <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> {new Date(inquiry.createdAt).toLocaleDateString()}</span>
                        </div>
                        <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700 text-slate-300 text-sm whitespace-pre-wrap">
                          {inquiry.message}
                        </div>
                      </div>
                      <div>
                        {inquiry.status !== 'resolved' && (
                          <button 
                            onClick={() => markInquiryResolved(inquiry.id)}
                            className="flex items-center gap-2 px-3 py-2 bg-green-600/20 text-green-400 hover:bg-green-600/30 rounded-lg transition-colors text-sm font-medium"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            Mark Resolved
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'orgs' && (
            <div>
              <div className="px-6 py-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  Registered Organizations
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-900/50 text-slate-400 text-xs uppercase">
                    <tr>
                      <th className="px-6 py-4 font-medium">Organization Name</th>
                      <th className="px-6 py-4 font-medium">Code</th>
                      <th className="px-6 py-4 font-medium">Created Date</th>
                      <th className="px-6 py-4 font-medium">ID</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {orgs.map(org => (
                      <tr key={org.id} className="hover:bg-slate-700/30 transition-colors">
                        <td className="px-6 py-4 font-medium text-white">{org.name}</td>
                        <td className="px-6 py-4"><span className="px-2 py-1 bg-slate-700 rounded-md text-xs font-mono">{org.code}</span></td>
                        <td className="px-6 py-4 text-sm">{new Date(org.createdAt).toLocaleDateString()}</td>
                        <td className="px-6 py-4 text-xs font-mono text-slate-500">{org.id}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'users' && (
            <div>
              <div className="px-6 py-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  All Platform Users
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-900/50 text-slate-400 text-xs uppercase">
                    <tr>
                      <th className="px-6 py-4 font-medium">User</th>
                      <th className="px-6 py-4 font-medium">Role</th>
                      <th className="px-6 py-4 font-medium">Org ID</th>
                      <th className="px-6 py-4 font-medium">Status</th>
                      <th className="px-6 py-4 font-medium">Joined</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {users.map(u => (
                      <tr key={u.uid} className="hover:bg-slate-700/30 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-white">
                              {u.displayName?.substring(0,2).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-medium text-white">{u.displayName}</div>
                              <div className="text-xs text-slate-500">{u.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm"><span className="px-2 py-1 bg-blue-500/10 text-blue-400 rounded-lg text-xs font-medium">{u.role}</span></td>
                        <td className="px-6 py-4 text-xs font-mono text-slate-500">{u.orgId}</td>
                        <td className="px-6 py-4 text-sm">
                          <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                            u.status === 'active' ? 'bg-green-500/10 text-green-400' : 
                            u.status === 'pending_approval' ? 'bg-yellow-500/10 text-yellow-400' : 'bg-red-500/10 text-red-400'
                          }`}>
                            {u.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-400">
                          {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
