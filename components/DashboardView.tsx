import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BrandNote } from '../types';
import { useAuth } from '../contexts/AuthContext';

interface AlgoliaHit {
  objectID: string;
  name?: string;
  brand?: string;
  costPrice?: number;
  srpPrice?: number;
}

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

const ALGOLIA_APP_ID = import.meta.env.VITE_ALGOLIA_APP_ID as string;
const ALGOLIA_API_KEY = import.meta.env.VITE_ALGOLIA_API_KEY as string;
const ALGOLIA_INDEX = import.meta.env.VITE_ALGOLIA_INDEX_NAME as string;

function AlgoliaSearch() {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<AlgoliaHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const formatRupiah = (val: number | undefined) => {
    if (val === undefined || val === null || isNaN(val)) return '—';
    return 'Rp ' + val.toLocaleString('id-ID');
  };

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setHits([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `https://${ALGOLIA_APP_ID}-dsn.algolia.net/1/indexes/${ALGOLIA_INDEX}/query`,
        {
          method: 'POST',
          headers: {
            'X-Algolia-Application-Id': ALGOLIA_APP_ID,
            'X-Algolia-API-Key': ALGOLIA_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query: q, hitsPerPage: 10 }),
        }
      );
      const data = await res.json();
      setHits(data.hits ?? []);
      setOpen(true);
    } catch {
      setHits([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 300);
  };

  const handleClear = () => {
    setQuery('');
    setHits([]);
    setOpen(false);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const isActive = focused || open;

  return (
    <div ref={containerRef} className="relative w-full">
      <div
        className="flex items-center gap-2.5 rounded-xl px-4 py-3 transition-all duration-200"
        style={{
          background: isActive ? 'rgba(14,165,233,0.04)' : 'rgba(39,39,42,0.5)',
          border: `1px solid ${isActive ? 'rgba(14,165,233,0.35)' : 'rgba(63,63,70,0.5)'}`,
          boxShadow: isActive ? '0 0 0 3px rgba(14,165,233,0.08), 0 0 24px rgba(14,165,233,0.06)' : 'none',
        }}
      >
        <i
          className="fa-solid fa-magnifying-glass text-sm shrink-0 transition-colors duration-200"
          style={{ color: isActive ? '#38bdf8' : '#71717a' }}
        ></i>
        <input
          type="text"
          value={query}
          onChange={handleInput}
          onFocus={() => { setFocused(true); if (hits.length > 0) setOpen(true); }}
          onBlur={() => setFocused(false)}
          placeholder="Cari produk..."
          className="flex-1 outline-none text-sm text-zinc-100 placeholder:text-zinc-600 bg-transparent"
        />
        {loading && <i className="fa-solid fa-spinner animate-spin text-sky-400 text-sm shrink-0"></i>}
        {query && !loading && (
          <button onClick={handleClear} className="text-zinc-600 hover:text-zinc-300 transition-colors shrink-0">
            <i className="fa-solid fa-xmark text-sm"></i>
          </button>
        )}
      </div>

      {open && hits.length > 0 && (
        <div
          className="absolute z-50 top-full mt-2 left-0 right-0 rounded-xl overflow-hidden"
          style={{
            background: '#141417',
            border: '1px solid rgba(14,165,233,0.2)',
            boxShadow: '0 0 0 1px rgba(14,165,233,0.08), 0 20px 40px rgba(0,0,0,0.6)',
          }}
        >
          <div className="max-h-80 overflow-y-auto divide-y divide-zinc-800/80">
            {hits.map((hit) => (
              <div key={hit.objectID} className="px-4 py-3 hover:bg-sky-500/5 transition-colors cursor-default">
                <p className="text-sm font-semibold text-zinc-100 truncate">{hit.name ?? '—'}</p>
                <div className="flex items-center justify-between mt-0.5 gap-2">
                  <p className="text-xs text-zinc-600 truncate">{hit.brand ?? ''}</p>
                  <div className="flex items-center gap-3 shrink-0 text-xs">
                    {hit.costPrice !== undefined && (
                      <span className="font-semibold" style={{ color: '#38bdf8' }}>{formatRupiah(hit.costPrice)}</span>
                    )}
                    {hit.srpPrice !== undefined && (
                      <span className="text-emerald-400 font-semibold">SRP {formatRupiah(hit.srpPrice)}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="px-4 py-2 border-t border-zinc-800/80 flex justify-between items-center" style={{ background: 'rgba(20,20,23,0.8)' }}>
            <span className="text-xs text-zinc-600">{hits.length} hasil ditemukan</span>
            <span className="text-[10px] text-zinc-700">Algolia</span>
          </div>
        </div>
      )}

      {open && query && hits.length === 0 && !loading && (
        <div
          className="absolute z-50 top-full mt-2 left-0 right-0 rounded-xl px-4 py-6 text-center"
          style={{ background: '#141417', border: '1px solid rgba(63,63,70,0.5)' }}
        >
          <p className="text-sm text-zinc-600">Produk tidak ditemukan</p>
        </div>
      )}
    </div>
  );
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
    <div className="min-h-screen relative" style={{ backgroundColor: '#09090b' }}>

      {/* Ambient glow layers */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div style={{ position:'absolute', top:'-15%', left:'50%', transform:'translateX(-50%)', width:'70%', height:'50%', background:'radial-gradient(ellipse, rgba(14,165,233,0.08) 0%, transparent 70%)', filter:'blur(60px)' }} />
        <div style={{ position:'absolute', bottom:'5%', right:'-5%', width:'35%', height:'35%', background:'radial-gradient(ellipse, rgba(168,85,247,0.06) 0%, transparent 70%)', filter:'blur(60px)' }} />
      </div>

      {/* Delete Progress Overlay */}
      {deleteBrandProgress && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background:'rgba(0,0,0,0.75)', backdropFilter:'blur(8px)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6" style={{ background:'#141417', border:'1px solid rgba(239,68,68,0.25)', boxShadow:'0 0 40px rgba(239,68,68,0.08), 0 25px 50px rgba(0,0,0,0.8)' }}>
            <div className="absolute inset-x-0 top-0 h-px rounded-t-2xl" style={{ background:'linear-gradient(90deg,transparent,rgba(239,68,68,0.6),transparent)' }} />
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)', boxShadow:'0 0 14px rgba(239,68,68,0.2)' }}>
                <i className="fa-solid fa-trash-can text-red-400"></i>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-zinc-600 uppercase tracking-widest">Deleting</p>
                <p className="text-sm font-semibold text-zinc-100 truncate">{deleteBrandProgress.brandName}</p>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs mb-2.5">
              <div className="flex items-center gap-1.5 text-zinc-500"><i className="fa-solid fa-spinner animate-spin text-red-400"></i><span>Processing…</span></div>
              <span className="font-bold tabular-nums text-zinc-300">{deleteBrandProgress.processed} / {deleteBrandProgress.total}</span>
            </div>
            <div className="h-1 w-full rounded-full overflow-hidden" style={{ background:'rgba(239,68,68,0.1)' }}>
              <div className="h-full rounded-full transition-all duration-300" style={{ width:`${deleteProgressPercent}%`, background:'linear-gradient(90deg,#ef4444,#f87171)', boxShadow:'0 0 8px rgba(239,68,68,0.6)' }} />
            </div>
            <p className="mt-3 text-[11px] text-zinc-600 text-center">Keep this tab open until complete.</p>
          </div>
        </div>
      )}

      {/* Page Header */}
      <div className="relative px-4 sm:px-6 lg:px-8 py-5" style={{ borderBottom:'1px solid rgba(14,165,233,0.08)' }}>
        <div className="max-w-7xl mx-auto">
          <h1 className="text-lg sm:text-xl font-bold tracking-tight" style={{ background:'linear-gradient(135deg,#fff 30%,#7dd3fc 100%)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>
            Dashboard
          </h1>
          <p className="text-xs text-zinc-600 mt-0.5">Real-time inventory overview</p>
        </div>
      </div>

      <div className="relative px-4 sm:px-6 lg:px-8 py-5 sm:py-7">
        <div className="max-w-7xl mx-auto space-y-5">

          {/* Search */}
          <div className="relative rounded-2xl p-4" style={{ background:'rgba(20,20,23,0.8)', border:'1px solid rgba(63,63,70,0.4)', backdropFilter:'blur(8px)', zIndex: 20 }}>
            <AlgoliaSearch />
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 sm:gap-4">
            {/* Products — blue */}
            <div className="relative rounded-2xl px-4 py-4 sm:px-5 sm:py-5 overflow-hidden" style={{ background:'linear-gradient(135deg,rgba(59,130,246,0.07) 0%,rgba(9,9,11,0) 60%),#141417', border:'1px solid rgba(59,130,246,0.2)', boxShadow:'0 0 30px rgba(59,130,246,0.06)' }}>
              <div className="absolute inset-x-0 top-0 h-px" style={{ background:'linear-gradient(90deg,transparent,rgba(59,130,246,0.8),transparent)' }} />
              <div className="w-9 h-9 rounded-xl items-center justify-center mb-3 hidden sm:flex" style={{ background:'rgba(59,130,246,0.1)', border:'1px solid rgba(59,130,246,0.2)', boxShadow:'0 0 14px rgba(59,130,246,0.2)' }}>
                <i className="fa-solid fa-boxes text-blue-400 text-sm"></i>
              </div>
              <p className="text-[10px] sm:text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-1.5">Products</p>
              <p className="text-2xl sm:text-3xl font-bold tabular-nums leading-none" style={{ background:'linear-gradient(135deg,#fff 20%,#93c5fd 100%)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>{totalItems}</p>
              <p className="text-[11px] text-zinc-600 mt-1.5 hidden sm:block">Total in inventory</p>
            </div>
            {/* Value — emerald */}
            <div className="relative rounded-2xl px-4 py-4 sm:px-5 sm:py-5 overflow-hidden" style={{ background:'linear-gradient(135deg,rgba(16,185,129,0.07) 0%,rgba(9,9,11,0) 60%),#141417', border:'1px solid rgba(16,185,129,0.2)', boxShadow:'0 0 30px rgba(16,185,129,0.06)' }}>
              <div className="absolute inset-x-0 top-0 h-px" style={{ background:'linear-gradient(90deg,transparent,rgba(16,185,129,0.8),transparent)' }} />
              <div className="w-9 h-9 rounded-xl items-center justify-center mb-3 hidden sm:flex" style={{ background:'rgba(16,185,129,0.1)', border:'1px solid rgba(16,185,129,0.2)', boxShadow:'0 0 14px rgba(16,185,129,0.2)' }}>
                <i className="fa-solid fa-wallet text-emerald-400 text-sm"></i>
              </div>
              <p className="text-[10px] sm:text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-1.5">Value</p>
              <p className="text-base sm:text-2xl font-bold leading-none break-words" style={{ background:'linear-gradient(135deg,#fff 20%,#6ee7b7 100%)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>{formatIDR(totalValue)}</p>
              <p className="text-[11px] text-zinc-600 mt-1.5 hidden sm:block">Total inventory value</p>
            </div>
            {/* Avg Cost — violet */}
            <div className="relative rounded-2xl px-4 py-4 sm:px-5 sm:py-5 overflow-hidden" style={{ background:'linear-gradient(135deg,rgba(168,85,247,0.07) 0%,rgba(9,9,11,0) 60%),#141417', border:'1px solid rgba(168,85,247,0.2)', boxShadow:'0 0 30px rgba(168,85,247,0.06)' }}>
              <div className="absolute inset-x-0 top-0 h-px" style={{ background:'linear-gradient(90deg,transparent,rgba(168,85,247,0.8),transparent)' }} />
              <div className="w-9 h-9 rounded-xl items-center justify-center mb-3 hidden sm:flex" style={{ background:'rgba(168,85,247,0.1)', border:'1px solid rgba(168,85,247,0.2)', boxShadow:'0 0 14px rgba(168,85,247,0.2)' }}>
                <i className="fa-solid fa-chart-line text-violet-400 text-sm"></i>
              </div>
              <p className="text-[10px] sm:text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-1.5">Avg Cost</p>
              <p className="text-base sm:text-2xl font-bold leading-none break-words" style={{ background:'linear-gradient(135deg,#fff 20%,#d8b4fe 100%)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>{formatIDR(avgCost)}</p>
              <p className="text-[11px] text-zinc-600 mt-1.5 hidden sm:block">Per item average</p>
            </div>
          </div>

          {/* Main Content */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

            {/* Brands */}
            <div className="lg:col-span-2 rounded-2xl overflow-hidden" style={{ background:'#141417', border:'1px solid rgba(63,63,70,0.5)' }}>
              <div className="px-5 py-4 flex items-center justify-between gap-3" style={{ borderBottom:'1px solid rgba(63,63,70,0.4)' }}>
                <div>
                  <h2 className="text-sm font-semibold text-zinc-100">Brands</h2>
                  <p className="text-xs text-zinc-600 mt-0.5">{Object.keys(brandCounts).length} tracked</p>
                </div>
                {isAdmin && (
                  <button
                    onClick={onNavigateToUpload}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150"
                    style={{ background:'rgba(14,165,233,0.1)', color:'#38bdf8', border:'1px solid rgba(14,165,233,0.2)' }}
                    onMouseEnter={e => (e.currentTarget.style.boxShadow='0 0 16px rgba(14,165,233,0.25)')}
                    onMouseLeave={e => (e.currentTarget.style.boxShadow='none')}
                  >
                    <i className="fa-solid fa-plus text-[10px]"></i>Import
                  </button>
                )}
              </div>

              {deleteBrandProgress && (
                <div className="px-5 py-3" style={{ background:'rgba(239,68,68,0.04)', borderBottom:'1px solid rgba(239,68,68,0.15)' }}>
                  <div className="flex items-center justify-between text-xs text-red-400 mb-1.5">
                    <div className="flex items-center gap-1.5"><i className="fa-solid fa-spinner animate-spin"></i><span>Deleting {deleteBrandProgress.brandName}…</span></div>
                    <span className="font-bold tabular-nums">{deleteBrandProgress.processed}/{deleteBrandProgress.total}</span>
                  </div>
                  <div className="h-1 w-full rounded-full overflow-hidden" style={{ background:'rgba(239,68,68,0.1)' }}>
                    <div className="h-full rounded-full transition-all duration-300" style={{ width:`${deleteProgressPercent}%`, background:'linear-gradient(90deg,#ef4444,#f87171)', boxShadow:'0 0 8px rgba(239,68,68,0.5)' }} />
                  </div>
                </div>
              )}

              {sortedBrandCounts.length === 0 ? (
                <div className="py-16 text-center">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background:'rgba(63,63,70,0.3)', border:'1px solid rgba(63,63,70,0.4)' }}>
                    <i className="fa-solid fa-layer-group text-zinc-600"></i>
                  </div>
                  <p className="text-sm font-medium text-zinc-500">No brands yet</p>
                  <p className="text-xs text-zinc-700 mt-1">Import your first inventory to get started</p>
                </div>
              ) : (
                <div className="max-h-[60vh] sm:max-h-96 overflow-y-auto">
                  {sortedBrandCounts.map(([brand, count]) => {
                    const brandNote = getBrandNote(brand);
                    return (
                      <div
                        key={brand}
                        className="relative flex items-center justify-between group transition-colors duration-150"
                        style={{ borderBottom:'1px solid rgba(39,39,42,0.5)', padding:'11px 20px' }}
                        onMouseEnter={e => (e.currentTarget.style.background='rgba(14,165,233,0.03)')}
                        onMouseLeave={e => (e.currentTarget.style.background='transparent')}
                      >
                        <div className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-150" style={{ background:'linear-gradient(180deg,transparent,#0ea5e9,transparent)', boxShadow:'0 0 6px rgba(14,165,233,0.7)' }} />
                        <button onClick={() => onBrandClick(brand)} className="text-left flex-1 min-w-0 mr-3">
                          <p className="text-sm font-medium text-zinc-300 group-hover:text-white transition-colors duration-150 truncate">{brand}</p>
                          {brandNote && (
                            <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
                              {brandNote.note?.trim() && <p className="text-[11px] text-zinc-600 line-clamp-1 truncate min-w-0">{brandNote.note}</p>}
                              <span className="text-[10px] text-zinc-700 whitespace-nowrap shrink-0">{formatDate(brandNote.updatedAt || brandNote.createdAt)}</span>
                            </div>
                          )}
                        </button>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-xs font-bold tabular-nums px-2.5 py-1 rounded-full" style={{ background:'rgba(39,39,42,0.9)', color:'#71717a', border:'1px solid rgba(63,63,70,0.5)' }}>{count}</span>
                          {isAdmin && (
                            <button
                              onClick={() => { setAdjustBrandModalBrand(brand); setAdjustBrandTargetColumn('costPrice'); setAdjustBrandPercentageInput(''); }}
                              disabled={Boolean(deleteBrandProgress)}
                              title="Adjust price by %"
                              className="w-7 h-7 flex items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-150 disabled:pointer-events-none"
                              style={{ color:'#818cf8' }}
                              onMouseEnter={e => { e.currentTarget.style.background='rgba(99,102,241,0.15)'; e.currentTarget.style.boxShadow='0 0 10px rgba(99,102,241,0.25)'; }}
                              onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.boxShadow='none'; }}
                            >
                              <i className="fa-solid fa-percent text-xs"></i>
                            </button>
                          )}
                          {isAdmin && (
                            <button
                              onClick={() => { if (confirm(`Delete ${brand}?`)) onDeleteBrand(brand); }}
                              disabled={Boolean(deleteBrandProgress)}
                              className="w-7 h-7 flex items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-150 disabled:pointer-events-none"
                              style={{ color:'#f87171' }}
                              onMouseEnter={e => { e.currentTarget.style.background='rgba(239,68,68,0.12)'; e.currentTarget.style.boxShadow='0 0 10px rgba(239,68,68,0.15)'; }}
                              onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.boxShadow='none'; }}
                            >
                              <i className="fa-solid fa-trash text-xs"></i>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="rounded-2xl overflow-hidden flex flex-col" style={{ background:'#141417', border:'1px solid rgba(63,63,70,0.5)' }}>
              <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom:'1px solid rgba(63,63,70,0.4)' }}>
                <div>
                  <h2 className="text-sm font-semibold text-zinc-100">Notes</h2>
                  <p className="text-xs text-zinc-600 mt-0.5">{visibleNotes.length} saved</p>
                </div>
                {sortedBrandCounts.length > 0 && !selectedBrandForNote && (
                  <button
                    onClick={() => { setSelectedBrandForNote(sortedBrandCounts[0][0]); setNewNoteText(''); }}
                    className="w-7 h-7 flex items-center justify-center rounded-lg transition-all duration-150"
                    style={{ background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.2)', color:'#fbbf24' }}
                    onMouseEnter={e => (e.currentTarget.style.boxShadow='0 0 14px rgba(245,158,11,0.3)')}
                    onMouseLeave={e => (e.currentTarget.style.boxShadow='none')}
                  >
                    <i className="fa-solid fa-plus text-xs"></i>
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[60vh] lg:max-h-none">
                {selectedBrandForNote && (
                  <div className="rounded-xl p-4 mb-1" style={{ background:'rgba(39,39,42,0.5)', border:'1px solid rgba(63,63,70,0.5)' }}>
                    <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-3">New Note</p>
                    <select value={selectedBrandForNote} onChange={(e) => setSelectedBrandForNote(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm mb-2.5 outline-none text-zinc-200" style={{ background:'#1c1c1f', border:'1px solid rgba(63,63,70,0.6)' }}>
                      {sortedBrandCounts.map(([brand]) => <option key={brand} value={brand}>{brand}</option>)}
                    </select>
                    <textarea value={newNoteText} onChange={(e) => setNewNoteText(e.target.value)} placeholder="Write your note..." className="w-full rounded-lg px-3 py-2 text-sm mb-3 outline-none resize-none text-zinc-200 placeholder:text-zinc-600" style={{ background:'#1c1c1f', border:'1px solid rgba(63,63,70,0.6)' }} rows={2} />
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => { setSelectedBrandForNote(null); setNewNoteText(''); }} className="px-3 py-1.5 text-zinc-500 hover:text-zinc-300 rounded-lg text-xs font-medium transition-colors">Cancel</button>
                      <button
                        onClick={() => { if (selectedBrandForNote && newNoteText.trim()) { onAddBrandNote(selectedBrandForNote, newNoteText.trim()); setSelectedBrandForNote(null); setNewNoteText(''); } }}
                        disabled={!newNoteText.trim()}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 disabled:opacity-30"
                        style={{ background:'rgba(245,158,11,0.15)', color:'#fbbf24', border:'1px solid rgba(245,158,11,0.25)' }}
                      >Save</button>
                    </div>
                  </div>
                )}

                {visibleNotes.length === 0 && !selectedBrandForNote ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.12)' }}>
                      <i className="fa-regular fa-note-sticky text-amber-700"></i>
                    </div>
                    <p className="text-sm font-medium text-zinc-600">No notes yet</p>
                    <p className="text-xs text-zinc-700 mt-1">Add a note to any brand</p>
                  </div>
                ) : (
                  visibleNotes.map((note) => (
                    <div
                      key={note.id}
                      className="rounded-xl p-3 transition-all duration-200 cursor-default"
                      style={{ background:'rgba(245,158,11,0.04)', border:'1px solid rgba(245,158,11,0.15)' }}
                      onMouseEnter={e => { e.currentTarget.style.boxShadow='0 0 20px rgba(245,158,11,0.1)'; e.currentTarget.style.borderColor='rgba(245,158,11,0.3)'; }}
                      onMouseLeave={e => { e.currentTarget.style.boxShadow='none'; e.currentTarget.style.borderColor='rgba(245,158,11,0.15)'; }}
                    >
                      {editingNoteId === note.id ? (
                        <div className="space-y-2">
                          <textarea value={editingNoteText} onChange={(e) => setEditingNoteText(e.target.value)} className="w-full rounded-lg px-2.5 py-1.5 text-xs outline-none resize-none text-zinc-200" style={{ background:'#1c1c1f', border:'1px solid rgba(63,63,70,0.6)' }} rows={2} />
                          <div className="flex gap-1.5 justify-end">
                            <button onClick={() => { setEditingNoteId(null); setEditingNoteText(''); }} className="px-2.5 py-1 text-xs text-zinc-500 hover:text-zinc-300 rounded-lg font-medium transition-colors">Cancel</button>
                            <button onClick={() => { if (editingNoteText.trim()) { onUpdateBrandNote(note.id, editingNoteText.trim()); setEditingNoteId(null); setEditingNoteText(''); } }} className="px-2.5 py-1 text-xs rounded-lg font-semibold" style={{ background:'rgba(245,158,11,0.15)', color:'#fbbf24', border:'1px solid rgba(245,158,11,0.25)' }}>Save</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <p className="text-xs font-bold" style={{ color:'#fbbf24' }}>{note.brandName}</p>
                            <div className="flex gap-0.5 shrink-0">
                              <button onClick={() => { setEditingNoteId(note.id); setEditingNoteText(note.note); }} className="w-6 h-6 flex items-center justify-center rounded text-zinc-700 hover:text-sky-400 transition-colors"><i className="fa-solid fa-pen text-[10px]"></i></button>
                              <button onClick={() => { if (confirm('Delete?')) onDeleteBrandNote(note.id); }} className="w-6 h-6 flex items-center justify-center rounded text-zinc-700 hover:text-red-400 transition-colors"><i className="fa-solid fa-trash text-[10px]"></i></button>
                            </div>
                          </div>
                          <p className="text-xs leading-relaxed line-clamp-3" style={{ color:'rgba(253,230,138,0.5)' }}>{note.note}</p>
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

      {/* Adjust Brand Price Modal */}
      {adjustBrandModalBrand && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background:'rgba(0,0,0,0.75)', backdropFilter:'blur(8px)' }}>
          <div className="relative w-full max-w-sm rounded-2xl overflow-hidden" style={{ background:'#141417', border:'1px solid rgba(14,165,233,0.22)', boxShadow:'0 0 0 1px rgba(14,165,233,0.08), 0 25px 50px rgba(0,0,0,0.8)' }}>
            <div className="absolute inset-x-0 top-0 h-px" style={{ background:'linear-gradient(90deg,transparent,rgba(14,165,233,0.7),transparent)' }} />
            <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom:'1px solid rgba(63,63,70,0.4)' }}>
              <div>
                <h3 className="text-sm font-semibold text-zinc-100">Adjust Brand Price</h3>
                <p className="text-xs text-zinc-600 mt-0.5 truncate">{adjustBrandModalBrand}</p>
              </div>
              <button type="button" onClick={closeAdjustBrandModal} className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-600 hover:text-zinc-200 transition-colors" onMouseEnter={e => (e.currentTarget.style.background='rgba(63,63,70,0.4)')} onMouseLeave={e => (e.currentTarget.style.background='transparent')}>
                <i className="fa-solid fa-xmark text-sm"></i>
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-1.5">Price Column</label>
                <select value={adjustBrandTargetColumn} onChange={(e) => setAdjustBrandTargetColumn(e.target.value as 'costPrice' | 'srpPrice')} className="w-full rounded-xl px-3 py-2.5 text-sm outline-none text-zinc-200" style={{ background:'#1c1c1f', border:'1px solid rgba(63,63,70,0.6)' }}>
                  <option value="costPrice">Base Price (Harga Modal)</option>
                  <option value="srpPrice">SRP Price</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-1.5">Percentage</label>
                <input type="number" step="0.1" placeholder="e.g. 5 or -5" value={adjustBrandPercentageInput} onChange={(e) => setAdjustBrandPercentageInput(e.target.value)} className="w-full rounded-xl px-3 py-2.5 text-sm outline-none text-zinc-200 placeholder:text-zinc-700" style={{ background:'#1c1c1f', border:'1px solid rgba(63,63,70,0.6)' }} />
                <p className="mt-1.5 text-xs text-zinc-700">Positive to increase, negative to decrease.</p>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={closeAdjustBrandModal} className="px-4 py-2 text-zinc-500 hover:text-zinc-300 rounded-xl text-sm font-medium transition-colors">Cancel</button>
                <button type="button" onClick={submitAdjustBrand} className="px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-150" style={{ background:'rgba(14,165,233,0.12)', color:'#38bdf8', border:'1px solid rgba(14,165,233,0.25)' }} onMouseEnter={e => (e.currentTarget.style.boxShadow='0 0 16px rgba(14,165,233,0.25)')} onMouseLeave={e => (e.currentTarget.style.boxShadow='none')}>Apply</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};