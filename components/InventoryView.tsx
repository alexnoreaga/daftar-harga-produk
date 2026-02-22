import React, { useState } from 'react';
import { Product, BrandNote } from '../types';
import { useAuth } from '../contexts/AuthContext';

interface InventoryViewProps {
  products: Product[];
  totalProducts: number;
  currentPage: number;
  pageSize: number;
  hasNextPage: boolean;
  isPageLoading: boolean;
  activeBrandFilter: string | null;
  searchInput: string;
  activeSearchTerm: string;
  isSearching: boolean;
  brandNotes: BrandNote[];
  onNextPage: () => void;
  onPreviousPage: () => void;
  onClearBrandFilter: () => void;
  onSearchInputChange: (value: string) => void;
  onSearchSubmit: () => void;
  onUpdateProduct: (product: Product) => void;
  onDeleteProduct: (id: string) => void;
  onDeleteAllProducts: () => void;
  onAddProduct: (data: { name: string; brand: string; costPrice: number; srpPrice?: number }) => void;
}

export const InventoryView: React.FC<InventoryViewProps> = ({
  products,
  totalProducts,
  currentPage,
  pageSize,
  hasNextPage,
  isPageLoading,
  activeBrandFilter,
  searchInput,
  activeSearchTerm,
  isSearching,
  brandNotes,
  onNextPage,
  onPreviousPage,
  onClearBrandFilter,
  onSearchInputChange,
  onSearchSubmit,
  onUpdateProduct,
  onDeleteProduct,
  onDeleteAllProducts,
  onAddProduct
}) => {
  const { isAdmin } = useAuth();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<Product> | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newProductForm, setNewProductForm] = useState({ name: '', brand: '', costPrice: '', srpPrice: '' });
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);

  const startItem = totalProducts === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = totalProducts === 0 ? 0 : Math.min((currentPage - 1) * pageSize + products.length, totalProducts);

  const formatIDR = (val: number) => {
    return val.toLocaleString('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
  };

  const getMarginStats = (cost: number, sell: number) => {
    const profit = sell - cost;
    const margin = sell > 0 ? (profit / sell) * 100 : 0;
    return { profit, margin };
  };

  const handleSaveEdit = (product: Product) => {
    if (editFormData) {
      const cost = typeof editFormData.costPrice === 'string' ? parseFloat(editFormData.costPrice) : editFormData.costPrice;
      const srp = typeof editFormData.srpPrice === 'string' ? parseFloat(editFormData.srpPrice) : editFormData.srpPrice;
      if (!isNaN(cost)) {
        onUpdateProduct({
          ...product,
          name: editFormData.name || product.name,
          brand: editFormData.brand || product.brand,
          costPrice: cost,
          srpPrice: isNaN(srp) ? 0 : (srp || 0),
        });
      }
    }
    setEditingId(null);
    setEditFormData(null);
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProductForm.name || !newProductForm.costPrice) return;

    const cost = parseFloat(newProductForm.costPrice);
    const srp = newProductForm.srpPrice ? parseFloat(newProductForm.srpPrice) : 0;
    if (isNaN(cost)) return;

    onAddProduct({
      name: newProductForm.name,
      brand: newProductForm.brand || 'Generic',
      costPrice: cost,
      srpPrice: isNaN(srp) ? 0 : srp
    });

    setNewProductForm({ name: '', brand: '', costPrice: '', srpPrice: '' });
    setIsAddModalOpen(false);
  };

  const confirmDelete = () => {
    if (deleteConfirmId) {
      onDeleteProduct(deleteConfirmId);
      setDeleteConfirmId(null);
    }
  };

  const productToDelete = deleteConfirmId ? products.find(p => p.id === deleteConfirmId) : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 py-6 sm:py-8 sticky top-16 z-20">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div className="flex items-end gap-3">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <i className="fa-solid fa-cube text-indigo-600 text-lg"></i>
              </div>
              <div>
                <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">Products</h2>
                <p className="text-sm text-slate-600">Showing {startItem} - {endItem} of {totalProducts}</p>
              </div>
            </div>
            {isAdmin && (
              <button
                type="button"
                onClick={() => setIsAddModalOpen(true)}
                className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2.5 rounded-lg font-medium text-sm transition-all shadow-sm hover:shadow-md flex items-center gap-2 w-fit"
              >
                <i className="fa-solid fa-plus"></i>
                <span>Add Product</span>
              </button>
            )}
          </div>

          {/* Search Bar */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
              <input
                type="text"
                value={searchInput}
                onChange={(e) => onSearchInputChange(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && onSearchSubmit()}
                placeholder="Search products..."
                className="w-full px-4 pl-10 py-2.5 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
              />
              {isSearching && (
                <i className="fa-solid fa-spinner animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-brand-600 text-sm"></i>
              )}
            </div>
            <button
              onClick={onSearchSubmit}
              className="px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-medium text-sm transition-all shadow-sm hover:shadow-md flex items-center gap-2"
            >
              <i className="fa-solid fa-search text-sm"></i>
              <span className="hidden sm:inline">Search</span>
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Active Filters */}
          {(activeBrandFilter || activeSearchTerm) && (
            <div className="mb-6 flex flex-wrap gap-2 items-center">
              {activeBrandFilter && (
                <div className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-full shadow-sm">
                  <i className="fa-solid fa-tag text-brand-600 text-xs"></i>
                  <span className="font-medium text-slate-700 text-sm">{activeBrandFilter}</span>
                  <button
                    onClick={onClearBrandFilter}
                    className="text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <i className="fa-solid fa-times"></i>
                  </button>
                </div>
              )}
              {activeSearchTerm && (
                <div className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-full shadow-sm">
                  <i className="fa-solid fa-magnifying-glass text-brand-600 text-xs"></i>
                  <span className="font-medium text-slate-700 text-sm">{activeSearchTerm}</span>
                </div>
              )}
              {(activeBrandFilter || activeSearchTerm) && (
                <button
                  onClick={() => {
                    onClearBrandFilter();
                    onSearchInputChange('');
                    setTimeout(() => onSearchSubmit(), 0);
                  }}
                  className="text-sm font-medium text-brand-600 hover:text-brand-700 transition-colors"
                >
                  Clear all
                </button>
              )}
            </div>
          )}

          {/* Desktop Table View */}
          <div className="hidden md:block bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Product</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Brand</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider">Harga Modal</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider">SRP</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider">Profit</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider">Margin</th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-16 text-center">
                      <i className="fa-solid fa-inbox text-slate-300 text-4xl mb-4 block"></i>
                      <p className="text-slate-500 font-medium mb-1">No products found</p>
                      <p className="text-slate-400 text-sm">Start by adding your first product</p>
                    </td>
                  </tr>
                ) : (
                  products.map((product) => (
                    <tr key={product.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-6 py-4">
                        {editingId === product.id ? (
                          <input
                            type="text"
                            value={editFormData?.name || ''}
                            onChange={(e) => setEditFormData({...editFormData, name: e.target.value} as any)}
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                          />
                        ) : (
                          <div>
                            <p className="font-semibold text-slate-900 text-sm">{product.name}</p>
                            <p className="text-xs text-slate-500 mt-1">{product.id.substring(0, 8)}</p>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {editingId === product.id ? (
                          <input
                            type="text"
                            value={editFormData?.brand || ''}
                            onChange={(e) => setEditFormData({...editFormData, brand: e.target.value} as any)}
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => onClearBrandFilter()}
                            className="text-brand-600 hover:text-brand-700 font-semibold transition-colors text-sm"
                          >
                            {product.brand}
                          </button>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {editingId === product.id ? (
                          <input
                            type="number"
                            value={editFormData?.costPrice || ''}
                            onChange={(e) => setEditFormData({...editFormData, costPrice: parseFloat(e.target.value) || 0} as any)}
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none text-right"
                          />
                        ) : (
                          <span className="font-semibold text-slate-900 text-sm">{formatIDR(product.costPrice)}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {editingId === product.id ? (
                          <input
                            type="number"
                            value={editFormData?.srpPrice || ''}
                            onChange={(e) => setEditFormData({...editFormData, srpPrice: parseFloat(e.target.value) || 0} as any)}
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none text-right"
                          />
                        ) : (
                          <span className="font-semibold text-slate-900 text-sm">{product.srpPrice > 0 ? formatIDR(product.srpPrice) : '—'}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {(() => {
                          if (product.srpPrice === 0) {
                            return <span className="font-semibold text-slate-400 text-sm">—</span>;
                          }
                          const profit = product.srpPrice - product.costPrice;
                          return <span className={`font-semibold text-sm ${
                            profit < 0 ? 'text-red-600' : 'text-emerald-600'
                          }`}>{formatIDR(profit)}</span>;
                        })()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {(() => {
                          if (product.srpPrice === 0) {
                            return <span className="font-semibold text-slate-400 text-sm">—</span>;
                          }
                          const stats = getMarginStats(product.costPrice, product.srpPrice);
                          return (
                            <span className={`font-semibold text-sm inline-block px-2.5 py-1 rounded-full ${
                              stats.margin < 0 ? 'bg-red-100 text-red-700' :
                              'bg-emerald-100 text-emerald-700'
                            }`}>
                              {stats.margin.toFixed(1)}%
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          {editingId === product.id ? (
                            <>
                              <button
                                onClick={() => setEditingId(null)}
                                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                title="Cancel"
                              >
                                <i className="fa-solid fa-times"></i>
                              </button>
                              <button
                                onClick={() => handleSaveEdit(product)}
                                className="p-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-100 rounded-lg transition-colors"
                                title="Save"
                              >
                                <i className="fa-solid fa-check"></i>
                              </button>
                            </>
                          ) : (
                            <>
                              {isAdmin && (
                                <button
                                  onClick={() => {
                                    setEditingId(product.id);
                                    setEditFormData({...product});
                                  }}
                                  className="p-2 text-slate-400 hover:text-brand-600 hover:bg-blue-100 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                  title="Edit"
                                >
                                  <i className="fa-solid fa-pen"></i>
                                </button>
                              )}
                              {isAdmin && (
                                <button
                                  onClick={() => setDeleteConfirmId(product.id)}
                                  className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-100 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                  title="Delete"
                                >
                                  <i className="fa-solid fa-trash"></i>
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Table View - Compact */}
          <div className="md:hidden bg-white rounded-xl shadow-sm border border-slate-100 overflow-x-auto">
            {products.length === 0 ? (
              <div className="p-8 text-center">
                <i className="fa-solid fa-inbox text-slate-300 text-3xl mb-3 block"></i>
                <p className="text-slate-500 font-medium">No products found</p>
              </div>
            ) : (
              <table className="w-full min-w-[640px] text-xs">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-3 py-1.5 text-left font-semibold text-slate-700 w-[38%]">Product</th>
                    <th className="px-3 py-1.5 text-right font-semibold text-slate-700 whitespace-nowrap">Harga Modal</th>
                    <th className="px-3 py-1.5 text-right font-semibold text-slate-700 whitespace-nowrap">Profit</th>
                    <th className="px-3 py-1.5 text-center font-semibold text-slate-700 whitespace-nowrap">Margin</th>
                    <th className="px-3 py-1.5 text-center font-semibold text-slate-700 whitespace-nowrap">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {products.map((product) => (
                    <tr key={product.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-3 py-1.5 align-middle">
                        {editingId === product.id ? (
                          <div className="space-y-1">
                            <input
                              type="text"
                              value={editFormData?.name || ''}
                              onChange={(e) => setEditFormData({...editFormData, name: e.target.value} as any)}
                              className="w-full border border-slate-200 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-brand-500"
                            />
                            <input
                              type="text"
                              value={editFormData?.brand || ''}
                              onChange={(e) => setEditFormData({...editFormData, brand: e.target.value} as any)}
                              className="w-full border border-slate-200 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-brand-500"
                            />
                          </div>
                        ) : (
                          <div className="leading-tight">
                            <p className="font-semibold text-slate-900 whitespace-nowrap overflow-hidden text-ellipsis">{product.name}</p>
                            <p className="text-slate-500 text-xs whitespace-nowrap overflow-hidden text-ellipsis mt-0.5">{product.brand}</p>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-right align-middle whitespace-nowrap">
                        {editingId === product.id ? (
                          <input
                            type="number"
                            value={editFormData?.costPrice || ''}
                            onChange={(e) => setEditFormData({...editFormData, costPrice: parseFloat(e.target.value) || 0} as any)}
                            className="w-full border border-slate-200 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-brand-500 text-right"
                          />
                        ) : (
                          <span className="font-semibold text-slate-900 text-xs">{formatIDR(product.costPrice)}</span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-right align-middle whitespace-nowrap">
                        {(() => {
                          if (product.srpPrice === 0) {
                            return <span className="font-semibold text-slate-400 text-xs">—</span>;
                          }
                          const profit = product.srpPrice - product.costPrice;
                          return <span className={`font-semibold text-xs ${
                            profit < 0 ? 'text-red-600' : 'text-emerald-600'
                          }`}>{formatIDR(profit)}</span>;
                        })()}
                      </td>
                      <td className="px-3 py-1.5 text-center align-middle whitespace-nowrap">
                        {(() => {
                          if (product.srpPrice === 0) {
                            return <span className="text-slate-400 text-xs">—</span>;
                          }
                          const stats = getMarginStats(product.costPrice, product.srpPrice);
                          return (
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                              stats.margin < 0 ? 'bg-red-100 text-red-700' :
                              'bg-emerald-100 text-emerald-700'
                            }`}>
                              {stats.margin.toFixed(0)}%
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-3 py-1.5 text-center align-middle whitespace-nowrap">
                        {editingId === product.id ? (
                          <div className="flex gap-1 justify-center">
                            <button
                              onClick={() => setEditingId(null)}
                              className="text-slate-500 hover:text-slate-700 text-xs"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleSaveEdit(product)}
                              className="text-emerald-600 hover:text-emerald-700 text-xs"
                            >
                              Save
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-1 justify-center">
                            {isAdmin && (
                              <button
                                onClick={() => {
                                  setEditingId(product.id);
                                  setEditFormData({...product});
                                }}
                                className="text-brand-600 hover:text-brand-700 text-xs"
                              >
                                Edit
                              </button>
                            )}
                            {isAdmin && (
                              <button
                                onClick={() => setDeleteConfirmId(product.id)}
                                className="text-red-600 hover:text-red-700 text-xs"
                              >
                                Del
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          {totalProducts > pageSize && (
            <div className="mt-8 flex items-center justify-between bg-white rounded-xl shadow-sm border border-slate-100 p-4">
              <button
                onClick={onPreviousPage}
                disabled={currentPage === 1 || isPageLoading}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 disabled:bg-slate-50 text-slate-700 font-medium rounded-lg disabled:text-slate-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2 text-sm"
              >
                <i className="fa-solid fa-chevron-left"></i>
                <span className="hidden sm:inline">Previous</span>
              </button>

              <div className="flex items-center gap-1">
                <span className="text-sm font-medium text-slate-700">Page <span className="font-bold text-slate-900">{currentPage}</span></span>
              </div>

              <button
                onClick={onNextPage}
                disabled={!hasNextPage || isPageLoading}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 disabled:bg-slate-50 text-slate-700 font-medium rounded-lg disabled:text-slate-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2 text-sm"
              >
                <span className="hidden sm:inline">Next</span>
                <i className="fa-solid fa-chevron-right"></i>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Add Product Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-brand-100 rounded-lg">
                  <i className="fa-solid fa-plus text-brand-600"></i>
                </div>
                <h3 className="text-lg font-bold text-slate-900">Add New Product</h3>
              </div>
              <button 
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <i className="fa-solid fa-times text-lg"></i>
              </button>
            </div>
            
            <form onSubmit={handleAddSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">Product Name *</label>
                <input
                  type="text"
                  required
                  value={newProductForm.name}
                  onChange={(e) => setNewProductForm({...newProductForm, name: e.target.value})}
                  placeholder="e.g. Sony WH-1000XM5"
                  className="w-full rounded-lg border border-slate-200 px-4 py-2.5 focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none text-slate-900 placeholder-slate-400"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">Brand</label>
                <input
                  type="text"
                  value={newProductForm.brand}
                  onChange={(e) => setNewProductForm({...newProductForm, brand: e.target.value})}
                  placeholder="e.g. Sony"
                  className="w-full rounded-lg border border-slate-200 px-4 py-2.5 focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none text-slate-900 placeholder-slate-400"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">Cost Price (IDR) *</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-semibold text-sm">Rp</span>
                  <input
                    type="number"
                    required
                    min="0"
                    value={newProductForm.costPrice}
                    onChange={(e) => setNewProductForm({...newProductForm, costPrice: e.target.value})}
                    placeholder="0"
                    className="w-full rounded-lg border border-slate-200 pl-10 pr-4 py-2.5 focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none text-slate-900 placeholder-slate-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">SRP Price (IDR)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-semibold text-sm">Rp</span>
                  <input
                    type="number"
                    min="0"
                    value={newProductForm.srpPrice}
                    onChange={(e) => setNewProductForm({...newProductForm, srpPrice: e.target.value})}
                    placeholder="0"
                    className="w-full rounded-lg border border-slate-200 pl-10 pr-4 py-2.5 focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none text-slate-900 placeholder-slate-400"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2.5 text-slate-700 font-medium hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-brand-600 text-white font-medium rounded-lg hover:bg-brand-700 shadow-sm transition-colors"
                >
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="bg-red-50 p-6 border-b border-red-100 flex items-center justify-center">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center text-3xl">
                <i className="fa-solid fa-triangle-exclamation"></i>
              </div>
            </div>
            
            <div className="p-6 text-center">
              <h3 className="text-xl font-bold text-slate-900 mb-2">Delete Product?</h3>
              <p className="text-slate-600 text-sm mb-6">
                Are you sure you want to delete <span className="font-semibold text-slate-900">{productToDelete?.name}</span>? This action cannot be undone.
              </p>
              
              <div className="flex gap-3 justify-center">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmId(null)}
                  className="px-5 py-2.5 text-slate-700 font-medium hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  className="px-5 py-2.5 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 shadow-sm transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete All Confirmation Modal */}
      {showDeleteAllConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="bg-red-50 p-6 border-b border-red-100 flex items-center justify-center">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center text-3xl">
                <i className="fa-solid fa-triangle-exclamation"></i>
              </div>
            </div>

            <div className="p-6 text-center">
              <h3 className="text-xl font-bold text-slate-900 mb-2">Delete All Products?</h3>
              <p className="text-slate-600 text-sm mb-6">
                This will permanently remove <span className="font-semibold text-slate-900">{products.length} products</span> from your database. This action cannot be undone.
              </p>

              <div className="flex gap-3 justify-center">
                <button
                  type="button"
                  onClick={() => setShowDeleteAllConfirm(false)}
                  className="px-5 py-2.5 text-slate-700 font-medium hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onDeleteAllProducts();
                    setShowDeleteAllConfirm(false);
                  }}
                  className="px-5 py-2.5 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 shadow-sm transition-colors"
                >
                  Delete All
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
