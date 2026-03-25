import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  CheckSquare, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  Calendar,
  User,
  Filter,
  Search,
  MoreVertical,
  Flag,
  X,
  MessageSquare,
  Trash2,
  Check,
  ChevronRight,
  UserCheck,
  RefreshCw,
  Download,
  FileText
} from 'lucide-react';
import { auth, db } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { 
  getUserProfile, 
  subscribeToTasks, 
  createTask,
  logAudit,
  sendNotification,
  updateTaskStatus,
  updateTaskChecklist
} from '../services/firebaseService';
import { UserProfile, Task } from '../types';
import { format } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import CommentSection from '../components/CommentSection';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function Tasks() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<string[]>([]);
  const [leadAssigneeId, setLeadAssigneeId] = useState<string>('');
  const [checklistItems, setChecklistItems] = useState<{ id: string; text: string; completed: boolean }[]>([]);
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [deadline, setDeadline] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [submitting, setSubmitting] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [teamMembers, setTeamMembers] = useState<UserProfile[]>([]);

  const taskTemplates = [
    {
      title: 'Daily Inventory Check',
      description: 'Perform a full count of all items in the main warehouse. Verify against the digital inventory system and report any discrepancies.',
      checklist: [
        { id: '1', text: 'Count main warehouse items', completed: false },
        { id: '2', text: 'Verify against digital records', completed: false },
        { id: '3', text: 'Report discrepancies to manager', completed: false }
      ],
      priority: 'medium'
    },
    {
      title: 'Weekly Safety Audit',
      description: 'Conduct a comprehensive safety inspection of the facility. Ensure all fire extinguishers are accessible, emergency exits are clear, and safety signage is visible.',
      checklist: [
        { id: '1', text: 'Check fire extinguishers', completed: false },
        { id: '2', text: 'Inspect emergency exits', completed: false },
        { id: '3', text: 'Verify safety signage', completed: false },
        { id: '4', text: 'Document any hazards', completed: false }
      ],
      priority: 'high'
    },
    {
      title: 'End of Shift Report',
      description: 'Complete the end-of-shift report detailing all activities, incidents, and pending tasks for the next shift.',
      checklist: [
        { id: '1', text: 'Summarize shift activities', completed: false },
        { id: '2', text: 'Document any incidents', completed: false },
        { id: '3', text: 'List pending tasks for next shift', completed: false }
      ],
      priority: 'low'
    }
  ];

  const applyTemplate = (template: typeof taskTemplates[0]) => {
    setTitle(template.title);
    setDescription(template.description);
    setChecklistItems(template.checklist);
    setPriority(template.priority as any);
  };

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged(async (authUser) => {
      if (authUser) {
        const profile = await getUserProfile(authUser.uid);
        setUser(profile);
        if (profile) {
          const unsubTasks = subscribeToTasks(profile.orgId, (data) => {
            setTasks(data);
            setLoading(false);
          }, profile.role === 'WORKER' ? { assigneeId: profile.uid } : undefined);

          // Fetch team members for assignment
          const q = query(collection(db, 'users'), where('orgId', '==', profile.orgId), where('status', '==', 'active'));
          const unsubTeam = onSnapshot(q, (snapshot) => {
            setTeamMembers(snapshot.docs.map(doc => doc.data() as UserProfile));
          });

          return () => {
            unsubTasks();
            unsubTeam();
          };
        }
      }
    });
    return () => unsubscribeAuth();
  }, []);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || selectedAssigneeIds.length === 0) return;
    setSubmitting(true);

    try {
      await createTask({
        title,
        description,
        assigneeIds: selectedAssigneeIds,
        leadAssigneeId: leadAssigneeId || selectedAssigneeIds[0],
        creatorId: user.uid,
        orgId: user.orgId,
        deadline: new Date(deadline).toISOString(),
        status: 'pending',
        priority,
        checklist: checklistItems,
        createdAt: new Date().toISOString()
      });

      // Notify all assignees
      for (const id of selectedAssigneeIds) {
        await sendNotification(
          id,
          'New Task Assigned',
          `You have been assigned a new task: ${title}${id === leadAssigneeId ? ' (You are the Lead)' : ''}`,
          'task_assigned'
        );
      }

      setIsModalOpen(false);
      setTitle('');
      setDescription('');
      setSelectedAssigneeIds([]);
      setLeadAssigneeId('');
      setChecklistItems([]);
      setDeadline('');
      setPriority('medium');
    } catch (error) {
      console.error('Error creating task:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (taskId: string, newStatus: Task['status']) => {
    setUpdatingStatus(true);
    try {
      await updateTaskStatus(taskId, newStatus);
      if (selectedTask) setSelectedTask({ ...selectedTask, status: newStatus });
      
      // Notify creator if worker updates, or workers if supervisor updates
      const isAssignee = selectedTask?.assigneeIds.includes(user?.uid || '');
      const recipients = isAssignee ? [selectedTask?.creatorId] : selectedTask?.assigneeIds;
      
      for (const recipientId of (recipients || [])) {
        if (recipientId) {
          await sendNotification(
            recipientId,
            'Task Status Updated',
            `Task "${selectedTask?.title}" is now ${newStatus.replace('_', ' ')}`,
            'task_status_update'
          );
        }
      }
    } catch (error) {
      console.error('Error updating task status:', error);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleToggleChecklistItem = async (itemId: string) => {
    if (!selectedTask || !user) return;
    
    const updatedChecklist = selectedTask.checklist?.map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          completed: !item.completed,
          completedBy: !item.completed ? user.uid : undefined,
          completedAt: !item.completed ? new Date().toISOString() : undefined
        };
      }
      return item;
    });

    try {
      await updateTaskChecklist(selectedTask.id, updatedChecklist);
      setSelectedTask({ ...selectedTask, checklist: updatedChecklist });
    } catch (error) {
      console.error('Error updating checklist:', error);
    }
  };

  const filteredTasks = tasks.filter(t => {
    const matchesSearch = t.title.toLowerCase().includes(search.toLowerCase()) || 
                         t.description.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filterStatus === 'all' || t.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const getPriorityColor = (p: string) => {
    switch (p) {
      case 'urgent': return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30';
      case 'high': return 'text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30';
      case 'medium': return 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30';
      default: return 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800';
    }
  };

  const handleRefresh = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 500);
  };

  const handleExport = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const csvData = tasks.map(t => ({
      ID: t.id,
      Title: t.title,
      Status: t.status,
      Priority: t.priority,
      Deadline: t.deadline,
      Assignees: t.assigneeIds.join('; ')
    }));
    
    if (csvData.length === 0) return;
    const headers = Object.keys(csvData[0]).join(',');
    const rows = csvData.map(row => Object.values(row).map(v => `"${v}"`).join(',')).join('\n');
    const csvContent = "data:text/csv;charset=utf-8," + headers + "\n" + rows;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "tasks_export.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 print:space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Tasks</h1>
          <p className="text-slate-500 dark:text-slate-400">Assign and track accountability through tasks.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleRefresh}
            className="flex items-center justify-center gap-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-4 py-3 rounded-xl font-semibold border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm"
          >
            <RefreshCw className={cn("w-5 h-5", loading && "animate-spin")} />
            Refresh
          </button>
          {user && ['SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER', 'SUPERVISOR'].includes(user.role) && (
            <button 
              onClick={() => setIsModalOpen(true)}
              className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 dark:shadow-none"
            >
              <Plus className="w-5 h-5" />
              Assign Task
            </button>
          )}
          <button 
            onClick={handleExportCSV}
            className="flex items-center justify-center gap-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-4 py-3 rounded-xl font-semibold border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm"
          >
            <Download className="w-5 h-5" />
            Export CSV
          </button>
          <button 
            onClick={handleExport}
            className="flex items-center justify-center gap-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-4 py-3 rounded-xl font-semibold border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm"
          >
            <FileText className="w-5 h-5" />
            Export PDF
          </button>
        </div>
      </div>

      {/* Quick Task Bar */}
      {user && ['SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER', 'SUPERVISOR'].includes(user.role) && (
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="flex-1 w-full">
              <input 
                type="text"
                placeholder="Quickly add a task title..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && title.trim()) {
                    setIsModalOpen(true);
                  }
                }}
                className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900 outline-none transition-all text-sm"
              />
            </div>
            <button 
              onClick={() => title.trim() && setIsModalOpen(true)}
              className="w-full sm:w-auto px-6 py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-xl text-xs font-bold border border-indigo-100 dark:border-indigo-900/30 hover:bg-indigo-100 transition-all"
            >
              CONTINUE TO ASSIGN
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search tasks..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border-transparent focus:bg-white dark:focus:bg-slate-700 focus:border-indigo-500 rounded-xl text-sm transition-all outline-none text-slate-900 dark:text-white"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select 
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="submitted">Submitted</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>

      {/* Tasks List */}
      <div className="grid grid-cols-1 gap-4">
        {filteredTasks.map((task) => (
          <div 
            key={task.id} 
            onClick={() => setSelectedTask(task)}
            className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row md:items-center gap-6 cursor-pointer group"
          >
            <div className={cn(
              "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110",
              task.status === 'completed' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
            )}>
              {task.status === 'completed' ? <CheckCircle2 className="w-6 h-6" /> : <CheckSquare className="w-6 h-6" />}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1">
                <h3 className="font-bold text-slate-900 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{task.title}</h3>
                <span className={cn(
                  "px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider",
                  getPriorityColor(task.priority)
                )}>
                  {task.priority}
                </span>
                {task.leadAssigneeId && (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-lg">
                    <UserCheck className="w-3 h-3" />
                    Lead Assigned
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-1">{task.description}</p>
              
              {task.checklist && task.checklist.length > 0 && (
                <div className="mt-3 flex items-center gap-3">
                  <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden max-w-[200px]">
                    <div 
                      className="h-full bg-indigo-500 transition-all duration-500" 
                      style={{ width: `${(task.checklist.filter(i => i.completed).length / task.checklist.length) * 100}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    {task.checklist.filter(i => i.completed).length}/{task.checklist.length} Steps
                  </span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-6 shrink-0">
              <div className="flex -space-x-2">
                {task.assigneeIds.slice(0, 3).map((id, i) => (
                  <div key={i} className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 border-2 border-white dark:border-slate-900 flex items-center justify-center text-[8px] font-bold text-slate-600 dark:text-slate-400">
                    {id.slice(0, 2).toUpperCase()}
                  </div>
                ))}
                {task.assigneeIds.length > 3 && (
                  <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900 border-2 border-white dark:border-slate-900 flex items-center justify-center text-[8px] font-bold text-indigo-600 dark:text-indigo-400">
                    +{task.assigneeIds.length - 3}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                <MessageSquare className="w-4 h-4" />
                <span className="text-xs font-medium">Discuss</span>
              </div>
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                <Calendar className="w-4 h-4" />
                <span className="text-xs font-medium">Due {format(new Date(task.deadline), 'MMM d')}</span>
              </div>
              <div className={cn(
                "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider",
                task.status === 'completed' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' :
                task.status === 'overdue' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' :
                'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              )}>
                {task.status.replace('_', ' ')}
              </div>
            </div>
          </div>
        ))}

        {filteredTasks.length === 0 && !loading && (
          <div className="py-20 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
            <CheckSquare className="w-12 h-12 text-slate-200 dark:text-slate-700 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">No tasks found</h3>
            <p className="text-slate-500 dark:text-slate-400">Assign tasks to your team to start tracking accountability.</p>
          </div>
        )}
      </div>

      {/* Task Details Modal */}
      {selectedTask && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center sm:p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 w-full h-full sm:h-auto sm:max-w-4xl sm:max-h-[90vh] sm:rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col">
            <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900 shrink-0">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className={cn(
                  "w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center",
                  selectedTask.status === 'completed' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                )}>
                  {selectedTask.status === 'completed' ? <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" /> : <CheckSquare className="w-4 h-4 sm:w-5 sm:h-5" />}
                </div>
                <div className="min-w-0">
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">{selectedTask.title}</h2>
                  <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400">Due {format(new Date(selectedTask.deadline), 'MMMM d, yyyy')}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedTask(null)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                <X className="w-6 h-6 text-slate-400 dark:text-slate-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-8">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 sm:gap-12">
                <div className="lg:col-span-2 space-y-8">
                  <section>
                    <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4">Description</h4>
                    <p className="text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{selectedTask.description}</p>
                  </section>

                  {selectedTask.checklist && selectedTask.checklist.length > 0 && (
                    <section>
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Task Checklist</h4>
                        <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded-lg">
                          {Math.round((selectedTask.checklist.filter(i => i.completed).length / selectedTask.checklist.length) * 100)}% Complete
                        </span>
                      </div>
                      <div className="space-y-3">
                        {selectedTask.checklist.map((item) => (
                          <div 
                            key={item.id}
                            onClick={() => selectedTask.assigneeIds.includes(user?.uid || '') && handleToggleChecklistItem(item.id)}
                            className={cn(
                              "flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer",
                              item.completed 
                                ? "bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30" 
                                : "bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-indigo-900"
                            )}
                          >
                            <div className={cn(
                              "w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all",
                              item.completed 
                                ? "bg-emerald-500 border-emerald-500 text-white" 
                                : "border-slate-200 dark:border-slate-600"
                            )}>
                              {item.completed && <Check className="w-4 h-4" />}
                            </div>
                            <div className="flex-1">
                              <p className={cn(
                                "text-sm font-medium transition-all",
                                item.completed ? "text-slate-400 dark:text-slate-500 line-through" : "text-slate-700 dark:text-slate-200"
                              )}>
                                {item.text}
                              </p>
                              {item.completedBy && (
                                <p className="text-[10px] text-slate-400 mt-0.5">
                                  Completed by {teamMembers.find(m => m.uid === item.completedBy)?.displayName || 'Team Member'}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Comments Section */}
                  {user && <CommentSection parentId={selectedTask.id} user={user} />}
                </div>

                <div className="space-y-6">
                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-3xl p-6 space-y-6">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-3">Task Status</p>
                      <div className="flex flex-col gap-2">
                        <span className={cn(
                          "px-4 py-2 rounded-xl text-xs font-bold text-center uppercase tracking-wider",
                          selectedTask.status === 'completed' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' :
                          selectedTask.status === 'overdue' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' :
                          'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                        )}>
                          {selectedTask.status.replace('_', ' ')}
                        </span>

                        {/* Status Actions */}
                        <div className="mt-4 space-y-2">
                          {selectedTask.status === 'pending' && selectedTask.assigneeIds.includes(user?.uid || '') && (
                            <button
                              onClick={() => handleUpdateStatus(selectedTask.id, 'in_progress')}
                              disabled={updatingStatus}
                              className="w-full bg-indigo-600 text-white py-2 rounded-xl text-[10px] font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 dark:shadow-none"
                            >
                              START TASK
                            </button>
                          )}
                          {selectedTask.status === 'in_progress' && selectedTask.assigneeIds.includes(user?.uid || '') && (
                            <button
                              onClick={() => handleUpdateStatus(selectedTask.id, 'submitted')}
                              disabled={updatingStatus}
                              className="w-full bg-indigo-600 text-white py-2 rounded-xl text-[10px] font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 dark:shadow-none"
                            >
                              SUBMIT FOR REVIEW
                            </button>
                          )}
                          {selectedTask.status === 'submitted' && ['SUPERVISOR', 'MANAGER', 'ORG_ADMIN'].includes(user?.role || '') && (
                            <button
                              onClick={() => handleUpdateStatus(selectedTask.id, 'completed')}
                              disabled={updatingStatus}
                              className="w-full bg-emerald-600 text-white py-2 rounded-xl text-[10px] font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 dark:shadow-none"
                            >
                              MARK COMPLETED
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div>
                      <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-3">Assignees</p>
                      <div className="flex flex-col gap-2">
                        {selectedTask.assigneeIds.map((id) => {
                          const member = teamMembers.find(m => m.uid === id);
                          const isLead = id === selectedTask.leadAssigneeId;
                          return (
                            <div key={id} className={cn(
                              "flex items-center gap-3 p-2 rounded-xl border transition-all",
                              isLead ? "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-900/30" : "bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700"
                            )}>
                              <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-xs font-bold text-indigo-600 dark:text-indigo-400">
                                {member?.displayName.charAt(0) || id.slice(0, 2).toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{member?.displayName || 'Unknown'}</p>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-widest">{isLead ? 'Lead Assignee' : member?.role.replace('_', ' ')}</p>
                              </div>
                              {isLead && <UserCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400 mr-2" />}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-500 dark:text-slate-400">
                          {selectedTask.creatorId.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Creator</p>
                          <p className="text-xs font-medium text-slate-700 dark:text-slate-300">UID: {selectedTask.creatorId.slice(0, 8)}...</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assign Task Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center sm:p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 w-full h-full sm:h-auto sm:max-w-lg sm:rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col">
            <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-indigo-600 text-white shrink-0">
              <h2 className="text-lg sm:text-xl font-bold">Assign New Task</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleCreateTask} className="p-4 sm:p-6 space-y-6 overflow-y-auto flex-1">
              {/* Template Selector */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Quick Templates</label>
                <div className="flex flex-wrap gap-2">
                  {taskTemplates.map((template, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => applyTemplate(template)}
                      className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-lg text-xs font-bold border border-indigo-100 dark:border-indigo-900/30 hover:bg-indigo-100 transition-all"
                    >
                      {template.title}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Task Title</label>
                <input 
                  required
                  type="text" 
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Complete Inventory Audit"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Instructions</label>
                <textarea 
                  required
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Provide detailed instructions for the task..."
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900 outline-none transition-all resize-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Assignees</label>
                    <div className="flex gap-2">
                      <button 
                        type="button"
                        onClick={() => setSelectedAssigneeIds(teamMembers.map(m => m.uid))}
                        className="text-[10px] font-bold text-indigo-600 uppercase hover:underline"
                      >
                        All
                      </button>
                      <button 
                        type="button"
                        onClick={() => {
                          setSelectedAssigneeIds([]);
                          setLeadAssigneeId('');
                        }}
                        className="text-[10px] font-bold text-red-600 uppercase hover:underline"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                  <div className="max-h-40 overflow-y-auto p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                    {teamMembers.map(member => (
                      <label key={member.uid} className="flex items-center gap-3 cursor-pointer group">
                        <input 
                          type="checkbox"
                          checked={selectedAssigneeIds.includes(member.uid)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedAssigneeIds([...selectedAssigneeIds, member.uid]);
                            } else {
                              setSelectedAssigneeIds(selectedAssigneeIds.filter(id => id !== member.uid));
                              if (leadAssigneeId === member.uid) setLeadAssigneeId('');
                            }
                          }}
                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
                        />
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-[8px] font-bold text-indigo-600 dark:text-indigo-400">
                            {member.displayName.charAt(0)}
                          </div>
                          <span className="text-xs text-slate-700 dark:text-slate-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{member.displayName}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Lead Assignee</label>
                    <select
                      value={leadAssigneeId}
                      onChange={(e) => setLeadAssigneeId(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900 outline-none transition-all text-sm"
                    >
                      <option value="">Select Lead (Optional)</option>
                      {selectedAssigneeIds.map(id => {
                        const member = teamMembers.find(m => m.uid === id);
                        return (
                          <option key={id} value={id}>{member?.displayName}</option>
                        );
                      })}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Deadline</label>
                    <input 
                      required
                      type="date" 
                      value={deadline}
                      onChange={(e) => setDeadline(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900 outline-none transition-all"
                    />
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Task Checklist</label>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{checklistItems.length} Items</span>
                </div>
                <div className="space-y-2 mb-3">
                  {checklistItems.map((item) => (
                    <div key={item.id} className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 p-2 rounded-xl group">
                      <div className="w-5 h-5 rounded bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 flex items-center justify-center">
                        <CheckSquare className="w-3 h-3 text-slate-300" />
                      </div>
                      <span className="flex-1 text-xs text-slate-700 dark:text-slate-300">{item.text}</span>
                      <button 
                        type="button"
                        onClick={() => setChecklistItems(checklistItems.filter(i => i.id !== item.id))}
                        className="p-1 text-slate-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input 
                    type="text"
                    value={newChecklistItem}
                    onChange={(e) => setNewChecklistItem(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (newChecklistItem.trim()) {
                          setChecklistItems([...checklistItems, { id: Math.random().toString(36).substring(7), text: newChecklistItem.trim(), completed: false }]);
                          setNewChecklistItem('');
                        }
                      }
                    }}
                    placeholder="Add a step..."
                    className="flex-1 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:border-indigo-500 outline-none text-sm"
                  />
                  <button 
                    type="button"
                    onClick={() => {
                      if (newChecklistItem.trim()) {
                        setChecklistItems([...checklistItems, { id: Math.random().toString(36).substring(7), text: newChecklistItem.trim(), completed: false }]);
                        setNewChecklistItem('');
                      }
                    }}
                    className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Priority</label>
                <div className="flex gap-2">
                  {['low', 'medium', 'high', 'urgent'].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPriority(p as any)}
                      className={cn(
                        "flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all",
                        priority === p ? getPriorityColor(p) : "bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
                      )}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 px-4 rounded-xl font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={submitting}
                  className="flex-[2] bg-indigo-600 text-white py-3 px-4 rounded-xl font-semibold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 dark:shadow-none disabled:opacity-50"
                >
                  {submitting ? 'Assigning...' : 'Assign Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
