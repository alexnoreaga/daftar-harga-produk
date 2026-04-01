import React from 'react';
import { AppView } from '../types';
import { useAuth } from '../contexts/AuthContext';

interface NavbarProps {
  currentView: AppView;
  onChangeView: (view: AppView) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentView, onChangeView }) => {
  const { currentUser, logout, isAdmin } = useAuth();
  
  const allNavItems = [
    { id: AppView.DASHBOARD, label: 'Dashboard', icon: 'fa-chart-pie', adminOnly: false },
    { id: AppView.INVENTORY, label: 'Products', icon: 'fa-box-open', adminOnly: false },
    { id: AppView.UPLOAD, label: 'Import', icon: 'fa-file-import', adminOnly: true },
  ];

  const navItems = allNavItems.filter(item => !item.adminOnly || isAdmin);

  return (
    <>
      {/* Header */}
      <header
        className="sticky top-0 z-40"
        style={{
          backgroundColor: 'rgba(9,9,11,0.85)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(14,165,233,0.12)',
        }}
      >
        <div className="px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
                boxShadow: '0 0 16px rgba(14,165,233,0.5), 0 0 32px rgba(14,165,233,0.2)',
              }}
            >
              <i className="fa-solid fa-camera-retro text-white text-xs"></i>
            </div>
            <div>
              <p className="text-sm font-bold text-white tracking-tight leading-none">Daftar Harga</p>
              <p className="text-[10px] text-zinc-500 leading-none mt-0.5 hidden sm:block">per merek</p>
            </div>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden sm:flex items-center gap-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => onChangeView(item.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  currentView === item.id
                    ? 'text-sky-400'
                    : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/60'
                }`}
                style={currentView === item.id ? {
                  background: 'rgba(14,165,233,0.1)',
                  boxShadow: '0 0 14px rgba(14,165,233,0.2), inset 0 0 10px rgba(14,165,233,0.05)',
                } : {}}
              >
                <i className={`fa-solid ${item.icon} text-xs`}></i>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          {/* User + Logout */}
          <div className="flex items-center gap-2">
            <div
              className="hidden sm:flex items-center gap-2.5 rounded-lg px-3 py-1.5"
              style={{
                background: 'rgba(24,24,27,0.8)',
                border: '1px solid rgba(63,63,70,0.6)',
              }}
            >
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                style={{ background: 'rgba(14,165,233,0.15)', border: '1px solid rgba(14,165,233,0.2)' }}
              >
                <i className="fa-solid fa-user text-sky-400 text-[8px]"></i>
              </div>
              <span className="text-xs text-zinc-300 font-medium max-w-[140px] truncate">{currentUser?.email}</span>
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                style={isAdmin
                  ? { background: 'rgba(14,165,233,0.15)', color: '#38bdf8', border: '1px solid rgba(14,165,233,0.2)' }
                  : { background: 'rgba(63,63,70,0.6)', color: '#a1a1aa' }
                }
              >
                {isAdmin ? 'Admin' : 'Staff'}
              </span>
            </div>
            <button
              onClick={() => logout()}
              title="Logout"
              className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-400/10 transition-all duration-150"
            >
              <i className="fa-solid fa-arrow-right-from-bracket text-sm"></i>
            </button>
          </div>
        </div>
      </header>

      {/* Bottom Navigation - Mobile */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 sm:hidden"
        style={{
          backgroundColor: 'rgba(9,9,11,0.92)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderTop: '1px solid rgba(14,165,233,0.1)',
        }}
      >
        <div className="flex">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onChangeView(item.id)}
              className="flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 transition-all duration-150"
              style={currentView === item.id
                ? { color: '#38bdf8' }
                : { color: '#52525b' }
              }
            >
              {currentView === item.id && (
                <span
                  className="absolute top-0 w-8 h-0.5 rounded-b-full"
                  style={{ background: 'linear-gradient(90deg, transparent, #0ea5e9, transparent)' }}
                />
              )}
              <i className={`fa-solid ${item.icon} text-base`}></i>
              <span className="text-[10px] font-semibold">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </>
  );
};