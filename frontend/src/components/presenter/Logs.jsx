import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export default function Logs({
  isOpen = false,
  onClose = () => {},
  log = null,
}) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!isOpen || !log || typeof document === 'undefined') return null;

  const columns = log.columns || [];
  const rows = log.rows || [];
  const fieldValues = log.fieldValues || [];

  const sanitize = (s) =>
    (s || 'log').replace(/[^a-zA-Z0-9]/g, '_');

  const handleDownload = async (format) => {
    setError('');
    setBusy(true);
    try {
      const res = await fetch(`/logs/render?format=${format}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ columns, rows }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Server returned ${res.status}${text ? ': ' + text : ''}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${sanitize(log.label)}.${format}`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message || 'Download failed');
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-gray-100 max-w-5xl w-full p-8 relative animate-in fade-in zoom-in-95 duration-150 overflow-hidden text-left"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header */}
        <div className="flex items-start justify-between pb-6 border-b border-gray-100">
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">Logs</h2>
            <div className="text-xs text-gray-400 mb-0.5">
              {log.label || 'Log'}
            </div>
            <div className="flex items-center space-x-2 text-sm">
              {fieldValues.map((v, i) => (
                <span
                  key={i}
                  className={i === 0 ? 'font-bold text-gray-900' : 'text-gray-600'}
                >
                  {v}
                </span>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-gray-700">Download Logs as</span>
              <button
                type="button"
                onClick={() => handleDownload('csv')}
                disabled={busy}
                className="border-2 border-blue-600 text-blue-600 hover:bg-blue-50 rounded-full px-5 py-1.5 text-sm font-medium transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                CSV
              </button>
              <button
                type="button"
                onClick={() => handleDownload('pdf')}
                disabled={busy}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-5 py-1.5 text-sm font-medium transition shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                PDF
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-700 p-1 rounded-lg transition-colors"
              aria-label="Close modal"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Table Content */}
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-center border-collapse">
            <thead>
              <tr className="border-b border-gray-200">
                {columns.map((col, i) => (
                  <th key={i} className="py-3 px-4 font-semibold text-gray-700 text-sm">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row, ri) => (
                <tr key={ri} className="hover:bg-gray-50/80 transition-colors">
                  {row.map((cell, ci) => (
                    <td key={ci} className="py-3.5 px-4 text-sm text-gray-700">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>,
    document.body
  );
}