import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  CheckSquare, 
  Users, 
  TrendingUp, 
  Clock, 
  AlertCircle,
  ChevronRight,
  Plus,
  RefreshCw
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { auth, db } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { getUserProfile, subscribeToReports, subscribeToTasks } from '../services/firebaseService';
import { UserProfile, Report, Task } from '../types';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function Dashboard() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [teamMembersCount, setTeamMembersCount] = useState(0);
  const [teamMembers, setTeamMembers] = useState<UserProfile[]>([]);
  const [supervisor, setSupervisor] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged(async (authUser) => {
      if (authUser) {
        const profile = await getUserProfile(authUser.uid);
        setUser(profile);
        if (profile) {
          if (profile.supervisorId) {
            getUserProfile(profile.supervisorId).then(setSupervisor);
          }
          const unsubReports = subscribeToReports(profile.orgId, (data) => {
            setReports(data);
          }, profile.role === 'WORKER' ? { authorId: profile.uid } : undefined);

          const unsubTasks = subscribeToTasks(profile.orgId, (data) => {
            setTasks(data);
          }, profile.role === 'WORKER' ? { assigneeId: profile.uid } : undefined);

          // Subscribe to team members
          const q = query(collection(db, 'users'), where('orgId', '==', profile.orgId));
          const unsubTeam = onSnapshot(q, (snapshot) => {
            const members = snapshot.docs.map(doc => doc.data() as UserProfile);
            setTeamMembers(members);
            setTeamMembersCount(snapshot.size);
          });

          setLoading(false);
          return () => {
            unsubReports();
            unsubTasks();
            unsubTeam();
          };
        }
      }
    });
    return () => unsubscribeAuth();
  }, []);

  if (loading) return <div className="flex items-center justify-center h-full">Loading dashboard...</div>;

  const getAuthorName = (authorId: string) => {
    const member = teamMembers.find(m => m.uid === authorId);
    return member ? member.displayName : `User ${authorId.slice(0, 4)}`;
  };

  const getAuthorPhoto = (authorId: string) => {
    const member = teamMembers.find(m => m.uid === authorId);
    return member?.photoURL;
  };

  const completedTasks = tasks.filter(t => t.status === 'completed' || t.status === 'approved').length;
  const totalTasks = tasks.length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const stats = [
    { name: 'Total Reports', value: reports.length, icon: FileText, color: 'text-blue-600', bg: 'bg-blue-100' },
    { name: 'Pending Tasks', value: tasks.filter(t => t.status !== 'completed' && t.status !== 'approved').length, icon: CheckSquare, color: 'text-amber-600', bg: 'bg-amber-100' },
    { name: 'Team Members', value: teamMembersCount, icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-100' },
    { name: 'Completion Rate', value: `${completionRate}%`, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-100' },
  ];

  const chartData = [
    { name: 'Mon', reports: 4, tasks: 2 },
    { name: 'Tue', reports: 3, tasks: 5 },
    { name: 'Wed', reports: 7, tasks: 3 },
    { name: 'Thu', reports: 5, tasks: 4 },
    { name: 'Fri', reports: 8, tasks: 6 },
    { name: 'Sat', reports: 2, tasks: 1 },
    { name: 'Sun', reports: 1, tasks: 0 },
  ];

  const handleRefresh = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 500);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight transition-colors">Welcome back, {user?.displayName}</h1>
          <p className="text-slate-500 dark:text-slate-400">Here's what's happening in your organization today.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleRefresh}
            className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-2 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm"
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            Refresh
          </button>
          <button 
            onClick={() => navigate('/reports')}
            className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-2 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm"
          >
            <Clock className="w-4 h-4" />
            View Timeline
          </button>
          <button 
            onClick={() => navigate('/reports')}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 dark:shadow-none"
          >
            <Plus className="w-4 h-4" />
            New Report
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div key={stat.name} className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-xl ${stat.bg} ${stat.color} dark:bg-opacity-20`}>
                <stat.icon className="w-6 h-6" />
              </div>
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-1 rounded-lg">+12%</span>
            </div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{stat.name}</p>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{stat.value}</h3>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Chart */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
            <div className="flex items-center justify-between mb-8">
              <h3 className="font-bold text-slate-900 dark:text-white">Activity Overview</h3>
              <select className="text-sm border-none bg-slate-100 dark:bg-slate-800 dark:text-white rounded-lg px-3 py-1 outline-none">
                <option>Last 7 days</option>
                <option>Last 30 days</option>
              </select>
            </div>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorReports" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" className="dark:stroke-slate-800" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                  <Tooltip 
                    contentStyle={{borderRadius: '12px', border: 'none', backgroundColor: '#1e293b', color: '#fff', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                    cursor={{stroke: '#4f46e5', strokeWidth: 2}}
                  />
                  <Area type="monotone" dataKey="reports" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorReports)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Supervisor Card for Workers */}
          {user?.role === 'WORKER' && supervisor && (
            <div className="bg-indigo-600 rounded-3xl p-8 text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl shadow-indigo-200 dark:shadow-none">
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center text-3xl font-bold">
                  {supervisor.displayName.charAt(0)}
                </div>
                <div>
                  <p className="text-indigo-100 text-sm font-medium uppercase tracking-widest mb-1">My Supervisor</p>
                  <h3 className="text-2xl font-bold">{supervisor.displayName}</h3>
                  <p className="text-indigo-200 text-sm">{supervisor.email}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button className="bg-white text-indigo-600 px-6 py-3 rounded-xl font-bold text-sm hover:bg-indigo-50 transition-all">
                  Contact Supervisor
                </button>
                <button className="bg-indigo-500 text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-indigo-400 transition-all">
                  View Profile
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Recent Tasks */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-slate-900 dark:text-white">Recent Tasks</h3>
            <button 
              onClick={() => navigate('/tasks')}
              className="text-xs font-bold text-indigo-600 hover:underline"
            >
              View All
            </button>
          </div>
          <div className="space-y-4">
            {tasks.slice(0, 5).map((task) => (
              <div key={task.id} className="flex items-start gap-4 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group cursor-pointer">
                <div className={cn(
                  "w-2 h-2 rounded-full mt-2",
                  task.priority === 'high' ? 'bg-red-500' : 'bg-blue-500'
                )} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{task.title}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Due {format(new Date(task.deadline), 'MMM d, yyyy')}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-600 transition-colors" />
              </div>
            ))}
            {tasks.length === 0 && (
              <div className="text-center py-8">
                <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500 dark:text-slate-400">No pending tasks</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Reports Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 dark:text-white">Recent Reports</h3>
          <button 
            onClick={() => navigate('/reports')}
            className="text-sm font-bold text-indigo-600 hover:underline"
          >
            View All Reports
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider font-bold">
                <th className="px-6 py-4">Report Title</th>
                <th className="px-6 py-4">Author</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {reports.slice(0, 5).map((report) => (
                <tr key={report.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{report.title}</p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center text-[10px] font-bold dark:text-white overflow-hidden">
                        {getAuthorPhoto(report.authorId) ? (
                          <img src={getAuthorPhoto(report.authorId)} alt="" className="w-full h-full object-cover" />
                        ) : (
                          getAuthorName(report.authorId).charAt(0)
                        )}
                      </div>
                      <span className="text-sm text-slate-600 dark:text-slate-400">{getAuthorName(report.authorId)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">
                    {format(new Date(report.createdAt), 'MMM d, HH:mm')}
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider",
                      report.status === 'approved' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                      report.status === 'rejected' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                      'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                    )}>
                      {report.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-bold text-sm">View</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
