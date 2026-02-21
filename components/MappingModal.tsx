import React, { useState, useEffect, useMemo } from 'react';
import { RawExtractionItem, ColumnMapping } from '../types';

interface MappingModalProps {
  data: RawExtractionItem[];
  onConfirm: (mapping: ColumnMapping) => void;
  onCancel: () => void;
}

export const MappingModal: React.FC<MappingModalProps> = ({ data, onConfirm, onCancel }) => {
  const [keys, setKeys] = useState<string[]>([]);
  const [showOnlyUnresolved, setShowOnlyUnresolved] = useState(true);
  const [quickFallbackColumn, setQuickFallbackColumn] = useState('');
  const [quickFallbackTarget, setQuickFallbackTarget] = useState<'name' | 'cost'>('name');
  const [mapping, setMapping] = useState<ColumnMapping>({
    nameField: '',
    costField: '',
    brandName: '',
    nameFallbackFields: [],
    costFallbackFields: [],
    manualRetagByRow: {},
  });

  useEffect(() => {
    if (data.length > 0) {
      const allKeys = Array.from(new Set(data.flatMap(item => Object.keys(item))));
      setKeys(allKeys);
      
      // Auto-guess columns based on common names
      const guessMapping: any = {};
      
      const nameKey = allKeys.find(k => /desc|name|product|item|model/i.test(k));
      if (nameKey) guessMapping.nameField = nameKey;

      const costKey = allKeys.find(k => /price|cost|dealer|net|wholesale/i.test(k));
      if (costKey) guessMapping.costField = costKey;
      
      const srpKey = allKeys.find(k => /srp|retail|sell|suggested.*price|base.*price/i.test(k));
      if (srpKey) guessMapping.srpField = srpKey;
      
      setMapping(prev => ({ ...prev, ...guessMapping }));
    }
  }, [data]);

  const normalizeText = (val: unknown): string => {
    if (val === undefined || val === null) return '';
    const text = String(val).trim();
    if (!text) return '';
    if (/^(undefined|null|n\/a|na|-)$/i.test(text)) return '';
    return text;
  };

  const parsePrice = (val: unknown): number => {
    if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
    const str = normalizeText(val);
    if (!str) return 0;
    const digits = str.replace(/[^0-9]/g, '');
    return parseInt(digits, 10) || 0;
  };

  const resolveName = (row: RawExtractionItem, rowIndex: number): string => {
    const manualName = normalizeText(mapping.manualRetagByRow?.[rowIndex]?.name);
    if (manualName) return manualName;

    const candidates = [
      mapping.nameField,
      ...(mapping.nameFallbackFields || []),
    ].filter(Boolean);

    for (const key of candidates) {
      const value = normalizeText(row[key]);
      if (value) return value;
    }
    return '';
  };

  const resolveCost = (row: RawExtractionItem, rowIndex: number): number => {
    const manualCost = mapping.manualRetagByRow?.[rowIndex]?.costPrice || 0;
    if (manualCost > 0) return manualCost;

    const candidates = [
      mapping.costField,
      ...(mapping.costFallbackFields || []),
    ].filter(Boolean);

    for (const key of candidates) {
      const value = parsePrice(row[key]);
      if (value > 0) return value;
    }
    return 0;
  };

  const resolveSrp = (row: RawExtractionItem, rowIndex: number): number => {
    const manualSrp = mapping.manualRetagByRow?.[rowIndex]?.srpPrice || 0;
    if (manualSrp > 0) return manualSrp;

    if (!mapping.srpField) return 0;

    const candidates = [
      mapping.srpField,
      ...(mapping.srpFallbackFields || []),
    ].filter(Boolean);

    for (const key of candidates) {
      const value = parsePrice(row[key]);
      if (value > 0) return value;
    }
    return 0;
  };

  const nameCandidateColumns = [mapping.nameField, ...(mapping.nameFallbackFields || [])].filter(Boolean);
  const costCandidateColumns = [mapping.costField, ...(mapping.costFallbackFields || [])].filter(Boolean);

  const getPopulatedColumns = (row: RawExtractionItem): string[] => {
    return Object.keys(row).filter((key) => normalizeText(row[key]));
  };

  const getUnresolvedReason = (name: string, cost: number): string => {
    if (!name && cost <= 0) return 'Missing Product Name and Cost Price';
    if (!name) return 'Missing Product Name';
    return 'Missing Cost Price';
  };

  const importAnalysis = useMemo(() => {
    let ready = 0;
    const unresolved: Array<{
      index: number;
      row: RawExtractionItem;
      currentName: string;
      currentCost: number;
      reason: string;
      hasName: boolean;
      hasCost: boolean;
      populatedColumns: string[];
    }> = [];
    const rows: Array<{
      index: number;
      row: RawExtractionItem;
      currentName: string;
      currentCost: number;
      isResolved: boolean;
      reason: string;
      hasName: boolean;
      hasCost: boolean;
      populatedColumns: string[];
    }> = [];

    data.forEach((row, index) => {
      const currentName = resolveName(row, index);
      const currentCost = resolveCost(row, index);
      const hasName = Boolean(currentName);
      const hasCost = currentCost > 0;
      const isResolved = Boolean(hasName && hasCost);
      const reason = getUnresolvedReason(currentName, currentCost);
      const populatedColumns = getPopulatedColumns(row);

      rows.push({ index, row, currentName, currentCost, isResolved, reason, hasName, hasCost, populatedColumns });

      if (isResolved) {
        ready += 1;
      } else {
        unresolved.push({ index, row, currentName, currentCost, reason, hasName, hasCost, populatedColumns });
      }
    });

    return {
      total: data.length,
      ready,
      unresolved,
      rows,
    };
  }, [data, mapping]);

  const rowsForRetag = useMemo(() => {
    if (showOnlyUnresolved) return importAnalysis.unresolved;
    return importAnalysis.rows.map(({ index, row, currentName, currentCost, reason, hasName, hasCost, populatedColumns }) => ({
      index,
      row,
      currentName,
      currentCost,
      reason,
      hasName,
      hasCost,
      populatedColumns,
    }));
  }, [showOnlyUnresolved, importAnalysis]);

  const toggleFallbackField = (type: 'name' | 'cost' | 'srp', field: string, checked: boolean) => {
    if (type === 'name') {
      setMapping(prev => {
        const current = prev.nameFallbackFields || [];
        const next = checked ? [...current, field] : current.filter(k => k !== field);
        return { ...prev, nameFallbackFields: Array.from(new Set(next)) };
      });
      return;
    }

    if (type === 'cost') {
      setMapping(prev => {
        const current = prev.costFallbackFields || [];
        const next = checked ? [...current, field] : current.filter(k => k !== field);
        return { ...prev, costFallbackFields: Array.from(new Set(next)) };
      });
      return;
    }

    if (type === 'srp') {
      setMapping(prev => {
        const current = prev.srpFallbackFields || [];
        const next = checked ? [...current, field] : current.filter(k => k !== field);
        return { ...prev, srpFallbackFields: Array.from(new Set(next)) };
      });
    }
  };

  const updateManualRetag = (rowIndex: number, partial: { name?: string; costPrice?: number; srpPrice?: number }) => {
    setMapping(prev => {
      const current = prev.manualRetagByRow?.[rowIndex] || {};
      const merged = { ...current, ...partial };
      return {
        ...prev,
        manualRetagByRow: {
          ...(prev.manualRetagByRow || {}),
          [rowIndex]: merged,
        },
      };
    });
  };

  const getQuickFallbackEligibleCount = (column: string, target: 'name' | 'cost'): number => {
    if (!column) return 0;

    return importAnalysis.unresolved.reduce((count, unresolvedRow) => {
      const value = unresolvedRow.row[column];
      if (target === 'name') {
        return count + (normalizeText(value) ? 1 : 0);
      }
      return count + (parsePrice(value) > 0 ? 1 : 0);
    }, 0);
  };

  const applyQuickFallback = () => {
    if (!quickFallbackColumn) {
      alert('Please select a column first.');
      return;
    }

    const eligibleCount = getQuickFallbackEligibleCount(quickFallbackColumn, quickFallbackTarget);
    if (eligibleCount === 0) {
      alert('Selected column has no usable data for unresolved rows.');
      return;
    }

    if (quickFallbackTarget === 'name') {
      toggleFallbackField('name', quickFallbackColumn, true);
      return;
    }

    toggleFallbackField('cost', quickFallbackColumn, true);
  };

  const handleSubmit = () => {
    if (!mapping.nameField || !mapping.costField) {
      alert("Please map the Product Name and Cost Price columns.");
      return;
    }
    if (!mapping.brandName.trim()) {
      alert("Please enter a Brand Name for this price list.");
      return;
    }
    onConfirm({
      ...mapping,
      nameFallbackFields: mapping.nameFallbackFields || [],
      costFallbackFields: mapping.costFallbackFields || [],
      manualRetagByRow: mapping.manualRetagByRow || {},
    });
  };

  const SamplePreview = () => {
    const sample = data.slice(0, 3);
    return (
      <div className="mt-6 bg-gray-50 rounded-lg p-4 border border-gray-200 overflow-x-auto">
        <h4 className="text-xs font-bold text-gray-500 uppercase mb-3">Preview of extracted data</h4>
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-gray-500 border-b border-gray-200">
            <tr>
              {keys.map(k => <th key={k} className="pb-2 px-2 font-medium">{k}</th>)}
            </tr>
          </thead>
          <tbody className="text-gray-700">
            {sample.map((row, idx) => (
              <tr key={idx} className="border-b border-gray-100 last:border-0">
                {keys.map(k => {
                  const cellValue = row[k];
                  const rendered =
                    cellValue === undefined || cellValue === null || String(cellValue).trim() === ''
                      ? '—'
                      : String(cellValue);
                  return <td key={k} className="py-2 px-2 whitespace-nowrap">{rendered}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-xl font-bold text-gray-800">Map Database Columns</h3>
          <p className="text-sm text-gray-500 mt-1">Tell us which extracted columns match your product fields and define the brand.</p>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Name Mapping */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Product Name <span className="text-red-500">*</span>
              </label>
              <select 
                value={mapping.nameField}
                onChange={(e) => setMapping({...mapping, nameField: e.target.value})}
                className="w-full rounded-lg border-gray-300 border px-4 py-2 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
              >
                <option value="">-- Select Column --</option>
                {keys.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
              <p className="text-xs text-gray-500 mt-1">Which column contains the item name?</p>
            </div>

            {/* Cost Mapping */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cost Price <span className="text-red-500">*</span>
              </label>
              <select 
                value={mapping.costField}
                onChange={(e) => setMapping({...mapping, costField: e.target.value})}
                className="w-full rounded-lg border-gray-300 border px-4 py-2 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
              >
                <option value="">-- Select Column --</option>
                {keys.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
              <p className="text-xs text-gray-500 mt-1">Which column is your buying price?</p>
            </div>

            {/* SRP Price Mapping */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                SRP Price (Suggested Retail Price)
              </label>
              <select 
                value={mapping.srpField || ''}
                onChange={(e) => setMapping({...mapping, srpField: e.target.value || undefined})}
                className="w-full rounded-lg border-gray-300 border px-4 py-2 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
              >
                <option value="">-- Optional: Select Column --</option>
                {keys.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
              <p className="text-xs text-gray-500 mt-1">Which column is your selling/retail price? (optional)</p>
            </div>

            {/* Name Fallback Mapping */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Product Name Fallback Columns
              </label>
              <div className="max-h-36 overflow-y-auto rounded-lg border border-gray-200 p-3 space-y-2">
                {keys.filter(k => k !== mapping.nameField).length === 0 ? (
                  <p className="text-xs text-gray-500">No additional columns available.</p>
                ) : (
                  keys.filter(k => k !== mapping.nameField).map(k => (
                    <label key={k} className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={(mapping.nameFallbackFields || []).includes(k)}
                        onChange={(e) => toggleFallbackField('name', k, e.target.checked)}
                        className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                      />
                      <span>{k}</span>
                    </label>
                  ))
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">Used when the main Product Name field is empty on some PDF pages.</p>
            </div>

            {/* Cost Fallback Mapping */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cost Price Fallback Columns
              </label>
              <div className="max-h-36 overflow-y-auto rounded-lg border border-gray-200 p-3 space-y-2">
                {keys.filter(k => k !== mapping.costField).length === 0 ? (
                  <p className="text-xs text-gray-500">No additional columns available.</p>
                ) : (
                  keys.filter(k => k !== mapping.costField).map(k => (
                    <label key={k} className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={(mapping.costFallbackFields || []).includes(k)}
                        onChange={(e) => toggleFallbackField('cost', k, e.target.checked)}
                        className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                      />
                      <span>{k}</span>
                    </label>
                  ))
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">Used when the main Cost field is empty or unreadable on some pages.</p>
            </div>

            {/* SRP Fallback Mapping */}
            {mapping.srpField && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  SRP Price Fallback Columns
                </label>
                <div className="max-h-36 overflow-y-auto rounded-lg border border-gray-200 p-3 space-y-2">
                  {keys.filter(k => k !== mapping.srpField).length === 0 ? (
                    <p className="text-xs text-gray-500">No additional columns available.</p>
                  ) : (
                    keys.filter(k => k !== mapping.srpField).map(k => (
                      <label key={k} className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={(mapping.srpFallbackFields || []).includes(k)}
                          onChange={(e) => toggleFallbackField('srp', k, e.target.checked)}
                          className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                        />
                        <span>{k}</span>
                      </label>
                    ))
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">Used when the main SRP field is empty or unreadable on some pages.</p>
              </div>
            )}

            {/* Brand Input */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Brand Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <i className="fa-solid fa-tag absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"></i>
                <input 
                  type="text" 
                  value={mapping.brandName}
                  onChange={(e) => setMapping({...mapping, brandName: e.target.value})}
                  placeholder="e.g. Sony, Nikon, Canon"
                  className="w-full rounded-lg border-gray-300 border pl-10 pr-4 py-2 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Enter the brand for this price list (e.g. "Sony"). This will apply to all imported items.</p>
            </div>

            <div className="md:col-span-2 bg-brand-50 border border-brand-200 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-gray-800">Import Readiness</h4>
              <p className="text-sm text-gray-600 mt-1">
                Ready to import: <span className="font-semibold text-green-700">{importAnalysis.ready}</span> / {importAnalysis.total}
              </p>
              <p className="text-sm text-gray-600">
                Need retag: <span className="font-semibold text-red-700">{importAnalysis.unresolved.length}</span>
              </p>
              <p className="text-xs text-gray-500 mt-2">
                Why rows fail: low OCR quality, changed headers across pages, or missing values in mapped columns.
              </p>
            </div>

          </div>

          <SamplePreview />

          {importAnalysis.unresolved.length > 0 && (
            <div className="mt-6 bg-amber-50 rounded-lg p-4 border border-amber-200 overflow-x-auto">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                <h4 className="text-xs font-bold text-amber-700 uppercase">Manual Retag (Before Save)</h4>
                <label className="inline-flex items-center gap-2 text-sm text-amber-800">
                  <input
                    type="checkbox"
                    checked={showOnlyUnresolved}
                    onChange={(e) => setShowOnlyUnresolved(e.target.checked)}
                    className="rounded border-amber-300 text-brand-600 focus:ring-brand-500"
                  />
                  Show only unresolved rows
                </label>
              </div>

              <div className="mb-4 bg-white/70 border border-amber-200 rounded-lg p-3 flex flex-col lg:flex-row lg:items-end gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-amber-800 mb-1">Quick Apply Fallback Column</label>
                  <select
                    value={quickFallbackColumn}
                    onChange={(e) => setQuickFallbackColumn(e.target.value)}
                    className="w-full rounded-lg border-amber-300 border px-3 py-2 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none bg-white"
                  >
                    <option value="">-- Select Column --</option>
                    {keys.map((k) => (
                      <option key={`quick-${k}`} value={k}>{k}</option>
                    ))}
                  </select>
                </div>

                <div className="w-full lg:w-48">
                  <label className="block text-xs font-semibold text-amber-800 mb-1">Apply As</label>
                  <select
                    value={quickFallbackTarget}
                    onChange={(e) => setQuickFallbackTarget(e.target.value as 'name' | 'cost')}
                    className="w-full rounded-lg border-amber-300 border px-3 py-2 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none bg-white"
                  >
                    <option value="name">Name Fallback</option>
                    <option value="cost">Cost Fallback</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={applyQuickFallback}
                  className="px-4 py-2 bg-brand-600 text-white rounded-lg font-medium hover:bg-brand-700 transition-colors whitespace-nowrap"
                >
                  Apply to Unresolved
                </button>
              </div>

              {quickFallbackColumn && (
                <p className="text-xs text-amber-700 mb-3">
                  Usable unresolved rows for this selection: <span className="font-semibold">{getQuickFallbackEligibleCount(quickFallbackColumn, quickFallbackTarget)}</span>
                </p>
              )}

              <table className="w-full text-sm text-left min-w-[1050px]">
                <thead className="text-xs text-amber-700 border-b border-amber-200">
                  <tr>
                    <th className="pb-2 px-2 font-medium">Row</th>
                    <th className="pb-2 px-2 font-medium">Why Unresolved</th>
                    <th className="pb-2 px-2 font-medium">Mapped Columns Checked</th>
                    <th className="pb-2 px-2 font-medium">Available Source Columns</th>
                    <th className="pb-2 px-2 font-medium">Detected Name</th>
                    <th className="pb-2 px-2 font-medium">Detected Cost</th>
                    <th className="pb-2 px-2 font-medium">Detected SRP</th>
                    <th className="pb-2 px-2 font-medium">Manual Product Name</th>
                    <th className="pb-2 px-2 font-medium">Manual Cost (IDR)</th>
                    <th className="pb-2 px-2 font-medium">Manual SRP (IDR)</th>
                  </tr>
                </thead>
                <tbody className="text-gray-700">
                  {rowsForRetag.map(({ index, currentName, currentCost, reason, hasName, hasCost, populatedColumns, row }) => {
                    const currentSrp = resolveSrp(row, index);
                    return (
                      <tr key={index} className="border-b border-amber-100 last:border-0">
                        <td className="py-2 px-2">{index + 1}</td>
                        <td className="py-2 px-2 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${hasName && hasCost ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {hasName && hasCost ? 'Resolved' : reason}
                          </span>
                        </td>
                        <td className="py-2 px-2">
                          <div className="flex flex-wrap gap-1">
                            {nameCandidateColumns.length === 0 && costCandidateColumns.length === 0 ? (
                              <span className="text-xs text-gray-500">No mapped columns selected</span>
                            ) : (
                              <>
                                {nameCandidateColumns.map((col) => (
                                  <span key={`name-${index}-${col}`} className="inline-flex items-center px-2 py-0.5 rounded bg-blue-100 text-blue-700 text-xs">
                                    Name: {col}
                                  </span>
                                ))}
                                {costCandidateColumns.map((col) => (
                                  <span key={`cost-${index}-${col}`} className="inline-flex items-center px-2 py-0.5 rounded bg-purple-100 text-purple-700 text-xs">
                                    Cost: {col}
                                  </span>
                                ))}
                              </>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-2">
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {populatedColumns.length === 0 ? (
                              <span className="text-xs text-gray-500">No readable values in this row</span>
                            ) : (
                              populatedColumns.slice(0, 8).map((col) => (
                                <span key={`available-${index}-${col}`} className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-xs">
                                  {col}
                                </span>
                              ))
                            )}
                            {populatedColumns.length > 8 && (
                              <span className="text-xs text-gray-500">+{populatedColumns.length - 8} more</span>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-2">{currentName || '—'}</td>
                        <td className="py-2 px-2">{currentCost > 0 ? currentCost.toLocaleString('id-ID') : '—'}</td>
                        <td className="py-2 px-2">{currentSrp > 0 ? currentSrp.toLocaleString('id-ID') : '—'}</td>
                        <td className="py-2 px-2">
                          <input
                            type="text"
                            value={mapping.manualRetagByRow?.[index]?.name || ''}
                            onChange={(e) => updateManualRetag(index, { name: e.target.value })}
                            placeholder="Type product name"
                            className="w-full rounded border border-amber-300 px-2 py-1 focus:ring-2 focus:ring-brand-500 outline-none"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="number"
                            min="0"
                            value={mapping.manualRetagByRow?.[index]?.costPrice || ''}
                            onChange={(e) => {
                              const value = parseInt(e.target.value || '0', 10) || 0;
                              updateManualRetag(index, { costPrice: value });
                            }}
                            placeholder="0"
                            className="w-full rounded border border-amber-300 px-2 py-1 focus:ring-2 focus:ring-brand-500 outline-none"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="number"
                            min="0"
                            value={mapping.manualRetagByRow?.[index]?.srpPrice || ''}
                            onChange={(e) => {
                              const value = parseInt(e.target.value || '0', 10) || 0;
                              updateManualRetag(index, { srpPrice: value });
                            }}
                            placeholder="0"
                            className="w-full rounded border border-amber-300 px-2 py-1 focus:ring-2 focus:ring-brand-500 outline-none"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-100 flex justify-end gap-3 bg-gray-50 rounded-b-xl">
          <button 
            onClick={onCancel}
            className="px-5 py-2 text-gray-600 font-medium hover:bg-gray-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleSubmit}
            className="px-6 py-2 bg-brand-600 text-white font-medium rounded-lg hover:bg-brand-700 shadow-md transition-colors"
          >
            Import Database
          </button>
        </div>
      </div>
    </div>
  );
};