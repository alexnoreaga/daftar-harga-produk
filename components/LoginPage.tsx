import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }

    try {
      setError('');
      setLoading(true);
      await login(email, password);
    } catch (err: any) {
      console.error('Login error:', err);
      if (err.code === 'auth/invalid-credential') {
        setError('Invalid email or password');
      } else if (err.code === 'auth/user-not-found') {
        setError('No account found with this email');
      } else if (err.code === 'auth/wrong-password') {
        setError('Incorrect password');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Too many failed attempts. Please try again later');
      } else {
        setError('Failed to sign in. Please try again');
      }
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-brand-500 rounded-2xl mb-4">
            <i className="fa-solid fa-camera-retro text-white text-2xl"></i>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Daftar Harga Produk</h1>
          <p className="text-blue-200">Sign in to manage your inventory</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                <i className="fa-solid fa-circle-exclamation text-red-600 mt-0.5"></i>
                <p className="text-red-700 text-sm flex-1">{error}</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Email Address
              </label>
              <div className="relative">
                <i className="fa-solid fa-envelope absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  disabled={loading}
                  className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none text-slate-900 placeholder-slate-400 disabled:bg-slate-50"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Password
              </label>
              <div className="relative">
                <i className="fa-solid fa-lock absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={loading}
                  className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none text-slate-900 placeholder-slate-400 disabled:bg-slate-50"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-600 hover:bg-brand-700 disabled:bg-slate-300 text-white py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <i className="fa-solid fa-spinner animate-spin"></i>
                  Signing in...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-arrow-right-to-bracket"></i>
                  Sign In
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-200">
            <p className="text-center text-sm text-slate-500">
              Contact admin for access credentials
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-blue-200 text-sm mt-8">
          © 2026 Daftar Harga Produk. All rights reserved.
        </p>
      </div>
    </div>
  );
};
