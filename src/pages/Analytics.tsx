import React, { useState, useEffect } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  FileText, 
  CheckSquare, 
  Activity,
  Download,
  Filter,
  Calendar,
  RefreshCw
} from 'lucide-react';
import { auth, db } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { getUserProfile, subscribeToReports, subscribeToTasks } from '../services/firebaseService';
import { UserProfile, Report, Task } from '../types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function Analytics() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [teamMembers, setTeamMembers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged(async (authUser) => {
      if (authUser) {
        const profile = await getUserProfile(authUser.uid);
        setUser(profile);
        if (profile) {
          const unsubReports = subscribeToReports(profile.orgId, (data) => setReports(data));
          const unsubTasks = subscribeToTasks(profile.orgId, (data) => setTasks(data));
          
          const q = query(collection(db, 'users'), where('orgId', '==', profile.orgId));
          const unsubTeam = onSnapshot(q, (snapshot) => {
            setTeamMembers(snapshot.docs.map(doc => doc.data() as UserProfile));
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

  // --- Calculations ---
  const reportStatusData = [
    { name: 'Approved', value: reports.filter(r => r.status === 'approved').length, color: '#10b981' },
    { name: 'Submitted', value: reports.filter(r => r.status === 'submitted').length, color: '#3b82f6' },
    { name: 'Rejected', value: reports.filter(r => r.status === 'rejected').length, color: '#ef4444' },
    { name: 'Revision', value: reports.filter(r => r.status === 'revision_requested').length, color: '#f59e0b' },
  ];

  const taskPriorityData = [
    { name: 'Urgent', value: tasks.filter(t => t.priority === 'urgent').length, color: '#ef4444' },
    { name: 'High', value: tasks.filter(t => t.priority === 'high').length, color: '#f97316' },
    { name: 'Medium', value: tasks.filter(t => t.priority === 'medium').length, color: '#3b82f6' },
    { name: 'Low', value: tasks.filter(t => t.priority === 'low').length, color: '#64748b' },
  ];

  // Calculate Weekly Activity from real data
  const getLast7Days = () => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push({
        date: d.toISOString().split('T')[0],
        day: d.toLocaleDateString('en-US', { weekday: 'short' }),
        reports: 0,
        tasks: 0
      });
    }
    return days;
  };

  const weeklyActivityData = getLast7Days().map(day => {
    const dayReports = reports.filter(r => r.createdAt.startsWith(day.date));
    const dayTasks = tasks.filter(t => t.createdAt.startsWith(day.date));
    const dayApproved = dayReports.filter(r => r.status === 'approved').length;
    const dayCompleted = dayTasks.filter(t => t.status === 'completed' || t.status === 'approved').length;
    
    return { 
      ...day, 
      reports: dayReports.length, 
      tasks: dayTasks.length,
      approvalRate: dayReports.length > 0 ? Math.round((dayApproved / dayReports.length) * 100) : 0,
      completionRate: dayTasks.length > 0 ? Math.round((dayCompleted / dayTasks.length) * 100) : 0
    };
  });

  const totalEvidence = reports.reduce((acc, r) => acc + (r.attachments?.length || 0), 0);
  const approvedReports = reports.filter(r => r.status === 'approved').length;
  const approvalRate = reports.length > 0 ? Math.round((approvedReports / reports.length) * 100) : 0;
  const completedTasks = tasks.filter(t => t.status === 'completed' || t.status === 'approved').length;
  const taskCompletionRate = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;

  // Productivity Heatmap Data (Last 30 days)
  const getHeatmapData = () => {
    const data = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const count = reports.filter(r => r.createdAt.startsWith(dateStr)).length + 
                    tasks.filter(t => t.createdAt.startsWith(dateStr)).length;
      data.push({ date: dateStr, count });
    }
    return data;
  };
  const heatmapData = getHeatmapData();

  // User Performance Ranking
  const userPerformance = teamMembers.map(member => {
    const userReports = reports.filter(r => r.authorId === member.uid);
    const userApproved = userReports.filter(r => r.status === 'approved').length;
    const userTasks = tasks.filter(t => t.assigneeIds.includes(member.uid));
    const userCompleted = userTasks.filter(t => t.status === 'completed' || t.status === 'approved').length;
    
    return {
      name: member.displayName,
      role: member.role,
      reports: userReports.length,
      approved: userApproved,
      tasks: userTasks.length,
      completed: userCompleted,
      score: (userApproved * 2) + userCompleted
    };
  }).sort((a, b) => b.score - a.score).slice(0, 5);

  const handleRefresh = () => {
    setLoading(true);
    // Re-triggering the useEffect by just setting loading is enough as subscriptions are active
    setTimeout(() => setLoading(false), 500);
  };

  const handleExport = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const csvData = userPerformance.map(u => ({
      Name: u.name,
      Role: u.role,
      Reports: u.reports,
      Approved: u.approved,
      Tasks: u.tasks,
      Completed: u.completed,
      Score: u.score
    }));
    
    if (csvData.length === 0) return;
    const headers = Object.keys(csvData[0]).join(',');
    const rows = csvData.map(row => Object.values(row).join(',')).join('\n');
    const csvContent = "data:text/csv;charset=utf-8," + headers + "\n" + rows;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "analytics_performance.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8 print:space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Organization Analytics</h1>
          <p className="text-slate-500 dark:text-slate-400">Deep insights into organizational performance and accountability.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleRefresh}
            className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-2 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm"
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            Refresh
          </button>
          <div className="relative group">
            <button className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-2 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm">
              <Calendar className="w-4 h-4" />
              Last 7 Days
            </button>
          </div>
          <button 
            onClick={handleExport}
            className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-2 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm"
          >
            <Download className="w-4 h-4" />
            Export PDF
          </button>
          <button 
            onClick={handleExportCSV}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 dark:shadow-none"
          >
            <FileText className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <Users className="w-6 h-6" />
            </div>
          </div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Team</p>
          <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{teamMembers.length}</h3>
        </div>
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <FileText className="w-6 h-6" />
            </div>
          </div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Report Approval Rate</p>
          <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{approvalRate}%</h3>
        </div>
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl">
              <CheckSquare className="w-6 h-6" />
            </div>
          </div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Task Completion</p>
          <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{taskCompletionRate}%</h3>
        </div>
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-xl">
              <Activity className="w-6 h-6" />
            </div>
          </div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Evidence Files</p>
          <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{totalEvidence}</h3>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Weekly Activity Trends */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
          <h3 className="font-bold text-slate-900 dark:text-white mb-8 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            Weekly Activity Trends
          </h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weeklyActivityData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" className="dark:stroke-slate-800" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <Tooltip 
                  contentStyle={{borderRadius: '12px', border: 'none', backgroundColor: '#1e293b', color: '#fff', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                />
                <Legend />
                <Line type="monotone" dataKey="reports" stroke="#4f46e5" strokeWidth={3} dot={{r: 4, fill: '#4f46e5'}} activeDot={{r: 6}} />
                <Line type="monotone" dataKey="tasks" stroke="#10b981" strokeWidth={3} dot={{r: 4, fill: '#10b981'}} activeDot={{r: 6}} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Efficiency Metrics (%) */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
          <h3 className="font-bold text-slate-900 dark:text-white mb-8 flex items-center gap-2">
            <Activity className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            Efficiency Metrics (%)
          </h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weeklyActivityData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" className="dark:stroke-slate-800" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} domain={[0, 100]} />
                <Tooltip 
                  contentStyle={{borderRadius: '12px', border: 'none', backgroundColor: '#1e293b', color: '#fff', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                />
                <Legend />
                <Line type="monotone" dataKey="approvalRate" name="Approval Rate" stroke="#f59e0b" strokeWidth={3} dot={{r: 4, fill: '#f59e0b'}} />
                <Line type="monotone" dataKey="completionRate" name="Completion Rate" stroke="#8b5cf6" strokeWidth={3} dot={{r: 4, fill: '#8b5cf6'}} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Report Status Pie Chart */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
          <h3 className="font-bold text-slate-900 dark:text-white mb-8 flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            Report Status Distribution
          </h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={reportStatusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {reportStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{borderRadius: '12px', border: 'none', backgroundColor: '#1e293b', color: '#fff', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Task Priority Bar Chart */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
          <h3 className="font-bold text-slate-900 dark:text-white mb-8 flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            Task Priority Distribution
          </h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={taskPriorityData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" className="dark:stroke-slate-800" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <Tooltip 
                  contentStyle={{borderRadius: '12px', border: 'none', backgroundColor: '#1e293b', color: '#fff', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                  cursor={{fill: '#f1f5f9', opacity: 0.4}}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {taskPriorityData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* User Performance Table */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
          <h3 className="font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            Top Performers
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-slate-500 dark:text-slate-400 text-[10px] uppercase tracking-wider font-bold border-b border-slate-100 dark:border-slate-800">
                  <th className="pb-4">Member</th>
                  <th className="pb-4 text-center">Reports</th>
                  <th className="pb-4 text-center">Tasks</th>
                  <th className="pb-4 text-right">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {userPerformance.map((perf, idx) => (
                  <tr key={idx} className="group">
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400 rounded-lg flex items-center justify-center font-bold text-xs">
                          {perf.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900 dark:text-white">{perf.name}</p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-widest">{perf.role.replace('_', ' ')}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 text-center">
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{perf.approved}/{perf.reports}</span>
                    </td>
                    <td className="py-4 text-center">
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{perf.completed}/{perf.tasks}</span>
                    </td>
                    <td className="py-4 text-right">
                      <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{perf.score}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Productivity Summary */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
          <h3 className="font-bold text-slate-900 dark:text-white mb-6">Productivity Insights</h3>
          <div className="space-y-6">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Report Approval Rate</span>
                <span className="text-sm font-bold text-slate-900 dark:text-white">{approvalRate}%</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2">
                <div className="bg-emerald-500 h-2 rounded-full transition-all duration-1000" style={{width: `${approvalRate}%`}}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Task Completion Rate</span>
                <span className="text-sm font-bold text-slate-900 dark:text-white">{taskCompletionRate}%</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2">
                <div className="bg-indigo-600 h-2 rounded-full transition-all duration-1000" style={{width: `${taskCompletionRate}%`}}></div>
              </div>
            </div>
            <div className="pt-4 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-900/30">
              <p className="text-xs text-indigo-700 dark:text-indigo-300 font-medium leading-relaxed">
                <span className="font-bold">Insight:</span> {
                  approvalRate > 80 
                    ? "Your team maintains high compliance standards. Approved reports are trending upwards."
                    : "Report approval rates are below target. Consider providing more guidance on evidence submission."
                } {
                  taskCompletionRate < 50 
                    ? "Task backlog is growing. Review high-priority tasks with the team."
                    : "Task efficiency is stable."
                }
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Productivity Heatmap */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <h3 className="font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
          <Activity className="w-5 h-5 text-indigo-600" />
          30-Day Productivity Heatmap
        </h3>
        <div className="flex flex-wrap gap-2">
          {heatmapData.map((day, i) => (
            <div 
              key={i}
              title={`${day.date}: ${day.count} activities`}
              className={cn(
                "w-4 h-4 rounded-sm transition-all cursor-help",
                day.count === 0 ? "bg-slate-100 dark:bg-slate-800" :
                day.count < 3 ? "bg-indigo-200 dark:bg-indigo-900/40" :
                day.count < 6 ? "bg-indigo-400 dark:bg-indigo-700/60" :
                day.count < 10 ? "bg-indigo-600 dark:bg-indigo-500" :
                "bg-indigo-800 dark:bg-indigo-300"
              )}
            />
          ))}
        </div>
        <div className="mt-4 flex items-center gap-4 text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold">
          <span>Less</span>
          <div className="flex gap-1">
            <div className="w-3 h-3 bg-slate-100 dark:bg-slate-800 rounded-sm" />
            <div className="w-3 h-3 bg-indigo-200 dark:bg-indigo-900/40 rounded-sm" />
            <div className="w-3 h-3 bg-indigo-400 dark:bg-indigo-700/60 rounded-sm" />
            <div className="w-3 h-3 bg-indigo-600 dark:bg-indigo-500 rounded-sm" />
            <div className="w-3 h-3 bg-indigo-800 dark:bg-indigo-300 rounded-sm" />
          </div>
          <span>More</span>
        </div>
      </div>

      {/* User Performance Ranking */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <h3 className="font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
          <Users className="w-5 h-5 text-indigo-600" />
          Team Performance Ranking
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left border-b border-slate-100 dark:border-slate-800">
                <th className="pb-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Team Member</th>
                <th className="pb-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Role</th>
                <th className="pb-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Reports</th>
                <th className="pb-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Approved</th>
                <th className="pb-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Tasks</th>
                <th className="pb-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Completed</th>
                <th className="pb-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Efficiency</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
              {userPerformance.sort((a, b) => (b.approved + b.completed) - (a.approved + a.completed)).map((perf, i) => (
                <tr key={i} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-xs font-bold text-indigo-600 dark:text-indigo-400">
                        {perf.name.charAt(0)}
                      </div>
                      <span className="text-sm font-bold text-slate-900 dark:text-white">{perf.name}</span>
                    </div>
                  </td>
                  <td className="py-4">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{perf.role.replace('_', ' ')}</span>
                  </td>
                  <td className="py-4 text-center text-sm font-medium text-slate-600 dark:text-slate-400">{perf.reports}</td>
                  <td className="py-4 text-center text-sm font-bold text-emerald-600 dark:text-emerald-400">{perf.approved}</td>
                  <td className="py-4 text-center text-sm font-medium text-slate-600 dark:text-slate-400">{perf.tasks}</td>
                  <td className="py-4 text-center text-sm font-bold text-indigo-600 dark:text-indigo-400">{perf.completed}</td>
                  <td className="py-4 text-right">
                    <div className="flex flex-col items-end">
                      <span className="text-sm font-bold text-slate-900 dark:text-white">
                        {perf.reports + perf.tasks > 0 ? Math.round(((perf.approved + perf.completed) / (perf.reports + perf.tasks)) * 100) : 0}%
                      </span>
                      <div className="w-16 h-1 bg-slate-100 dark:bg-slate-800 rounded-full mt-1 overflow-hidden">
                        <div 
                          className="h-full bg-indigo-500" 
                          style={{ width: `${perf.reports + perf.tasks > 0 ? Math.round(((perf.approved + perf.completed) / (perf.reports + perf.tasks)) * 100) : 0}%` }}
                        />
                      </div>
                    </div>
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
