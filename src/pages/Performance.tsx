import React, { useState, useEffect } from 'react';
import { TrendingUp, Award, Target, Star, AlertTriangle, CheckCircle2, Clock, FileText } from 'lucide-react';
import { auth } from '../firebase';
import { getUserProfile, getOrganizationById } from '../services/firebaseService';
import { UserProfile, Organization } from '../types';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function Performance() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [org, setOrg] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    score: 0,
    tasksCompleted: 0,
    reportsSubmitted: 0,
    averageRating: 0,
    deadlinesMet: 0
  });
  const [feedbacks, setFeedbacks] = useState<any[]>([]);

  useEffect(() => {
    const loadData = async () => {
      if (!auth.currentUser) return;
      const profile = await getUserProfile(auth.currentUser.uid);
      setUser(profile);
      if (profile) {
        const orgData = await getOrganizationById(profile.orgId);
        setOrg(orgData);
        await calculatePerformance(profile.uid, profile.orgId);
      }
      setLoading(false);
    };
    loadData();
  }, []);

  const calculatePerformance = async (userId: string, orgId: string) => {
    try {
      // Fetch user's tasks
      const tasksQuery = query(collection(db, 'tasks'), where('orgId', '==', orgId), where('assigneeIds', 'array-contains', userId));
      const tasksSnap = await getDocs(tasksQuery);
      const tasks = tasksSnap.docs.map(doc => doc.data());
      
      const completedTasks = tasks.filter(t => t.status === 'completed');
      const deadlinesMet = completedTasks.filter(t => new Date(t.updatedAt || t.createdAt) <= new Date(t.deadline)).length;

      // Fetch user's reports
      const reportsQuery = query(collection(db, 'reports'), where('orgId', '==', orgId), where('authorId', '==', userId));
      const reportsSnap = await getDocs(reportsQuery);
      const reports = reportsSnap.docs.map(doc => doc.data());
      
      const ratedReports = reports.filter(r => r.rating !== undefined);
      const averageRating = ratedReports.length > 0 
        ? ratedReports.reduce((acc, r) => acc + (r.rating || 0), 0) / ratedReports.length 
        : 0;

      // Fetch user's feedback
      const feedbackQuery = query(collection(db, 'feedback'), where('orgId', '==', orgId), where('recipientId', '==', userId));
      const feedbackSnap = await getDocs(feedbackQuery);
      const userFeedbacks = feedbackSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setFeedbacks(userFeedbacks.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));

      // Calculate a simple score (0-100)
      let score = 0;
      if (tasks.length > 0) {
        score += (completedTasks.length / tasks.length) * 40; // 40% weight on task completion
      }
      if (completedTasks.length > 0) {
        score += (deadlinesMet / completedTasks.length) * 30; // 30% weight on meeting deadlines
      }
      if (averageRating > 0) {
        score += (averageRating / 5) * 30; // 30% weight on report ratings
      }

      setStats({
        score: Math.round(score),
        tasksCompleted: completedTasks.length,
        reportsSubmitted: reports.length,
        averageRating: Number(averageRating.toFixed(1)),
        deadlinesMet
      });
    } catch (error) {
      console.error('Error calculating performance:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Performance Dashboard</h1>
          <p className="text-slate-500 dark:text-slate-400">Track your automated performance score and OKRs.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Overall Score Card */}
        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-20">
            <TrendingUp className="w-24 h-24" />
          </div>
          <h3 className="text-indigo-100 font-medium mb-2">Overall Score</h3>
          <div className="flex items-end gap-2">
            <span className="text-5xl font-bold">{stats.score}</span>
            <span className="text-indigo-200 mb-1">/ 100</span>
          </div>
          <div className="mt-6 flex items-center gap-2 text-sm bg-white/20 w-fit px-3 py-1 rounded-full backdrop-blur-sm">
            {stats.score >= 80 ? (
              <><Award className="w-4 h-4" /> Top Performer</>
            ) : stats.score >= 60 ? (
              <><CheckCircle2 className="w-4 h-4" /> On Track</>
            ) : (
              <><AlertTriangle className="w-4 h-4" /> Needs Improvement</>
            )}
          </div>
        </div>

        {/* Metrics Cards */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-center">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <Target className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Tasks Completed</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.tasksCompleted}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <Clock className="w-4 h-4" />
            <span>{stats.deadlinesMet} deadlines met</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-center">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-xl">
              <Star className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Average Rating</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.averageRating} <span className="text-sm font-normal text-slate-500">/ 5</span></p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <FileText className="w-4 h-4" />
            <span>{stats.reportsSubmitted} reports submitted</span>
          </div>
        </div>
      </div>

      {/* OKRs Section */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
          <Target className="w-5 h-5 text-indigo-600" />
          Current Objectives & Key Results (OKRs)
        </h3>
        
        <div className="space-y-6">
          {/* Example OKR 1 */}
          <div className="p-4 border border-slate-100 dark:border-slate-800 rounded-xl">
            <div className="flex justify-between items-start mb-2">
              <h4 className="font-bold text-slate-900 dark:text-white">Improve Report Quality</h4>
              <span className="px-2 py-1 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-bold uppercase rounded">On Track</span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Maintain an average report rating of 4.0 or higher.</p>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-300">Current: {stats.averageRating}</span>
                <span className="font-medium text-slate-900 dark:text-white">Target: 4.0</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-emerald-500 h-2 rounded-full transition-all duration-1000" 
                  style={{ width: `${Math.min((stats.averageRating / 4) * 100, 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Example OKR 2 */}
          <div className="p-4 border border-slate-100 dark:border-slate-800 rounded-xl">
            <div className="flex justify-between items-start mb-2">
              <h4 className="font-bold text-slate-900 dark:text-white">Task Efficiency</h4>
              <span className="px-2 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 text-xs font-bold uppercase rounded">In Progress</span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Complete 10 tasks before their deadline.</p>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-300">Current: {stats.deadlinesMet}</span>
                <span className="font-medium text-slate-900 dark:text-white">Target: 10</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-indigo-500 h-2 rounded-full transition-all duration-1000" 
                  style={{ width: `${Math.min((stats.deadlinesMet / 10) * 100, 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Feedback Section */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
          <Star className="w-5 h-5 text-amber-500" />
          Recent Micro-Appraisals
        </h3>
        
        {feedbacks.length === 0 ? (
          <div className="text-center py-8 text-slate-500 dark:text-slate-400">
            <Star className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>No feedback received yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {feedbacks.map((feedback) => (
              <div key={feedback.id} className="p-4 border border-slate-100 dark:border-slate-800 rounded-xl">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 dark:text-white">{feedback.authorName}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {new Date(feedback.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star 
                        key={star} 
                        className={cn(
                          "w-4 h-4", 
                          feedback.rating >= star ? "text-amber-500 fill-current" : "text-slate-300 dark:text-slate-600"
                        )} 
                      />
                    ))}
                  </div>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-300">{feedback.text}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
