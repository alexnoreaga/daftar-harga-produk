import React, { useState, useRef, useEffect } from 'react';
import * as pdfjsLibProxy from 'pdfjs-dist';
import { geminiService } from '../services/geminiService';
import { RawExtractionItem, UploadStatus } from '../types';

// Handle ES module default export inconsistency for PDF.js
const pdfjsLib: any = (pdfjsLibProxy as any).default || pdfjsLibProxy;

// Set worker source for PDF.js
// using CDNJS is more reliable for worker files due to correct CORS headers compared to direct ESM.sh build paths
if (pdfjsLib.GlobalWorkerOptions) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

interface UploadViewProps {
  onExtractionComplete: (data: RawExtractionItem[]) => void;
}

export const UploadView: React.FC<UploadViewProps> = ({ onExtractionComplete }) => {
  const [activeTab, setActiveTab] = useState<'file' | 'text'>('file');
  const [status, setStatus] = useState<UploadStatus>({ state: 'idle' });
  const [progress, setProgress] = useState<{current: number, total: number} | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  
  // Text import state
  const [rawText, setRawText] = useState('');
  const [brandHint, setBrandHint] = useState('');
  const isBusy = status.state === 'processing' || status.state === 'uploading';

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type === 'application/pdf') {
      setPreview(null); // No simple image preview for PDF
      processPdf(file);
    } else {
      // Image handling
      const reader = new FileReader();
      reader.onload = (ev) => {
        const result = ev.target?.result as string;
        setPreview(result);
        processSingleImage(file, result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Helper to convert a file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const processSingleImage = async (file: File, base64Full: string) => {
    setStatus({ state: 'processing', message: 'Analyzing image...' });
    const base64Data = base64Full.split(',')[1];

    try {
      const data = await geminiService.processImage(base64Data, file.type);
      if (!data || data.length === 0) throw new Error("No products found.");
      
      setStatus({ state: 'complete', message: 'Extraction successful!' });
      setTimeout(() => onExtractionComplete(data), 1000);
    } catch (error: any) {
      setStatus({ state: 'error', message: error.message });
    }
  };

  const processPdf = async (file: File) => {
    setStatus({ state: 'uploading', message: 'Loading PDF document...' });

    try {
      const arrayBuffer = await file.arrayBuffer();
      // Use the resolved pdfjsLib instance
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      const totalPages = pdf.numPages;
      
      let allData: RawExtractionItem[] = [];
      let failedPages = 0;
      let firstPageError: string | null = null;
      setProgress({ current: 0, total: totalPages });

      // Loop through all pages
      for (let i = 1; i <= totalPages; i++) {
        setStatus({ state: 'processing', message: `Processing page ${i} of ${totalPages}...` });
        setProgress({ current: i, total: totalPages });

        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2.0 }); // High scale for better OCR text recognition
        
        // Render to canvas
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        if (context) {
          await page.render({ canvasContext: context, viewport: viewport }).promise;
          
          // Convert canvas to image base64
          // Use JPEG with 0.8 quality to reduce payload size while keeping text clear
          const base64Full = canvas.toDataURL('image/jpeg', 0.8);
          const base64Data = base64Full.split(',')[1];

          // Process with Gemini (image-first strategy)
          try {
            const pageData = await geminiService.processImage(base64Data, 'image/jpeg');
            if (pageData && pageData.length > 0) {
              allData = [...allData, ...pageData];
            } else {
              const textContent = await page.getTextContent();
              const rawText = textContent.items
                .map((item: any) => item?.str || '')
                .join(' ')
                .replace(/\s+/g, ' ')
                .trim();

              if (rawText.length > 20) {
                const fallbackData = await geminiService.processText(rawText);
                if (fallbackData && fallbackData.length > 0) {
                  allData = [...allData, ...fallbackData];
                }
              }
            }
          } catch (pageError) {
            failedPages += 1;
            if (!firstPageError) {
              firstPageError = pageError instanceof Error ? pageError.message : String(pageError);
            }
            console.warn(`Failed to process page ${i}`, pageError);
            // Continue to next page even if one fails
          }
        }
      }

      if (allData.length === 0) {
        if (failedPages === totalPages && firstPageError) {
          throw new Error(firstPageError);
        }
        throw new Error("Could not extract any data from the PDF.");
      }

      // Harmonize column names across all pages before passing to mapping modal
      const harmonizedData = geminiService.harmonizeColumnNames(allData);

      setStatus({ state: 'complete', message: `Extracted ${harmonizedData.length} items successfully!` });
      setTimeout(() => onExtractionComplete(harmonizedData), 1000);

    } catch (error: any) {
      console.error(error);
      setStatus({ state: 'error', message: "Failed to process PDF: " + (error.message || "Unknown error") });
    } finally {
        setProgress(null);
    }
  };

  const processTextList = async () => {
    if (!rawText.trim()) {
      setStatus({ state: 'error', message: 'Please enter some text to parse.' });
      return;
    }

    setStatus({ state: 'processing', message: 'AI analyzing text list...' });

    try {
      const data = await geminiService.processMessyTextList(rawText, brandHint || undefined);
      if (!data || data.length === 0) {
        throw new Error("No products found in the text.");
      }
      
      setStatus({ state: 'complete', message: `Extracted ${data.length} items successfully!` });
      setTimeout(() => onExtractionComplete(data), 1000);
    } catch (error: any) {
      console.error(error);
      setStatus({ state: 'error', message: error.message || "Failed to parse text list." });
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
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
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-800">Import Price List</h2>
        <p className="text-gray-500 mt-2">Upload files or paste text directly for AI-powered extraction.</p>
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        <button
          onClick={() => {
            setActiveTab('file');
            setStatus({ state: 'idle' });
            setPreview(null);
          }}
          className={`px-6 py-3 font-medium transition-colors relative ${
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
            setPreview(null);
          }}
          className={`px-6 py-3 font-medium transition-colors relative ${
            activeTab === 'text'
              ? 'text-brand-600 border-b-2 border-brand-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <i className="fa-solid fa-align-left mr-2"></i>
          Text Import
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        
        {activeTab === 'file' ? (
          // FILE UPLOAD TAB
          <>
            <div 
              className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                status.state === 'error' ? 'border-red-300 bg-red-50' : 
                status.state === 'idle' ? 'border-gray-300 hover:border-brand-500 hover:bg-brand-50' :
                'border-brand-500 bg-brand-50'
              }`}
            >
              {status.state === 'idle' || status.state === 'error' ? (
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 bg-brand-100 text-brand-600 rounded-full flex items-center justify-center mb-4 text-2xl">
                    <i className="fa-solid fa-cloud-arrow-up"></i>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900">Click to upload or drag and drop</h3>
                  <p className="text-sm text-gray-500 mt-2 mb-6">PDF (Unlimited Pages), JPG, PNG</p>
                  
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/jpeg,image/png,application/pdf"
                    className="hidden"
                  />
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-brand-600 hover:bg-brand-700 text-white px-6 py-2.5 rounded-lg font-medium transition-colors"
                  >
                    Select File
                  </button>
                  {status.state === 'error' && (
                    <p className="mt-4 text-red-600 bg-red-100 px-4 py-2 rounded text-sm">
                      <i className="fa-solid fa-circle-exclamation mr-2"></i>
                      {status.message}
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center py-8">
                  {status.state === 'complete' ? (
                    <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4 text-2xl animate-bounce">
                      <i className="fa-solid fa-check"></i>
                    </div>
                  ) : (
                     <div className="w-16 h-16 relative flex items-center justify-center mb-4">
                        <div className="absolute inset-0 rounded-full border-4 border-gray-200"></div>
                        <div className="absolute inset-0 rounded-full border-4 border-brand-500 border-t-transparent animate-spin"></div>
                        <i className="fa-solid fa-robot text-brand-600 text-xl z-10"></i>
                     </div>
                  )}
                  
                  <h3 className="text-lg font-medium text-gray-900 mt-2">
                    {status.state === 'processing' ? 'AI Processing...' : status.state === 'complete' ? 'Success!' : 'Uploading...'}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
                    {status.message}
                  </p>
                  {status.state !== 'complete' && (
                    <div className="mt-3 flex items-center justify-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-brand-500 animate-bounce" style={{ animationDelay: '0ms' }}></span>
                      <span className="h-1.5 w-1.5 rounded-full bg-brand-500 animate-bounce" style={{ animationDelay: '150ms' }}></span>
                      <span className="h-1.5 w-1.5 rounded-full bg-brand-500 animate-bounce" style={{ animationDelay: '300ms' }}></span>
                    </div>
                  )}
                  
                  {/* Progress Bar for PDF */}
                  {progress && (
                      <div className="w-full max-w-xs mt-4">
                          <div className="flex justify-between text-xs text-gray-500 mb-1">
                              <span>Progress</span>
                              <span>{Math.round((progress.current / progress.total) * 100)}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2.5">
                              <div 
                                className="bg-brand-600 h-2.5 rounded-full transition-all duration-300" 
                                style={{ width: `${(progress.current / progress.total) * 100}%` }}
                              ></div>
                          </div>
                          <p className="text-xs text-center text-gray-400 mt-1">Page {progress.current} of {progress.total}</p>
                      </div>
                  )}
                </div>
              )}
            </div>

            {/* Preview Area (Only for images) */}
            {preview && status.state !== 'idle' && !preview.includes('application/pdf') && (
              <div className="mt-8 border-t pt-8">
                <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">File Preview</h4>
                <div className="bg-gray-100 rounded-lg p-4 overflow-hidden h-64 flex items-center justify-center border border-gray-200">
                   <img src={preview} alt="Preview" className="h-full object-contain rounded shadow-sm" />
                </div>
              </div>
            )}
          </>
        ) : (
          // TEXT IMPORT TAB
          <>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Brand Hint (Optional)
                </label>
                <input
                  type="text"
                  value={brandHint}
                  onChange={(e) => setBrandHint(e.target.value)}
                  placeholder="e.g., Sony, Canon, DJI..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  disabled={status.state === 'processing'}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Helps AI better identify and categorize products
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Paste Price List Text
                </label>
                <textarea
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder={'Example:\nA7c 28-60 Rp 24.845 srp 27.999\nILce 1m2 bo rp 91.199 srp 99.999\nZv e1 24-50 Rp 49.999 srp 54.999'}
                  rows={12}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent font-mono text-sm"
                  disabled={status.state === 'processing'}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Paste messy text from WhatsApp, emails, or documents. AI will beautify product names and extract prices.
                </p>
              </div>

              {status.state === 'error' && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                  <i className="fa-solid fa-circle-exclamation text-red-600 mt-0.5"></i>
                  <p className="text-red-700 text-sm flex-1">{status.message}</p>
                </div>
              )}

              {status.state === 'processing' ? (
                <div className="flex flex-col items-center py-8">
                  <div className="w-16 h-16 relative flex items-center justify-center mb-4">
                    <div className="absolute inset-0 rounded-full border-4 border-gray-200"></div>
                    <div className="absolute inset-0 rounded-full border-4 border-brand-500 border-t-transparent animate-spin"></div>
                    <i className="fa-solid fa-robot text-brand-600 text-xl z-10"></i>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900">AI Processing...</h3>
                  <p className="text-sm text-gray-500 mt-1">{status.message}</p>
                  <div className="mt-3 flex items-center justify-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-brand-500 animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="h-1.5 w-1.5 rounded-full bg-brand-500 animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="h-1.5 w-1.5 rounded-full bg-brand-500 animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </div>
                </div>
              ) : status.state === 'complete' ? (
                <div className="flex flex-col items-center py-8">
                  <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4 text-2xl animate-bounce">
                    <i className="fa-solid fa-check"></i>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900">Success!</h3>
                  <p className="text-sm text-gray-500 mt-1">{status.message}</p>
                </div>
              ) : (
                <button
                  onClick={processTextList}
                  disabled={!rawText.trim()}
                  className="w-full bg-brand-600 hover:bg-brand-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <i className="fa-solid fa-wand-magic-sparkles"></i>
                  Parse with AI
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};