import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  FileText, 
  CheckSquare, 
  Users, 
  Settings, 
  LogOut, 
  Bell, 
  Menu, 
  X,
  ShieldCheck,
  BarChart3,
  Search,
  Plus,
  Sun,
  Moon
} from 'lucide-react';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { UserProfile } from '../types';
import { getUserProfile } from '../services/firebaseService';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useTheme } from '../contexts/ThemeContext';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (authUser) => {
      if (authUser) {
        const profile = await getUserProfile(authUser.uid);
        setUser(profile);
      } else {
        setUser(null);
        if (location.pathname !== '/login' && location.pathname !== '/register') {
          navigate('/login');
        }
      }
    });
    return () => unsubscribe();
  }, [navigate, location.pathname]);

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  const menuItems = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/', roles: ['WORKER', 'SUPERVISOR', 'MANAGER', 'HR', 'IT_STAFF', 'EXECUTIVE', 'ORG_ADMIN', 'SUPER_ADMIN'] },
    { name: 'Reports', icon: FileText, path: '/reports', roles: ['WORKER', 'SUPERVISOR', 'MANAGER', 'HR', 'EXECUTIVE', 'ORG_ADMIN', 'SUPER_ADMIN'] },
    { name: 'Tasks', icon: CheckSquare, path: '/tasks', roles: ['WORKER', 'SUPERVISOR', 'MANAGER', 'ORG_ADMIN', 'SUPER_ADMIN'] },
    { name: 'Team', icon: Users, path: '/team', roles: ['SUPERVISOR', 'MANAGER', 'HR', 'ORG_ADMIN', 'SUPER_ADMIN'] },
    { name: 'Analytics', icon: BarChart3, path: '/analytics', roles: ['MANAGER', 'HR', 'EXECUTIVE', 'ORG_ADMIN', 'SUPER_ADMIN'] },
    { name: 'Admin', icon: ShieldCheck, path: '/admin', roles: ['ORG_ADMIN', 'SUPER_ADMIN'] },
    { name: 'Settings', icon: Settings, path: '/settings', roles: ['WORKER', 'SUPERVISOR', 'MANAGER', 'HR', 'IT_STAFF', 'EXECUTIVE', 'ORG_ADMIN', 'SUPER_ADMIN'] },
  ];

  const filteredMenu = menuItems.filter(item => user && item.roles.includes(user.role));

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex transition-colors duration-300">
      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 dark:bg-slate-900 text-white transform transition-transform duration-200 ease-in-out lg:relative lg:translate-x-0",
        isSidebarOpen ? "translate-x-0" : "-translate-x-0"
      )}>
        <div className="h-full flex flex-col">
          <div className="p-6 flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">Supervisor Eye</span>
          </div>

          <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
            {filteredMenu.map((item) => (
              <Link
                key={item.name}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                  location.pathname === item.path 
                    ? "bg-indigo-600 text-white" 
                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
                )}
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.name}</span>
              </Link>
            ))}
          </nav>

          <div className="p-4 border-t border-slate-800">
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-4 py-3 w-full text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">Logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 lg:px-8 sticky top-0 z-40 transition-colors duration-300">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="lg:hidden p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
            >
              {isSidebarOpen ? <X /> : <Menu />}
            </button>
            <div className="relative hidden md:block w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search reports, tasks..." 
                className="w-full pl-10 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border-transparent focus:bg-white dark:focus:bg-slate-950 focus:border-indigo-500 rounded-lg text-sm transition-all outline-none dark:text-white"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={toggleTheme}
              className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all"
              title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
            >
              {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </button>
            <button className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-slate-900"></span>
            </button>
            <div className="h-8 w-px bg-slate-200 dark:bg-slate-800 mx-2"></div>
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{user?.displayName}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">{user?.role.replace('_', ' ').toLowerCase()}</p>
              </div>
              <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 rounded-full flex items-center justify-center font-bold">
                {user?.displayName?.charAt(0)}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
