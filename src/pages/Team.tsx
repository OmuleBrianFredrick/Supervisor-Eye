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
  Network,
  Star,
  MessageSquare
} from 'lucide-react';
import { auth, db } from '../firebase';
import { collection, query, where, onSnapshot, updateDoc, doc, orderBy, limit } from 'firebase/firestore';
import { getUserProfile, logAudit, sendNotification, createFeedback } from '../services/firebaseService';
import { UserProfile } from '../types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function Team() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [teamMembers, setTeamMembers] = useState<UserProfile[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'hierarchy'>('list');
  const [selectedMember, setSelectedMember] = useState<UserProfile | null>(null);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<UserProfile['role']>('WORKER');
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const userId = searchParams.get('userId');
    if (userId && teamMembers.length > 0) {
      const member = teamMembers.find(m => m.uid === userId);
      if (member) {
        setSelectedMember(member);
        // Clear the URL parameters
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, [teamMembers]);

  useEffect(() => {
    let unsubTeam: (() => void) | undefined;
    let unsubAudit: (() => void) | undefined;

    const unsubscribeAuth = auth.onAuthStateChanged(async (authUser) => {
      if (authUser) {
        const profile = await getUserProfile(authUser.uid);
        setUser(profile);
        if (profile) {
          // Query all users in the same organization
          const q = query(collection(db, 'users'), where('orgId', '==', profile.orgId));
          unsubTeam = onSnapshot(q, (snapshot) => {
            const members = snapshot.docs.map(doc => doc.data() as UserProfile);
            setTeamMembers(members);
            setLoading(false);
          });

          // Subscribe to recent audit logs
          const auditQ = query(
            collection(db, 'auditLogs'), 
            where('orgId', '==', profile.orgId),
            orderBy('timestamp', 'desc'),
            limit(10)
          );
          unsubAudit = onSnapshot(auditQ, (snapshot) => {
            setAuditLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
          });
        }
      } else {
        if (unsubTeam) unsubTeam();
        if (unsubAudit) unsubAudit();
        setUser(null);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubTeam) unsubTeam();
      if (unsubAudit) unsubAudit();
    };
  }, []);

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    const inviteLink = `${window.location.origin}/signup?orgCode=${user?.orgId}&role=${inviteRole}`;
    navigator.clipboard.writeText(inviteLink);
    setCopySuccess(true);
    setTimeout(() => {
      setCopySuccess(false);
      setIsInviteModalOpen(false);
      setInviteEmail('');
    }, 2000);
  };

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

  const handleDeactivateUser = async (member: UserProfile) => {
    if (!user || user.role !== 'ORG_ADMIN') return;
    if (member.uid === user.uid) return; // Cannot deactivate self
    try {
      await updateDoc(doc(db, 'users', member.uid), { status: 'inactive' });
      await logAudit('user:deactivated', member.uid, user.orgId, { email: member.email });
      await sendNotification(member.uid, 'Account Deactivated', 'Your account has been deactivated by an administrator.', 'account_deactivated');
    } catch (error) {
      console.error('Error deactivating user:', error);
    }
  };

  const handleReactivateUser = async (member: UserProfile) => {
    if (!user || user.role !== 'ORG_ADMIN') return;
    try {
      await updateDoc(doc(db, 'users', member.uid), { status: 'active' });
      await logAudit('user:reactivated', member.uid, user.orgId, { email: member.email });
      await sendNotification(member.uid, 'Account Reactivated', 'Your account has been reactivated by an administrator.', 'account_reactivated');
    } catch (error) {
      console.error('Error reactivating user:', error);
    }
  };

  const [showActiveOnly, setShowActiveOnly] = useState(false);

  const filteredMembers = teamMembers.filter(m => {
    const matchesSearch = m.displayName.toLowerCase().includes(search.toLowerCase()) || 
      m.email.toLowerCase().includes(search.toLowerCase()) ||
      m.role.toLowerCase().includes(search.toLowerCase());
    
    if (showActiveOnly) {
      return matchesSearch && m.status === 'active';
    }
    return matchesSearch;
  });

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
            "w-10 h-10 rounded-xl flex items-center justify-center font-bold shrink-0 overflow-hidden",
            member.role === 'ORG_ADMIN' ? "bg-white/20 text-white" : "bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400"
          )}>
            {member.photoURL ? (
              <img src={member.photoURL} alt={member.displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              member.displayName.charAt(0)
            )}
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
          <button 
            onClick={() => setIsInviteModalOpen(true)}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 dark:shadow-none"
          >
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
          <button 
            onClick={() => setShowActiveOnly(!showActiveOnly)}
            className={cn(
              "p-2 rounded-lg transition-all",
              showActiveOnly 
                ? "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400" 
                : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            )}
            title={showActiveOnly ? "Showing Active Only" : "Show All Members"}
          >
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
                        <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 rounded-full flex items-center justify-center font-bold overflow-hidden">
                          {member.photoURL ? (
                            <img src={member.photoURL} alt={member.displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            member.displayName.charAt(0)
                          )}
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
                        {user && ['SUPERVISOR', 'MANAGER', 'HR', 'ORG_ADMIN', 'SUPER_ADMIN'].includes(user.role) && member.uid !== user.uid && (
                          <button 
                            onClick={() => { setSelectedMember(member); setIsFeedbackModalOpen(true); }}
                            className="p-2 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-lg transition-all"
                            title="Give Feedback"
                          >
                            <MessageSquare className="w-5 h-5" />
                          </button>
                        )}
                        {user?.role === 'ORG_ADMIN' && member.uid !== user.uid && (
                          <>
                            {member.status === 'active' ? (
                              <button 
                                onClick={() => handleDeactivateUser(member)}
                                className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all"
                                title="Deactivate User"
                              >
                                <UserX className="w-5 h-5" />
                              </button>
                            ) : member.status === 'inactive' ? (
                              <button 
                                onClick={() => handleReactivateUser(member)}
                                className="p-2 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition-all"
                                title="Reactivate User"
                              >
                                <UserCheck className="w-5 h-5" />
                              </button>
                            ) : null}
                          </>
                        )}
                        <button 
                          onClick={() => setSelectedMember(member)}
                          className="p-2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all"
                        >
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
          <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
            {auditLogs.length > 0 ? auditLogs.map((log) => (
              <div key={log.id} className="flex items-start gap-3">
                <div className={cn(
                  "w-2 h-2 rounded-full mt-2 shrink-0",
                  log.action.includes('approved') ? "bg-emerald-500" :
                  log.action.includes('created') ? "bg-indigo-600" :
                  "bg-slate-400"
                )} />
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  <span className="font-bold text-slate-900 dark:text-white">
                    {teamMembers.find(m => m.uid === log.actorId)?.displayName || 'System'}
                  </span>
                  {' '}{log.action.replace(':', ' ')}{' '}
                  <span className="font-bold text-slate-900 dark:text-white">
                    {teamMembers.find(m => m.uid === log.targetId)?.displayName || log.targetId.slice(0, 8)}
                  </span>
                </p>
              </div>
            )) : (
              <p className="text-sm text-slate-400 italic">No recent activity</p>
            )}
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
                  {selectedMember.supervisorId && (
                    <button
                      onClick={() => {
                        handleAssignSupervisor(selectedMember, '');
                        setIsAssignModalOpen(false);
                      }}
                      className="w-full flex items-center gap-4 p-3 rounded-xl border border-red-100 dark:border-red-900/30 transition-all hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400"
                    >
                      <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                        <UserX className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-bold">Clear Supervisor</p>
                        <p className="text-xs opacity-70">Remove current supervisor assignment</p>
                      </div>
                    </button>
                  )}
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
      {/* Invite Member Modal */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center sm:p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 w-full h-full sm:h-auto sm:max-w-md sm:rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col">
            <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-indigo-600 text-white shrink-0">
              <h2 className="text-lg sm:text-xl font-bold">Invite Team Member</h2>
              <button onClick={() => setIsInviteModalOpen(false)} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                <UserX className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleInvite} className="p-4 sm:p-6 space-y-6 overflow-y-auto flex-1">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Select a role and copy the invite link to share with your team member.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                    Member Role
                  </label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as any)}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-white"
                  >
                    <option value="WORKER">Worker</option>
                    <option value="SUPERVISOR">Supervisor</option>
                    <option value="MANAGER">Manager</option>
                    <option value="EXECUTIVE">Executive</option>
                    <option value="ORG_ADMIN">Admin</option>
                  </select>
                </div>

                <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800">
                  <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Mail className="w-3 h-3" />
                    Invite Link
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 break-all bg-white dark:bg-slate-900 p-2 rounded border border-indigo-100 dark:border-indigo-800">
                    {`${window.location.origin}/signup?orgCode=${user?.orgId}&role=${inviteRole}`}
                  </p>
                </div>
              </div>

              <button
                type="submit"
                className={cn(
                  "w-full py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2",
                  copySuccess 
                    ? "bg-emerald-500 text-white" 
                    : "bg-indigo-600 text-white hover:bg-indigo-700"
                )}
              >
                {copySuccess ? (
                  <>
                    <UserCheck className="w-5 h-5" />
                    Link Copied!
                  </>
                ) : (
                  <>
                    <UserPlus className="w-5 h-5" />
                    Copy Invite Link
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
      {/* Feedback Modal */}
      {isFeedbackModalOpen && selectedMember && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center sm:p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 w-full h-full sm:h-auto sm:max-w-md sm:rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col">
            <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-amber-600 text-white shrink-0">
              <h2 className="text-lg sm:text-xl font-bold">Give Feedback</h2>
              <button onClick={() => setIsFeedbackModalOpen(false)} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                <UserX className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!user || !feedbackText.trim()) return;
              await createFeedback({
                recipientId: selectedMember.uid,
                authorId: user.uid,
                authorName: user.displayName,
                orgId: user.orgId,
                text: feedbackText,
                rating: feedbackRating
              });
              setIsFeedbackModalOpen(false);
              setFeedbackText('');
              setFeedbackRating(5);
              alert('Feedback submitted successfully!');
            }} className="p-4 sm:p-6 space-y-6 overflow-y-auto flex-1">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Provide micro-appraisal and feedback for <span className="font-bold text-slate-900 dark:text-white">{selectedMember.displayName}</span>.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                    Rating
                  </label>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setFeedbackRating(star)}
                        className={cn(
                          "p-2 rounded-xl transition-all",
                          feedbackRating >= star 
                            ? "text-amber-500 bg-amber-50 dark:bg-amber-900/30" 
                            : "text-slate-300 dark:text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
                        )}
                      >
                        <Star className={cn("w-6 h-6", feedbackRating >= star && "fill-current")} />
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                    Feedback Details
                  </label>
                  <textarea
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                    placeholder="Describe their performance, achievements, or areas for improvement..."
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-white min-h-[120px] resize-none"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl font-bold text-sm transition-all bg-amber-600 text-white hover:bg-amber-700"
              >
                Submit Feedback
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
