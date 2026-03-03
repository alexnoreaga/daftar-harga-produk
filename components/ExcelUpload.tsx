


import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';

interface ExcelUploadProps {
  onExtractionComplete: (data: any[]) => void;
}

export const ExcelUpload: React.FC<ExcelUploadProps> = ({ onExtractionComplete }) => {
  const [status, setStatus] = useState<'idle' | 'processing' | 'complete' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [columns, setColumns] = useState<{product: string, cost: string, srp: string}>({product: '', cost: '', srp: ''});
  const [sheetColumns, setSheetColumns] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [excelRows, setExcelRows] = useState<any[][]>([]); // raw rows as arrays
  const [brandName, setBrandName] = useState('');
  const [productCount, setProductCount] = useState<number>(0);
  const [headerRowIdx, setHeaderRowIdx] = useState<number>(0);
  const [editColumns, setEditColumns] = useState<string[]>([]);

  // Stats
  const [missingProducts, setMissingProducts] = useState<number>(0);
  const [missingCosts, setMissingCosts] = useState<number>(0);
  const [duplicates, setDuplicates] = useState<number>(0);

  // Handle Excel upload
  const handleExcelChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus('processing');
    setMessage('Parsing Excel file...');
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
      setExcelRows(rows);
      setHeaderRowIdx(0);
      setSheetColumns(rows[0] ? rows[0].map((col: any) => String(col)) : []);
      setEditColumns(rows[0] ? rows[0].map((col: any) => String(col)) : []);
      setStatus('idle');
      setMessage('Excel file loaded. Click header row and map columns.');
      setProductCount(rows.length - 1);
      updateStats(rows, 0, columns);
    } catch (err: any) {
      setStatus('error');
      setMessage(err.message || 'Failed to process Excel file.');
      setProductCount(0);
    }
  };

  // Visual header row selection
  const handleHeaderRowClick = (idx: number) => {
    setHeaderRowIdx(idx);
    setSheetColumns(excelRows[idx] ? excelRows[idx].map((col: any) => String(col)) : []);
    setEditColumns(excelRows[idx] ? excelRows[idx].map((col: any) => String(col)) : []);
    setProductCount(excelRows.length - idx - 1);
    updateStats(excelRows, idx, columns);
  };

  // Editable column names
  const handleEditColumn = (i: number, value: string) => {
    const newCols = [...editColumns];
    newCols[i] = value;
    setEditColumns(newCols);
    setSheetColumns(newCols);
  };

  // Update stats
  const updateStats = (rows: any[][], headerIdx: number, columns: {product: string, cost: string, srp: string}) => {
    const header = rows[headerIdx] || [];
    const dataRows = rows.slice(headerIdx + 1);
    let missingProd = 0, missingCost = 0;
    const seen = new Set<string>();
    let dupes = 0;
    dataRows.forEach(row => {
      const obj: any = {};
      header.forEach((col: any, i: number) => {
        obj[col] = row[i] || '';
      });
      if (!obj[columns.product]) missingProd++;
      if (!obj[columns.cost]) missingCost++;
      const key = `${obj[columns.product]}|||${obj[columns.cost]}`;
      if (seen.has(key) && obj[columns.product] && obj[columns.cost]) dupes++;
      seen.add(key);
    });
    setMissingProducts(missingProd);
    setMissingCosts(missingCost);
    setDuplicates(dupes);
  };

  // Update stats when columns change
  React.useEffect(() => {
    if (excelRows.length > 0) updateStats(excelRows, headerRowIdx, columns);
  }, [columns, headerRowIdx, excelRows]);

  // Extraction
  const handleExtract = () => {
    setStatus('processing');
    setMessage('Extracting data...');
    if (!brandName.trim()) {
      setStatus('error');
      setMessage('Please enter a brand name.');
      return;
    }
    if (!columns.product || !columns.cost) {
      setStatus('error');
      setMessage('Please map Product Name and Cost Price columns.');
      return;
    }
    const header = sheetColumns;
    const dataRows = excelRows.slice(headerRowIdx + 1);
    const result = dataRows.map(row => {
      const obj: any = {};
      header.forEach((col, i) => {
        obj[col] = row[i] || '';
      });
      return {
        product: obj[columns.product] || '',
        cost: obj[columns.cost] || '',
        srp: obj[columns.srp] || '',
        brand: brandName.trim()
      };
    }).filter(row => row.product && row.cost);
    setStatus('complete');
    setMessage(`Extraction complete! ${result.length} products ready to import.`);
    onExtractionComplete(result);
  };

  return (
    <div className="border-2 border-blue-300 rounded-lg p-8 text-center">
      <input
        type="file"
        accept=".xlsx,.xls"
        ref={fileInputRef}
        onChange={handleExcelChange}
        className="hidden"
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium mb-4"
        disabled={status === 'processing'}
      >
        Upload Excel File
      </button>
      {excelRows.length > 0 && (
        <div className="mb-4">
          <h3 className="text-lg font-bold mb-2">Select Header Row (click a row)</h3>
          <div className="overflow-x-auto max-h-48 border rounded mb-2">
            <table className="w-full text-xs border">
              <tbody>
                {excelRows.slice(0, 10).map((row, idx) => (
                  <tr key={idx} className={headerRowIdx === idx ? 'bg-blue-100 font-bold cursor-pointer' : 'cursor-pointer'} onClick={() => handleHeaderRowClick(idx)}>
                    {row.map((cell, colIdx) => (
                      <td key={colIdx} className="border px-2 py-1">{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h3 className="text-lg font-bold mb-2">Edit Column Names</h3>
          <div className="flex flex-wrap gap-2 justify-center mb-2">
            {editColumns.map((col, i) => (
              <input
                key={i}
                value={col}
                onChange={e => handleEditColumn(i, e.target.value)}
                className="border rounded px-2 text-xs"
                style={{ minWidth: 80 }}
              />
            ))}
          </div>
          <h3 className="text-lg font-bold mb-2">Map Columns</h3>
          <div className="flex flex-col gap-2 items-center">
            <label>
              Product Name:
              <select value={columns.product} onChange={e => setColumns({...columns, product: e.target.value})} className="ml-2 border rounded px-2">
                <option value="">-- Select --</option>
                {sheetColumns.map(col => <option key={col} value={col}>{col}</option>)}
              </select>
            </label>
            <label>
              Cost Price:
              <select value={columns.cost} onChange={e => setColumns({...columns, cost: e.target.value})} className="ml-2 border rounded px-2">
                <option value="">-- Select --</option>
                {sheetColumns.map(col => <option key={col} value={col}>{col}</option>)}
              </select>
            </label>
            <label>
              SRP (optional):
              <select value={columns.srp} onChange={e => setColumns({...columns, srp: e.target.value})} className="ml-2 border rounded px-2">
                <option value="">-- Select --</option>
                {sheetColumns.map(col => <option key={col} value={col}>{col}</option>)}
              </select>
            </label>
            <label>
              Brand Name:
              <input
                type="text"
                value={brandName}
                onChange={e => setBrandName(e.target.value)}
                className="ml-2 border rounded px-2"
                placeholder="Enter brand name"
              />
            </label>
          </div>
          <div className="mt-2 text-sm text-gray-700">
            <span>Detected <b>{productCount}</b> products. </span>
            <span className="ml-2 text-red-600">Missing Product: {missingProducts}</span>
            <span className="ml-2 text-red-600">Missing Cost: {missingCosts}</span>
            <span className="ml-2 text-orange-600">Duplicates: {duplicates}</span>
          </div>
          <button
            onClick={handleExtract}
            className="mt-4 bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium"
            disabled={status === 'processing' || !columns.product || !columns.cost || !brandName.trim()}
          >
            Import Data
          </button>
        </div>
      )}
      {excelRows.length > 0 && (
        <div className="mt-6 text-left overflow-x-auto max-h-96 border rounded">
          <h4 className="font-semibold mb-2">Full Preview</h4>
          <table className="w-full text-xs border">
            <thead>
              <tr>
                {sheetColumns.map((col, idx) => (
                  <th key={idx} className="border px-2 py-1">{col}</th>
                ))}
                <th className="border px-2 py-1">Brand</th>
              </tr>
            </thead>
            <tbody>
              {excelRows.slice(headerRowIdx + 1).map((row, idx) => (
                <tr key={idx}>
                  {sheetColumns.map((col, colIdx) => {
                    const isMissing = (col === columns.product && !row[colIdx]) || (col === columns.cost && !row[colIdx]);
                    return (
                      <td key={colIdx} className={`border px-2 py-1 ${isMissing ? 'bg-red-100' : ''}`}>{row[colIdx]}</td>
                    );
                  })}
                  <td className="border px-2 py-1">{brandName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {status !== 'idle' && (
        <div className="mt-6 text-sm">
          {status === 'processing' && <span>Processing... {message}</span>}
          {status === 'complete' && <span className="text-green-600">{message}</span>}
          {status === 'error' && <span className="text-red-600">{message}</span>}
        </div>
      )}
    </div>
  );
};
