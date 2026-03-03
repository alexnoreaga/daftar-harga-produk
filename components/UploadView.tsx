import React, { useState, useRef } from 'react';
import { ExcelUpload } from './ExcelUpload';
import { ElasticSearchTab } from './ElasticSearchTab';
import { RawExtractionItem } from '../types';

interface UploadViewProps {
  onExtractionComplete: (data: RawExtractionItem[]) => void;
}

const UploadView: React.FC<UploadViewProps> = ({ onExtractionComplete }) => {
  const [activeTab, setActiveTab] = useState<'file' | 'text' | 'excel' | 'search'>('file');
  const [status, setStatus] = useState<{ state: 'idle' | 'processing' | 'complete' | 'error'; message?: string }>({ state: 'idle' });
  const [rawText, setRawText] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dummy handler for file upload (replace with actual logic)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // ...file handling logic
  };

  // Dummy handler for text parsing (replace with actual logic)
  const processTextList = () => {
    // ...text parsing logic
  };

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto">
      {isBusy && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center px-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 border border-slate-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center text-xl">
                <i className="fa-solid fa-wand-magic-sparkles"></i>
              </div>
              <div>
                <p className="text-sm text-slate-500">Importing price list</p>
                <p className="text-lg font-bold text-slate-900">Please wait</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <i className="fa-solid fa-robot animate-bounce text-brand-600"></i>
              <span>{status.message}</span>
            </div>
            {progress && (
              <div className="mt-4">
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>Progress</span>
                  <span>{Math.round((progress.current / progress.total) * 100)}%</span>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-brand-500 via-sky-400 to-brand-600 animate-pulse"
                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                  ></div>
                </div>
                <p className="mt-2 text-xs text-slate-500">Page {progress.current} of {progress.total}</p>
              </div>
            )}
            <div className="mt-4 flex items-center justify-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-500 animate-bounce" style={{ animationDelay: '0ms' }}></span>
              <span className="h-1.5 w-1.5 rounded-full bg-brand-500 animate-bounce" style={{ animationDelay: '150ms' }}></span>
              <span className="h-1.5 w-1.5 rounded-full bg-brand-500 animate-bounce" style={{ animationDelay: '300ms' }}></span>
            </div>
          </div>
        </div>
      )}
      <div className="mb-5 sm:mb-8">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-800">Import Price List</h2>
        <p className="text-sm sm:text-base text-gray-500 mt-1.5 sm:mt-2">Upload files or paste text directly for AI-powered extraction.</p>
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-1.5 sm:gap-2 mb-4 sm:mb-6 border-b border-gray-200">
        <button
          onClick={() => {
            setActiveTab('file');
            setStatus({ state: 'idle' });
          }}
          className={`px-4 sm:px-6 py-2.5 sm:py-3 text-sm sm:text-base font-medium transition-colors relative ${
            activeTab === 'file'
              ? 'text-brand-600 border-b-2 border-brand-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <i className="fa-solid fa-file mr-2"></i>
          File Upload
        </button>
        <button
          onClick={() => {
            setActiveTab('text');
            setStatus({ state: 'idle' });
          }}
          className={`px-4 sm:px-6 py-2.5 sm:py-3 text-sm sm:text-base font-medium transition-colors relative ${
            activeTab === 'text'
              ? 'text-brand-600 border-b-2 border-brand-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <i className="fa-solid fa-align-left mr-2"></i>
          Text Import
        </button>
        <button
          onClick={() => {
            setActiveTab('excel');
            setStatus({ state: 'idle' });
          }}
          className={`px-4 sm:px-6 py-2.5 sm:py-3 text-sm sm:text-base font-medium transition-colors relative ${
            activeTab === 'excel'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-blue-700'
          }`}
        >
          <i className="fa-solid fa-file-excel mr-2"></i>
          Excel Import
        </button>
        <button
          onClick={() => {
            setActiveTab('search');
          }}
          className={`px-4 sm:px-6 py-2.5 sm:py-3 text-sm sm:text-base font-medium transition-colors relative ${
            activeTab === 'search'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-blue-700'
          }`}
        >
          <i className="fa-solid fa-magnifying-glass mr-2"></i>
          Search
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-8">
        {activeTab === 'file' && (
          <div className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
            status.state === 'error' ? 'border-red-300 bg-red-50' : 
            status.state === 'idle' ? 'border-gray-300 hover:border-brand-500 hover:bg-brand-50' :
            'border-brand-500 bg-brand-50'
          }`}>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/jpeg,image/png,application/pdf"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="bg-brand-600 hover:bg-brand-700 text-white px-6 py-2.5 rounded-lg font-medium transition-colors mb-4"
            >
              Select File
            </button>
            {status.state === 'idle' && <p className="text-gray-500">No file selected.</p>}
            {status.state === 'error' && (
              <p className="mt-4 text-red-600 bg-red-100 px-4 py-2 rounded text-sm">
                <i className="fa-solid fa-circle-exclamation mr-2"></i>
                {status.message}
              </p>
            )}
            {status.state === 'processing' && <p className="text-brand-600">Processing...</p>}
            {status.state === 'complete' && <p className="text-green-600">Upload complete!</p>}
          </div>
        )}
        {activeTab === 'text' && (
          <div>
            <textarea
              value={rawText}
              onChange={e => setRawText(e.target.value)}
              placeholder={'Example:\nA7c 28-60 Rp 24.845 srp 27.999\nILce 1m2 bo rp 91.199 srp 99.999\nZv e1 24-50 Rp 49.999 srp 54.999'}
              rows={12}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent font-mono text-sm mb-4"
              disabled={status.state === 'processing'}
            />
            <button
              onClick={processTextList}
              disabled={!rawText.trim()}
              className="w-full bg-brand-600 hover:bg-brand-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-wand-magic-sparkles"></i>
              Parse with AI
            </button>
            {status.state === 'error' && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3 mt-4">
                <i className="fa-solid fa-circle-exclamation text-red-600 mt-0.5"></i>
                <p className="text-red-700 text-sm flex-1">{status.message}</p>
              </div>
            )}
            {status.state === 'processing' && <p className="text-brand-600 mt-4">Processing...</p>}
            {status.state === 'complete' && <p className="text-green-600 mt-4">Text import complete!</p>}
          </div>
        )}
        {activeTab === 'excel' && (
          <ExcelUpload onExtractionComplete={onExtractionComplete} />
        )}
        {activeTab === 'search' && (
          <ElasticSearchTab />
        )}
      </div>
    </div>
  );
};

export default UploadView;