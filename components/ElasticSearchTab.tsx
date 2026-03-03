import React, { useState } from 'react';
import axios from 'axios';

const ELASTICSEARCH_URL = import.meta.env.VITE_ELASTICSEARCH_URL;
const ELASTICSEARCH_API_KEY = import.meta.env.VITE_ELASTICSEARCH_API_KEY;
const ELASTICSEARCH_INDEX = import.meta.env.VITE_ELASTICSEARCH_INDEX;

export const ElasticSearchTab: React.FC = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResults([]);
    try {
      let searchBody;
      if (!query.trim()) {
        setResults([]);
        setLoading(false);
        return;
      } else {
        searchBody = {
          query: {
            multi_match: {
              query,
              fields: ['name', 'brand'],
              type: 'best_fields',
              operator: 'and',
              fuzziness: 'AUTO',
            }
          },
          size: 50
        };
        // Use Vercel API route for search
        const esRes = await axios.post(
          '/api/search',
          searchBody
        );
        setResults(esRes.data.hits.hits.map((hit: any) => hit._source));
      }
    } catch (err: any) {
      setError('Search failed.');
    } finally {
      setLoading(false);
    }
  };

  const formatRupiah = (value: any) => {
    if (value === undefined || value === null || value === '' || isNaN(Number(value))) return '-';
    return 'Rp ' + Number(value).toLocaleString('id-ID');
  };

  return (
    <div className="w-full">
      <div className="bg-blue-50 border border-blue-200 rounded-xl shadow-sm p-4 sm:p-6 mb-4">
        <h2 className="text-lg sm:text-xl font-bold mb-2 sm:mb-4 text-blue-700">Cari Produk</h2>
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2 mb-4">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search product name or brand..."
            className="border px-3 py-2 rounded w-full sm:w-auto flex-1"
          />
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded font-semibold shadow-sm" disabled={loading}>
            {loading ? 'Searching...' : 'Search'}
          </button>
        </form>
        {error && <div className="text-red-600 mb-2">{error}</div>}
        <div className="overflow-x-auto">
          <table className="min-w-[600px] w-full text-xs sm:text-sm border border-slate-200 rounded-lg">
            <thead className="bg-blue-100">
              <tr>
                <th className="border px-2 py-1">Product Name</th>
                <th className="border px-2 py-1">Brand</th>
                <th className="border px-2 py-1">Harga Modal</th>
                <th className="border px-2 py-1">SRP</th>
                <th className="border px-2 py-1">Profit</th>
                <th className="border px-2 py-1">Percentage</th>
              </tr>
            </thead>
            <tbody>
              {results.map((item, idx) => (
                <tr key={idx} className="hover:bg-blue-50">
                  <td className="border px-2 py-1 font-medium text-slate-900">{item.name}</td>
                  <td className="border px-2 py-1 text-blue-700">{item.brand}</td>
                  <td className="border px-2 py-1 text-green-700">{formatRupiah(item.hargaModal)}</td>
                  <td className="border px-2 py-1 text-indigo-700">{formatRupiah(item.srp)}</td>
                  <td className="border px-2 py-1 text-orange-700 font-semibold">{formatRupiah(item.profit)}</td>
                  <td className={"border px-2 py-1 font-semibold " + ((item.hargaModal && item.profit && !isNaN(Number(item.hargaModal)) && !isNaN(Number(item.profit))) ? (Number(item.profit) >= 0 ? 'text-green-600' : 'text-red-600') : 'text-gray-400')}>
                    {(() => {
                      if (item.hargaModal && item.profit && !isNaN(Number(item.hargaModal)) && !isNaN(Number(item.profit))) {
                        const pct = Number(item.hargaModal) !== 0 ? (Number(item.profit) / Number(item.hargaModal)) * 100 : 0;
                        return pct.toFixed(1) + '%';
                      }
                      return '-';
                    })()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {results.length === 0 && !loading && <div className="text-gray-500 mt-4">No results.</div>}
        {/* Mobile-friendly tips */}
        <div className="sm:hidden text-xs text-blue-500 mt-2">Swipe table left/right to see all columns.</div>
      </div>
    </div>
  );
};
