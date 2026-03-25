import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserPlus, 
  Search, 
  Filter, 
  MoreVertical, 
  ShieldCheck, 
  UserCheck, 
  UserX,
  Mail,
  ChevronRight,
  ArrowUpRight,
  Network
} from 'lucide-react';
import { auth, db } from '../firebase';
import { collection, query, where, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { getUserProfile, logAudit, sendNotification } from '../services/firebaseService';
import { UserProfile } from '../types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function Team() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [teamMembers, setTeamMembers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'hierarchy'>('list');
  const [selectedMember, setSelectedMember] = useState<UserProfile | null>(null);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged(async (authUser) => {
      if (authUser) {
        const profile = await getUserProfile(authUser.uid);
        setUser(profile);
        if (profile) {
          // Query all users in the same organization
          const q = query(collection(db, 'users'), where('orgId', '==', profile.orgId));
          const unsubTeam = onSnapshot(q, (snapshot) => {
            const members = snapshot.docs.map(doc => doc.data() as UserProfile);
            setTeamMembers(members);
            setLoading(false);
          });
          return () => unsubTeam();
        }
      }
    });
    return () => unsubscribeAuth();
  }, []);

  const handleApproveUser = async (member: UserProfile) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', member.uid), { status: 'active' });
      await logAudit('user:approved', member.uid, user.orgId, { email: member.email });
      await sendNotification(member.uid, 'Account Approved', 'Your account has been approved by an administrator.', 'account_approved');
    } catch (error) {
      console.error('Error approving user:', error);
    }
  };

  const handleAssignSupervisor = async (member: UserProfile, supervisorId: string) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', member.uid), { supervisorId });
      await logAudit('user:supervisor_assigned', member.uid, user.orgId, { supervisorId });
      await sendNotification(member.uid, 'Supervisor Assigned', `You have been assigned to a new supervisor.`, 'supervisor_assigned');
    } catch (error) {
      console.error('Error assigning supervisor:', error);
    }
  };

  const filteredMembers = teamMembers.filter(m => 
    m.displayName.toLowerCase().includes(search.toLowerCase()) || 
    m.email.toLowerCase().includes(search.toLowerCase()) ||
    m.role.toLowerCase().includes(search.toLowerCase())
  );

  // Recursive component for hierarchy
  const HierarchyNode = ({ member, allMembers, depth = 0 }: { member: UserProfile, allMembers: UserProfile[], depth?: number }) => {
    const reports = allMembers.filter(m => m.supervisorId === member.uid);
    
    return (
      <div className="relative">
        {/* Connector line for children */}
        {depth > 0 && (
          <div className="absolute -left-8 top-6 w-8 h-0.5 bg-slate-200 dark:bg-slate-800" />
        )}
        
        <div className={cn(
          "flex items-center gap-4 p-4 rounded-2xl border transition-all w-fit min-w-[240px] shadow-sm",
          member.role === 'ORG_ADMIN' ? "bg-indigo-600 border-indigo-500 text-white" :
          ['MANAGER', 'SUPERVISOR'].includes(member.role) ? "bg-white dark:bg-slate-900 border-indigo-200 dark:border-indigo-800 text-slate-900 dark:text-white" :
          "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
        )}>
          <div className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center font-bold shrink-0",
            member.role === 'ORG_ADMIN' ? "bg-white/20 text-white" : "bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400"
          )}>
            {member.displayName.charAt(0)}
          </div>
          <div>
            <p className="text-sm font-bold truncate max-w-[150px]">{member.displayName}</p>
            <p className={cn(
              "text-[10px] font-bold uppercase tracking-widest opacity-70",
              member.role === 'ORG_ADMIN' ? "text-white" : "text-indigo-600 dark:text-indigo-400"
            )}>
              {member.role.replace('_', ' ')}
            </p>
          </div>
          {reports.length > 0 && (
            <div className="ml-auto pl-4">
              <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-500">
                {reports.length}
              </div>
            </div>
          )}
        </div>

        {reports.length > 0 && (
          <div className="ml-8 mt-4 pl-8 border-l-2 border-slate-100 dark:border-slate-800 space-y-4">
            {reports.map(report => (
              <HierarchyNode key={report.uid} member={report} allMembers={allMembers} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Team Management</h1>
          <p className="text-slate-500 dark:text-slate-400">Manage organizational hierarchy and user access.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setViewMode(viewMode === 'list' ? 'hierarchy' : 'list')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm border",
              viewMode === 'hierarchy' 
                ? "bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400" 
                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            )}
          >
            <Network className="w-4 h-4" />
            {viewMode === 'list' ? 'View Hierarchy' : 'View List'}
          </button>
          <button className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 dark:shadow-none">
            <UserPlus className="w-4 h-4" />
            Invite Member
          </button>
        </div>
      </div>

      {/* Search & Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search team members by name, email or role..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border-transparent focus:bg-white dark:focus:bg-slate-700 focus:border-indigo-500 rounded-xl text-sm transition-all outline-none text-slate-900 dark:text-white"
            />
          </div>
          <button className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all">
            <Filter className="w-5 h-5" />
          </button>
        </div>
        <div className="bg-indigo-600 p-4 rounded-2xl text-white shadow-lg shadow-indigo-200 dark:shadow-none flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider opacity-80">Total Members</p>
            <h3 className="text-2xl font-bold">{teamMembers.length}</h3>
          </div>
          <Users className="w-8 h-8 opacity-40" />
        </div>
      </div>

      {/* Team Content */}
      {viewMode === 'list' ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider font-bold">
                  <th className="px-6 py-4">Member</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">Supervisor</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredMembers.map((member) => (
                  <tr key={member.uid} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 rounded-full flex items-center justify-center font-bold">
                          {member.displayName.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900 dark:text-white">{member.displayName}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{member.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                        {member.role.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {member.supervisorId ? (
                        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                          <UserCheck className="w-4 h-4 text-emerald-500" />
                          <span>{teamMembers.find(m => m.uid === member.supervisorId)?.displayName || member.supervisorId.slice(0, 8)}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">No supervisor</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider",
                        member.status === 'active' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' :
                        member.status === 'pending_approval' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' :
                        'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      )}>
                        {member.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {member.status === 'pending_approval' && (
                          <button 
                            onClick={() => handleApproveUser(member)}
                            className="p-2 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition-all"
                            title="Approve User"
                          >
                            <UserCheck className="w-5 h-5" />
                          </button>
                        )}
                        {user?.role === 'ORG_ADMIN' && member.uid !== user.uid && (
                          <button 
                            onClick={() => { setSelectedMember(member); setIsAssignModalOpen(true); }}
                            className="p-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-all"
                            title="Assign Supervisor"
                          >
                            <Network className="w-5 h-5" />
                          </button>
                        )}
                        <button className="p-2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all">
                          <MoreVertical className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Hierarchy Tree Visualization */}
          <div className="bg-white dark:bg-slate-900 p-4 sm:p-12 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-x-auto">
            <div className="space-y-12 min-w-max">
              {teamMembers.filter(m => !m.supervisorId || m.role === 'ORG_ADMIN').map(leader => (
                <HierarchyNode key={leader.uid} member={leader} allMembers={teamMembers} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Hierarchy Preview (Simplified) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <h3 className="font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            Top-Level Executives
          </h3>
          <div className="space-y-4">
            {teamMembers.filter(m => ['ORG_ADMIN', 'EXECUTIVE'].includes(m.role)).map(exec => (
              <div key={exec.uid} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-indigo-600 text-white rounded-lg flex items-center justify-center text-xs font-bold">
                    {exec.displayName.charAt(0)}
                  </div>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{exec.displayName}</span>
                </div>
                <ArrowUpRight className="w-4 h-4 text-slate-400" />
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <h3 className="font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            Recent Activity
          </h3>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-indigo-600 rounded-full mt-2" />
              <p className="text-sm text-slate-600 dark:text-slate-400">
                <span className="font-bold text-slate-900 dark:text-white">John Doe</span> joined the organization.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-emerald-500 rounded-full mt-2" />
              <p className="text-sm text-slate-600 dark:text-slate-400">
                <span className="font-bold text-slate-900 dark:text-white">Jane Smith</span> was promoted to Manager.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Assign Supervisor Modal */}
      {isAssignModalOpen && selectedMember && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center sm:p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 w-full h-full sm:h-auto sm:max-w-md sm:rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col">
            <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-indigo-600 text-white shrink-0">
              <h2 className="text-lg sm:text-xl font-bold">Assign Supervisor</h2>
              <button onClick={() => setIsAssignModalOpen(false)} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                <UserX className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-4 sm:p-6 space-y-6 overflow-y-auto flex-1">
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                  Select a supervisor for <span className="font-bold text-slate-900 dark:text-white">{selectedMember.displayName}</span>.
                </p>
                <div className="space-y-2 max-h-[300px] sm:max-h-[400px] overflow-y-auto pr-2">
                  {teamMembers
                    .filter(m => 
                      m.uid !== selectedMember.uid && 
                      ['ORG_ADMIN', 'EXECUTIVE', 'MANAGER', 'SUPERVISOR'].includes(m.role) &&
                      m.status === 'active'
                    )
                    .map(supervisor => (
                      <button
                        key={supervisor.uid}
                        onClick={() => {
                          handleAssignSupervisor(selectedMember, supervisor.uid);
                          setIsAssignModalOpen(false);
                        }}
                        className={cn(
                          "w-full flex items-center gap-4 p-3 rounded-xl border transition-all hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30",
                          selectedMember.supervisorId === supervisor.uid ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30" : "border-slate-100 dark:border-slate-800"
                        )}
                      >
                        <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 rounded-full flex items-center justify-center font-bold">
                          {supervisor.displayName.charAt(0)}
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-bold text-slate-900 dark:text-white">{supervisor.displayName}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-bold">{supervisor.role.replace('_', ' ')}</p>
                        </div>
                        {selectedMember.supervisorId === supervisor.uid && (
                          <UserCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400 ml-auto" />
                        )}
                      </button>
                    ))}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 pt-4 shrink-0">
                <button 
                  onClick={() => {
                    handleAssignSupervisor(selectedMember, ""); // Clear supervisor
                    setIsAssignModalOpen(false);
                  }}
                  className="flex-1 py-3 px-4 rounded-xl font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-all border border-red-100 dark:border-red-900/30"
                >
                  Clear Supervisor
                </button>
                <button 
                  onClick={() => setIsAssignModalOpen(false)}
                  className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 py-3 px-4 rounded-xl font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
