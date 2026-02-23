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
      {/* Header - Desktop & Mobile */}
      <header className="bg-dark-900 text-white shadow-lg sticky top-0 z-40">
        <div className="px-3 py-2.5 sm:px-6 sm:py-4 flex items-center justify-between">
          <div>
            <h1 className="text-base sm:text-2xl font-bold text-brand-500 tracking-wide sm:tracking-wider flex items-center gap-1.5 sm:gap-2">
              <i className="fa-solid fa-camera-retro"></i>
              <span>Daftar Harga Produk</span>
            </h1>
            <p className="text-xs text-gray-400 hidden sm:block">Daftar harga produk per merek</p>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <div className="hidden sm:flex items-center gap-3">
              <div className="text-right">
                <p className="text-white font-medium">{currentUser?.email}</p>
                <p className="text-xs">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                    isAdmin ? 'bg-brand-500 text-white' : 'bg-gray-600 text-gray-200'
                  }`}>
                    {isAdmin ? 'Admin' : 'Staff'}
                  </span>
                </p>
              </div>
            </div>
            <button
              onClick={() => logout()}
              className="p-2 hover:bg-dark-800 rounded-lg transition-colors text-gray-400 hover:text-white"
              title="Logout"
            >
              <i className="fa-solid fa-arrow-right-from-bracket"></i>
            </button>
          </div>
        </div>
      </header>

      {/* Bottom Navigation - Mobile */}
      <nav className="fixed bottom-0 left-0 right-0 bg-dark-900 text-white border-t border-dark-800 z-50 sm:hidden">
        <div className="flex">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onChangeView(item.id)}
              className={`flex-1 flex flex-col items-center justify-center py-2 transition-colors duration-200 ${
                currentView === item.id
                  ? 'text-brand-500 bg-dark-800'
                  : 'text-gray-400 hover:text-white'
              }`}
              title={item.label}
            >
              <i className={`fa-solid ${item.icon} text-lg mb-0.5`}></i>
              <span className="text-[11px] font-semibold leading-tight">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Top Navigation - Desktop */}
      <nav className="hidden sm:block bg-dark-900 text-white border-b border-dark-800 sticky top-16 z-40">
        <div className="px-6 flex">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onChangeView(item.id)}
              className={`flex items-center gap-2 px-6 py-3 transition-colors duration-200 border-b-2 ${
                currentView === item.id
                  ? 'border-brand-500 text-brand-500'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              <i className={`fa-solid ${item.icon}`}></i>
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </>
  );
};