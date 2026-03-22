import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { sendPasswordReset } from '../services/firebaseService';
import { ShieldCheck, Mail, ArrowLeft, CheckCircle } from 'lucide-react';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    setError('');
    try {
      await sendPasswordReset(email);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email. Please check the email address.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4 transition-colors duration-300">
      <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-8 border border-slate-200 dark:border-slate-800">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-indigo-200 dark:shadow-none">
            <ShieldCheck className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Supervisor Eye</h1>
          <p className="text-slate-500 dark:text-slate-400 text-center mt-2">Hierarchical Reporting & Accountability Platform</p>
        </div>

        <div className="mb-8">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Reset Password</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Enter your email address and we'll send you a link to reset your password.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 text-red-700 dark:text-red-400 rounded-xl text-sm">
            {error}
          </div>
        )}

        {success ? (
          <div className="text-center">
            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-10 h-10" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Check your email</h3>
            <p className="text-slate-500 dark:text-slate-400 mb-8">
              We've sent a password reset link to <span className="font-semibold text-slate-900 dark:text-white">{email}</span>.
            </p>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Email Address</label>
              <div className="relative">
                <Mail className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900/30 outline-none transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white py-3 px-4 rounded-xl font-semibold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 dark:shadow-none disabled:opacity-50"
            >
              {loading ? 'Sending link...' : 'Send Reset Link'}
            </button>

            <div className="text-center">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm font-medium hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Login
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
