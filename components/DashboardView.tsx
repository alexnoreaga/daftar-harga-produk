import React, { useState } from 'react';
import { BrandNote } from '../types';
import { useAuth } from '../contexts/AuthContext';

interface DashboardViewProps {
  totalProducts: number;
  totalValue: number;
  brandCounts: Record<string, number>;
  brandNotes: BrandNote[];
  onBrandClick: (brand: string) => void;
  onNavigateToUpload: () => void;
  onAddBrandNote: (brandName: string, note: string) => void;
  onUpdateBrandNote: (noteId: string, note: string) => void;
  onDeleteBrandNote: (noteId: string) => void;
  onDeleteBrand: (brandName: string) => void;
  onAdjustBrandPrices: (brandName: string, percentage: number, targetColumn: 'costPrice' | 'srpPrice') => void;
  deleteBrandProgress: {
    brandName: string;
    processed: number;
    total: number;
  } | null;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ 
  totalProducts, 
  totalValue,
  brandCounts,
  brandNotes,
  onBrandClick, 
  onNavigateToUpload,
  onAddBrandNote,
  onUpdateBrandNote,
  onDeleteBrandNote,
  onDeleteBrand,
  onAdjustBrandPrices,
  deleteBrandProgress,
}) => {
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');
  const [selectedBrandForNote, setSelectedBrandForNote] = useState<string | null>(null);
  const [newNoteText, setNewNoteText] = useState('');
  const [adjustBrandModalBrand, setAdjustBrandModalBrand] = useState<string | null>(null);
  const [adjustBrandTargetColumn, setAdjustBrandTargetColumn] = useState<'costPrice' | 'srpPrice'>('costPrice');
  const [adjustBrandPercentageInput, setAdjustBrandPercentageInput] = useState('');
  const { isAdmin } = useAuth();
  const totalItems = totalProducts;
  const avgCost = totalItems > 0 ? totalValue / totalItems : 0;
  const deleteProgressPercent = deleteBrandProgress && deleteBrandProgress.total > 0
    ? Math.min(100, Math.round((deleteBrandProgress.processed / deleteBrandProgress.total) * 100))
    : 0;

  const sortedBrandCounts = Object.entries(brandCounts)
    .sort((a, b) => a[0].localeCompare(b[0]));

  const visibleNotes = brandNotes.filter((note) => note.note?.trim().length > 0);

  const normalizeBrand = (value?: string | null): string => {
    const normalized = (value || '').trim().toLowerCase();
    return normalized;
  };

  const getBrandNote = (brand: string): BrandNote | undefined => {
    const target = normalizeBrand(brand);
    const matched = brandNotes.filter((note) => normalizeBrand(note.brandName) === target);
    if (matched.length === 0) return undefined;
    return matched.find((note) => note.note?.trim().length > 0) || matched[0];
  };

  const formatIDR = (val: number) => {
    return val.toLocaleString('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
  };

  const formatDate = (isoDate: string) => {
    if (!isoDate) return '—';
    try {
      const date = new Date(isoDate);
      return date.toLocaleDateString('id-ID', { 
        day: '2-digit', 
        month: 'short', 
        year: 'numeric' 
      });
    } catch {
      return '—';
    }
  };

  const closeAdjustBrandModal = () => {
    setAdjustBrandModalBrand(null);
    setAdjustBrandTargetColumn('costPrice');
    setAdjustBrandPercentageInput('');
  };

  const submitAdjustBrand = () => {
    if (!adjustBrandModalBrand) return;

    const percentage = Number(adjustBrandPercentageInput.replace(',', '.').trim());
    if (!Number.isFinite(percentage) || percentage === 0) {
      alert('Please enter a valid percentage (example: 5 or -5).');
      return;
    }

    onAdjustBrandPrices(adjustBrandModalBrand, percentage, adjustBrandTargetColumn);
    closeAdjustBrandModal();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {deleteBrandProgress && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center px-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 border border-slate-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-xl">
                <i className="fa-solid fa-trash-can-arrow-up"></i>
              </div>
              <div>
                <p className="text-sm text-slate-500">Deleting brand</p>
                <p className="text-lg font-bold text-slate-900">{deleteBrandProgress.brandName}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <i className="fa-solid fa-spinner animate-spin text-red-500"></i>
              <span>Processing {deleteBrandProgress.processed}/{deleteBrandProgress.total} items</span>
            </div>
            <div className="mt-4 h-2 w-full bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-red-500 via-red-400 to-red-600 animate-pulse"
                style={{ width: `${deleteProgressPercent}%` }}
              ></div>
            </div>
            <p className="mt-3 text-xs text-slate-500">Please keep this tab open until it finishes.</p>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-3 max-[360px]:px-2.5 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-end justify-between">
            <div>
              <div className="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
                <div className="p-2 bg-brand-100 rounded-lg">
                  <i className="fa-solid fa-chart-line text-brand-600 text-base sm:text-lg"></i>
                </div>
                <h1 className="text-2xl max-[360px]:text-xl sm:text-4xl font-bold text-slate-900">Dashboard</h1>
              </div>
              <p className="text-slate-600 ml-10 sm:ml-11 text-xs sm:text-sm">Real-time inventory tracking</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-3 max-[360px]:px-2.5 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="max-w-7xl mx-auto space-y-4 sm:space-y-8">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
            {/* Total Products Card */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 sm:p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3 sm:mb-4">
                <div className="p-2.5 sm:p-3 bg-blue-100 rounded-lg">
                  <i className="fa-solid fa-boxes text-blue-600 text-lg sm:text-xl"></i>
                </div>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Products</span>
              </div>
              <p className="text-3xl max-[360px]:text-2xl sm:text-4xl font-bold text-slate-900 mb-1 leading-tight">{totalItems}</p>
              <p className="text-xs sm:text-sm text-slate-500">Total items in inventory</p>
            </div>

            {/* Total Value Card */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 sm:p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3 sm:mb-4">
                <div className="p-2.5 sm:p-3 bg-emerald-100 rounded-lg">
                  <i className="fa-solid fa-wallet text-emerald-600 text-lg sm:text-xl"></i>
                </div>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Value</span>
              </div>
              <p className="text-xl max-[360px]:text-lg sm:text-3xl font-bold text-slate-900 mb-1 leading-tight break-words">{formatIDR(totalValue)}</p>
              <p className="text-xs sm:text-sm text-slate-500">Total inventory value</p>
            </div>

            {/* Average Cost Card */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 sm:p-6 hover:shadow-md transition-shadow sm:col-span-2 lg:col-span-1">
              <div className="flex items-start justify-between mb-3 sm:mb-4">
                <div className="p-2.5 sm:p-3 bg-purple-100 rounded-lg">
                  <i className="fa-solid fa-trending-up text-purple-600 text-lg sm:text-xl"></i>
                </div>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Avg Cost</span>
              </div>
              <p className="text-xl max-[360px]:text-lg sm:text-3xl font-bold text-slate-900 mb-1 leading-tight break-words">{formatIDR(avgCost)}</p>
              <p className="text-xs sm:text-sm text-slate-500">Per item average</p>
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-8">
            {/* Brands Section */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                {/* Header */}
                <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-slate-900">Brands</h2>
                    <p className="text-xs sm:text-sm text-slate-500">{Object.keys(brandCounts).length} brands tracked</p>
                  </div>
                  {isAdmin && (
                    <button
                      onClick={onNavigateToUpload}
                      className="bg-brand-600 hover:bg-brand-700 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-medium text-xs sm:text-sm transition-all shadow-sm hover:shadow-md flex items-center gap-1.5 sm:gap-2 whitespace-nowrap"
                    >
                      <i className="fa-solid fa-plus"></i>
                      <span>Import</span>
                    </button>
                  )}
                </div>

                {/* Content */}
                <div>
                  {deleteBrandProgress && (
                    <div className="px-4 sm:px-6 py-2.5 sm:py-3 bg-red-50 border-b border-red-200 text-xs sm:text-sm text-red-700">
                      <div className="flex items-center gap-2">
                        <i className="fa-solid fa-spinner animate-spin"></i>
                        <span>Deleting {deleteBrandProgress.brandName}...</span>
                        <span className="ml-auto font-semibold">
                          {deleteBrandProgress.processed}/{deleteBrandProgress.total}
                        </span>
                      </div>
                      <div className="mt-2 h-2 w-full bg-red-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-red-500 via-red-400 to-red-600 animate-pulse"
                          style={{ width: `${deleteProgressPercent}%` }}
                        ></div>
                      </div>
                    </div>
                  )}

                  {sortedBrandCounts.length === 0 ? (
                    <div className="px-4 sm:px-6 py-12 sm:py-16 text-center">
                      <i className="fa-solid fa-inbox text-slate-300 text-4xl mb-4 block"></i>
                      <p className="text-slate-500 font-medium mb-2">No brands yet</p>
                      <p className="text-slate-400 text-sm">Start by importing your first inventory</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 max-h-[55vh] sm:max-h-96 overflow-y-auto">
                      {sortedBrandCounts.map(([brand, count]) => {
                        const brandNote = getBrandNote(brand);
                        return (
                        <div
                          key={brand}
                          className="px-4 sm:px-6 py-2.5 sm:py-3 hover:bg-slate-50 transition-colors flex items-center justify-between group"
                        >
                          <button
                            onClick={() => onBrandClick(brand)}
                            className="text-left flex-1 min-w-0"
                          >
                            <p className="font-semibold text-sm sm:text-base text-slate-900 hover:text-brand-600 transition-colors truncate">
                              {brand}
                            </p>
                            {brandNote?.note?.trim() && (
                              <div className="mt-0.5 flex items-center gap-2 min-w-0">
                                <p className="text-[11px] sm:text-xs text-slate-500 line-clamp-1 min-w-0">
                                  {brandNote.note}
                                </p>
                                <span className="text-[10px] text-slate-400 whitespace-nowrap">
                                  • {formatDate(brandNote.updatedAt || brandNote.createdAt)}
                                </span>
                              </div>
                            )}
                          </button>
                          <div className="flex items-center gap-2 sm:gap-4 ml-3 sm:ml-4">
                            <span className="text-xs sm:text-sm font-medium text-slate-600 bg-slate-100 px-2.5 sm:px-3 py-1 rounded-full whitespace-nowrap">
                              {count}
                            </span>
                            {isAdmin && (
                              <button
                                onClick={() => {
                                  setAdjustBrandModalBrand(brand);
                                  setAdjustBrandTargetColumn('costPrice');
                                  setAdjustBrandPercentageInput('');
                                }}
                                disabled={Boolean(deleteBrandProgress)}
                                className="text-slate-400 hover:text-indigo-600 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all disabled:opacity-50 p-1"
                                title="Adjust one price column by %"
                              >
                                <i className="fa-solid fa-percent text-sm"></i>
                              </button>
                            )}
                            {isAdmin && (
                              <button
                                onClick={() => {
                                  if (confirm(`Delete ${brand}?`)) {
                                    onDeleteBrand(brand);
                                  }
                                }}
                                disabled={Boolean(deleteBrandProgress)}
                                className="text-slate-400 hover:text-red-600 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all disabled:opacity-50 p-1"
                              >
                                <i className="fa-solid fa-trash text-sm"></i>
                              </button>
                            )}
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Notes Section */}
            <div>
              <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden h-full flex flex-col">
                {/* Header */}
                <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-slate-900">Notes</h2>
                    <p className="text-xs sm:text-sm text-slate-500">{visibleNotes.length} notes</p>
                  </div>
                  {sortedBrandCounts.length > 0 && !selectedBrandForNote && (
                    <button
                      onClick={() => {
                        setSelectedBrandForNote(sortedBrandCounts[0][0]);
                        setNewNoteText('');
                      }}
                      className="bg-brand-600 hover:bg-brand-700 text-white px-3 py-1.5 rounded-lg font-medium text-xs sm:text-sm transition-all"
                    >
                      <i className="fa-solid fa-plus"></i>
                    </button>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5 sm:space-y-3 max-h-[60vh] lg:max-h-none">
                  {selectedBrandForNote && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4 mb-3 sm:mb-4">
                      <h3 className="font-semibold text-slate-900 mb-2 text-sm">New Note</h3>
                      <select
                        value={selectedBrandForNote}
                        onChange={(e) => setSelectedBrandForNote(e.target.value)}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3 focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                      >
                        {sortedBrandCounts.map(([brand]) => (
                          <option key={brand} value={brand}>{brand}</option>
                        ))}
                      </select>
                      <textarea
                        value={newNoteText}
                        onChange={(e) => setNewNoteText(e.target.value)}
                        placeholder="Write your note..."
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3 focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none resize-none"
                        rows={2}
                      />
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => {
                            setSelectedBrandForNote(null);
                            setNewNoteText('');
                          }}
                          className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => {
                            if (selectedBrandForNote && newNoteText.trim()) {
                              onAddBrandNote(selectedBrandForNote, newNoteText.trim());
                              setSelectedBrandForNote(null);
                              setNewNoteText('');
                            }
                          }}
                          disabled={!newNoteText.trim()}
                          className="px-3 py-1.5 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  )}

                  {visibleNotes.length === 0 && !selectedBrandForNote ? (
                    <div className="text-center py-10 sm:py-12">
                      <i className="fa-solid fa-sticky-note text-slate-300 text-3xl mb-3 block"></i>
                      <p className="text-slate-500 font-medium text-sm">No notes yet</p>
                    </div>
                  ) : (
                    visibleNotes.map((note) => (
                      <div
                        key={note.id}
                        className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-2.5 sm:p-3 hover:shadow-sm transition-all"
                      >
                        {editingNoteId === note.id ? (
                          <div className="space-y-2">
                            <textarea
                              value={editingNoteText}
                              onChange={(e) => setEditingNoteText(e.target.value)}
                              className="w-full border border-slate-200 rounded-lg px-2 py-1 text-xs focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none resize-none"
                              rows={2}
                            />
                            <div className="flex gap-1 justify-end">
                              <button
                                onClick={() => {
                                  setEditingNoteId(null);
                                  setEditingNoteText('');
                                }}
                                className="px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-200 rounded font-medium"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => {
                                  if (editingNoteText.trim()) {
                                    onUpdateBrandNote(note.id, editingNoteText.trim());
                                    setEditingNoteId(null);
                                    setEditingNoteText('');
                                  }
                                }}
                                className="px-2 py-0.5 text-xs bg-brand-600 text-white rounded hover:bg-brand-700 font-medium"
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-amber-900 text-sm">{note.brandName}</p>
                              </div>
                              <div className="flex gap-1 flex-shrink-0">
                                <button
                                  onClick={() => {
                                    setEditingNoteId(note.id);
                                    setEditingNoteText(note.note);
                                  }}
                                  className="p-1 text-slate-400 hover:text-brand-600 transition-colors"
                                >
                                  <i className="fa-solid fa-pen text-xs"></i>
                                </button>
                                <button
                                  onClick={() => {
                                    if (confirm('Delete?')) {
                                      onDeleteBrandNote(note.id);
                                    }
                                  }}
                                  className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                                >
                                  <i className="fa-solid fa-trash text-xs"></i>
                                </button>
                              </div>
                            </div>
                            <p className="text-[11px] sm:text-xs text-amber-900 line-clamp-3">{note.note}</p>
                          </>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {adjustBrandModalBrand && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center px-4">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Adjust Brand Price</h3>
                <p className="text-xs text-slate-500 truncate">{adjustBrandModalBrand}</p>
              </div>
              <button
                type="button"
                onClick={closeAdjustBrandModal}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <i className="fa-solid fa-times"></i>
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">Price Column</label>
                <select
                  value={adjustBrandTargetColumn}
                  onChange={(e) => setAdjustBrandTargetColumn(e.target.value as 'costPrice' | 'srpPrice')}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                >
                  <option value="costPrice">Base Price (Harga Modal)</option>
                  <option value="srpPrice">SRP Price</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">Percentage</label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="e.g. 5 or -5"
                  value={adjustBrandPercentageInput}
                  onChange={(e) => setAdjustBrandPercentageInput(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                />
                <p className="mt-1 text-xs text-slate-500">Use positive for increase, negative for decrease.</p>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={closeAdjustBrandModal}
                  className="px-3.5 py-2 text-slate-700 font-medium hover:bg-slate-100 rounded-lg text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submitAdjustBrand}
                  className="px-4 py-2 bg-brand-600 text-white font-medium rounded-lg hover:bg-brand-700 text-sm transition-colors"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};