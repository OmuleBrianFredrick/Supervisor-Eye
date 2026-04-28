import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, ArrowRight, PlayCircle, Bell, CheckCircle2, Users, BarChart3, Lock, SparklesIcon } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { auth } from '../firebase';
import AnimatedTaskDemo from '../components/AnimatedTaskDemo';
import AnimatedAnalyticsDemo from '../components/AnimatedAnalyticsDemo';

export default function Home() {
  const { theme } = useTheme();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setIsAuthenticated(!!user);
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300 font-sans selection:bg-indigo-500/30">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Supervisor Eye</span>
            </div>
            <div className="flex items-center gap-4">
              <Link to="/pricing" className="text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors hidden sm:block">
                Pricing
              </Link>
              {isAuthenticated ? (
                <Link to="/dashboard" className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 dark:shadow-none">
                  Go to Dashboard
                </Link>
              ) : (
                <>
                  <Link to="/login" className="text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                    Sign In
                  </Link>
                  <Link to="/register" className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 dark:shadow-none">
                    Get Started
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main className="pt-16">
        {/* Hero Section */}
        <section className="relative pt-24 pb-32 overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5 dark:opacity-[0.02]"></div>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] opacity-30 dark:opacity-20 pointer-events-none">
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-500 blur-[100px] rounded-full mix-blend-multiply dark:mix-blend-screen"></div>
          </div>
          
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-sm font-bold mb-8 border border-indigo-100 dark:border-indigo-800/50">
              <SparklesIcon className="w-4 h-4" />
              <span>The New Standard in Workforce Management</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-8 leading-tight">
              Empower Your Team with <br className="hidden md:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">Supervisor Eye</span>
            </h1>
            <p className="text-lg md:text-xl text-slate-600 dark:text-slate-400 max-w-3xl mx-auto mb-12 leading-relaxed">
              A comprehensive platform for reporting, task management, and performance tracking. Built for modern organizations that value transparency, accountability, and efficiency.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              {isAuthenticated ? (
                <Link to="/dashboard" className="w-full sm:w-auto flex items-center justify-center gap-2 bg-indigo-600 text-white px-8 py-4 rounded-2xl text-lg font-bold hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 dark:shadow-none hover:-translate-y-1">
                  Go to Dashboard
                  <ArrowRight className="w-5 h-5" />
                </Link>
              ) : (
                <Link to="/register" className="w-full sm:w-auto flex items-center justify-center gap-2 bg-indigo-600 text-white px-8 py-4 rounded-2xl text-lg font-bold hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 dark:shadow-none hover:-translate-y-1">
                  Start for Free
                  <ArrowRight className="w-5 h-5" />
                </Link>
              )}
              <a href="#demo" className="w-full sm:w-auto flex items-center justify-center gap-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-8 py-4 rounded-2xl text-lg font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all hover:-translate-y-1">
                <PlayCircle className="w-5 h-5" />
                Watch Demo
              </a>
            </div>
          </div>
        </section>

        {/* Announcements Section */}
        <section className="py-20 bg-white dark:bg-slate-900 border-y border-slate-200 dark:border-slate-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3 mb-12">
              <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-2xl flex items-center justify-center">
                <Bell className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Latest Announcements</h2>
                <p className="text-slate-500 dark:text-slate-400 mt-1">Stay updated with the latest features and news.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                {
                  title: "AI-Powered Reporting is Live",
                  date: "April 9, 2026",
                  content: "We've integrated advanced AI to help you draft reports from voice transcripts and analyze evidence photos automatically.",
                  tag: "New Feature",
                  color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                },
                {
                  title: "Offline Mode Now Available",
                  date: "April 5, 2026",
                  content: "Continue working even when you lose connection. Supervisor Eye now syncs your data automatically when you're back online.",
                  tag: "Update",
                  color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                },
                {
                  title: "Enhanced Workflow Automation",
                  date: "March 28, 2026",
                  content: "Create complex rules to automate task assignments, require approvals, and trigger webhooks based on report submissions.",
                  tag: "Improvement",
                  color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                }
              ].map((announcement, i) => (
                <div key={i} className="bg-slate-50 dark:bg-slate-800/50 p-8 rounded-3xl border border-slate-200 dark:border-slate-700/50 hover:shadow-lg transition-all">
                  <div className="flex items-center justify-between mb-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${announcement.color}`}>
                      {announcement.tag}
                    </span>
                    <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">{announcement.date}</span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">{announcement.title}</h3>
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{announcement.content}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Demo / Features Section */}
        <section id="demo" className="py-32">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-20">
              <h2 className="text-4xl font-bold text-slate-900 dark:text-white tracking-tight mb-6">See Supervisor Eye in Action</h2>
              <p className="text-lg text-slate-600 dark:text-slate-400">
                Discover how our platform streamlines operations, enhances accountability, and provides actionable insights for your organization.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center mb-32">
              <div className="order-2 lg:order-1">
                <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center mb-6">
                  <CheckCircle2 className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                </div>
                <h3 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">Intelligent Task Management</h3>
                <p className="text-lg text-slate-600 dark:text-slate-400 mb-8 leading-relaxed">
                  Assign tasks with precise deadlines, priorities, and checklists. Track progress in real-time and ensure nothing falls through the cracks.
                </p>
                <ul className="space-y-4">
                  {['Role-based assignments', 'Automated deadline reminders', 'Detailed sub-task checklists'].map((item, i) => (
                    <li key={i} className="flex items-center gap-3 text-slate-700 dark:text-slate-300 font-medium">
                      <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="order-1 lg:order-2 bg-slate-200 dark:bg-slate-800 rounded-3xl aspect-[4/3] overflow-hidden relative shadow-2xl border border-slate-200 dark:border-slate-700">
                <AnimatedTaskDemo />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              <div className="bg-slate-200 dark:bg-slate-800 rounded-3xl aspect-[4/3] overflow-hidden relative shadow-2xl border border-slate-200 dark:border-slate-700">
                <AnimatedAnalyticsDemo />
              </div>
              <div>
                <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/30 rounded-2xl flex items-center justify-center mb-6">
                  <BarChart3 className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                </div>
                <h3 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">Comprehensive Analytics</h3>
                <p className="text-lg text-slate-600 dark:text-slate-400 mb-8 leading-relaxed">
                  Gain deep insights into your organization's performance. Track report submission rates, task completion times, and team efficiency.
                </p>
                <ul className="space-y-4">
                  {['Customizable dashboards', 'Exportable reports (PDF/CSV)', 'Real-time performance metrics'].map((item, i) => (
                    <li key={i} className="flex items-center gap-3 text-slate-700 dark:text-slate-300 font-medium">
                      <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-24 bg-indigo-600 dark:bg-indigo-900 relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
            <h2 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-6">Ready to Transform Your Operations?</h2>
            <p className="text-xl text-indigo-100 mb-10 max-w-2xl mx-auto">
              Join thousands of organizations using Supervisor Eye to manage their teams, track performance, and ensure accountability.
            </p>
            {isAuthenticated ? (
              <Link to="/dashboard" className="inline-flex items-center justify-center gap-2 bg-white text-indigo-600 px-8 py-4 rounded-2xl text-lg font-bold hover:bg-indigo-50 transition-all shadow-xl hover:-translate-y-1">
                Go to Dashboard
                <ArrowRight className="w-5 h-5" />
              </Link>
            ) : (
              <Link to="/register" className="inline-flex items-center justify-center gap-2 bg-white text-indigo-600 px-8 py-4 rounded-2xl text-lg font-bold hover:bg-indigo-50 transition-all shadow-xl hover:-translate-y-1">
                Create Your Organization
                <ArrowRight className="w-5 h-5" />
              </Link>
            )}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            <span className="text-lg font-bold text-slate-900 dark:text-white">Supervisor Eye</span>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            &copy; {new Date().getFullYear()} Supervisor Eye. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <a href="#" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">Privacy Policy</a>
            <a href="#" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">Terms of Service</a>
            <Link to="/pricing" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">Pricing</Link>
            <Link to="/contact" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function SparklesIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
      <path d="M5 3v4" />
      <path d="M19 17v4" />
      <path d="M3 5h4" />
      <path d="M17 19h4" />
    </svg>
  );
}
