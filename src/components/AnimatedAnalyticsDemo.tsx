import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { TrendingUp, Users, Activity } from 'lucide-react';

export default function AnimatedAnalyticsDemo() {
  const [key, setKey] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setKey(k => k + 1);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const bars = [40, 70, 45, 90, 65, 85, 100];
  
  return (
    <div className="absolute inset-0 bg-slate-900 overflow-hidden flex flex-col p-6 font-sans">
      {/* Top Stats */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-800 rounded-xl p-4 border border-slate-700"
        >
          <div className="flex items-center gap-2 text-slate-400 mb-2">
            <Activity className="w-4 h-4 text-purple-400" />
            <span className="text-xs font-semibold uppercase tracking-wider">Efficiency</span>
          </div>
          <div className="text-2xl font-bold text-white flex items-baseline gap-2">
            94%
            <span className="text-xs text-emerald-400 flex items-center">
              <TrendingUp className="w-3 h-3 mr-1" /> +12%
            </span>
          </div>
        </motion.div>
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-slate-800 rounded-xl p-4 border border-slate-700"
        >
          <div className="flex items-center gap-2 text-slate-400 mb-2">
            <Users className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-semibold uppercase tracking-wider">Active</span>
          </div>
          <div className="text-2xl font-bold text-white">
            1,248
          </div>
        </motion.div>
      </div>

      {/* Main Chart Area */}
      <div className="flex-1 bg-slate-800 rounded-xl border border-slate-700 p-5 relative flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <h4 className="text-white font-semibold text-sm">Performance Overview</h4>
          <div className="flex gap-2">
            <div className="w-2 h-2 rounded-full bg-purple-500"></div>
            <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
          </div>
        </div>

        {/* Chart Grid Lines */}
        <div className="absolute inset-x-5 top-16 bottom-5 flex flex-col justify-between pointer-events-none">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="w-full h-px bg-slate-700/50"></div>
          ))}
        </div>

        {/* Animated Bars */}
        <div className="flex-1 flex items-end justify-between gap-2 z-10 mt-4 px-2">
          {bars.map((height, i) => (
            <div key={`${key}-bar-${i}`} className="w-full bg-slate-700/30 rounded-t-sm relative group">
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${height}%` }}
                transition={{ duration: 1.5, delay: i * 0.1, ease: "easeOut" }}
                className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-indigo-600 to-purple-500 rounded-t-sm opacity-80 group-hover:opacity-100 transition-opacity"
              />
            </div>
          ))}
        </div>

        {/* Animated Line Overlay */}
        <div className="absolute inset-x-5 top-16 bottom-5 z-20 pointer-events-none">
          <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
            <motion.path
              key={`${key}-line`}
              d="M 0,80 C 15,70 25,90 40,50 C 55,10 70,60 85,30 C 95,10 100,20 100,20"
              fill="none"
              stroke="#a855f7"
              strokeWidth="3"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 2, ease: "easeInOut", delay: 0.5 }}
            />
            <motion.path
              key={`${key}-area`}
              d="M 0,80 C 15,70 25,90 40,50 C 55,10 70,60 85,30 C 95,10 100,20 100,20 L 100,100 L 0,100 Z"
              fill="url(#gradient)"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1, delay: 2 }}
            />
            <defs>
              <linearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#a855f7" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>
    </div>
  );
}
