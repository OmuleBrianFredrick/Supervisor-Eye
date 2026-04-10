import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, Circle, Clock, ArrowRight } from 'lucide-react';

export default function AnimatedTaskDemo() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStep((s) => (s + 1) % 5);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  const tasks = [
    { id: 1, title: 'Review Q3 Performance Report', time: '10:00 AM', status: step >= 2 ? 'completed' : 'pending' },
    { id: 2, title: 'Approve Site Inspection', time: '11:30 AM', status: step >= 4 ? 'completed' : 'pending' },
    { id: 3, title: 'Weekly Team Sync', time: '2:00 PM', status: 'pending' },
  ];

  return (
    <div className="absolute inset-0 bg-slate-900 overflow-hidden flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-sm bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl overflow-hidden relative">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
          <h4 className="text-white font-semibold">Today's Tasks</h4>
          <span className="text-xs font-medium bg-indigo-500/20 text-indigo-400 px-2 py-1 rounded-full">
            {tasks.filter(t => t.status === 'completed').length}/3 Done
          </span>
        </div>

        {/* Task List */}
        <div className="p-5 space-y-3">
          <AnimatePresence>
            {tasks.map((task, index) => (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.2 }}
                className={`p-3 rounded-xl border flex items-start gap-3 transition-colors duration-500 ${
                  task.status === 'completed' 
                    ? 'bg-emerald-500/10 border-emerald-500/20' 
                    : 'bg-slate-700/50 border-slate-600'
                }`}
              >
                <div className="mt-0.5 shrink-0">
                  {task.status === 'completed' ? (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    >
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    </motion.div>
                  ) : (
                    <Circle className="w-5 h-5 text-slate-400" />
                  )}
                </div>
                <div>
                  <h5 className={`text-sm font-medium transition-all duration-500 ${
                    task.status === 'completed' ? 'text-slate-400 line-through' : 'text-slate-200'
                  }`}>
                    {task.title}
                  </h5>
                  <div className="flex items-center gap-1 mt-1 text-xs text-slate-500">
                    <Clock className="w-3 h-3" />
                    <span>{task.time}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Animated Cursor */}
        <motion.div
          className="absolute z-50 pointer-events-none"
          initial={{ x: 150, y: 250, opacity: 0 }}
          animate={{
            x: step === 1 ? 40 : step === 3 ? 40 : 150,
            y: step === 1 ? 90 : step === 3 ? 160 : 250,
            opacity: step === 0 ? 0 : 1,
            scale: (step === 1 || step === 3) ? 0.9 : 1
          }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-md">
            <path d="M5.5 3.21V20.8C5.5 21.45 6.27 21.79 6.75 21.35L11.44 17.02C11.68 16.8 11.99 16.68 12.31 16.68H19.5C20.17 16.68 20.5 15.87 20.03 15.4L6.53 2.55C6.08 2.12 5.5 2.44 5.5 3.21Z" fill="white" stroke="black" strokeWidth="1.5"/>
          </svg>
        </motion.div>
      </div>
    </div>
  );
}
