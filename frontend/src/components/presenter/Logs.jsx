import React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const DEFAULT_LOG_ENTRIES = [
  {
    date: '10/11/2026',
    timestamp: '11:55 AM',
    status: 'Entered',
    firstName: 'John',
    lastName: 'Injug',
    section: 'BSIT 4C',
    subject: 'IT-ELEC 3',
    code: '124897',
  },
  {
    date: '10/11/2026',
    timestamp: '11:55 AM',
    status: 'Entered',
    firstName: 'Alexandre',
    lastName: 'Paquibot',
    section: 'BSIT 4C',
    subject: 'IT-ELEC 3',
    code: '124897',
  },
  {
    date: '10/11/2026',
    timestamp: '11:55 AM',
    status: 'Entered',
    firstName: 'Erika',
    lastName: 'Samson',
    section: 'BSIT 4C',
    subject: 'IT-ELEC 3',
    code: '124897',
  },
  {
    date: '10/11/2026',
    timestamp: '11:55 AM',
    status: 'Entered',
    firstName: 'Tristan',
    lastName: 'Cabahug',
    section: 'BSIT 4C',
    subject: 'IT-ELEC 3',
    code: '124897',
  },
  {
    date: '10/11/2026',
    timestamp: '11:55 AM',
    status: 'Left',
    firstName: 'John',
    lastName: 'Injug',
    section: 'BSIT 4C',
    subject: 'IT-ELEC 3',
    code: '124897',
  },
];

export default function Logs({
  isOpen = false,
  onClose = () => {},
  log = null,
  entries = DEFAULT_LOG_ENTRIES,
}) {
  if (!isOpen || !log || typeof document === 'undefined') return null;

  const handleDownloadCSV = () => {
    const headers = ['Date', 'Time Stamp', 'Status', 'First Name', 'Last Name', 'Section', 'Subject', 'EDP Code'];
    const rows = entries.map((e) => [
      e.date,
      e.timestamp,
      e.status,
      e.firstName,
      e.lastName,
      e.section,
      e.subject,
      e.code,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${log?.label ? log.label.replace(/[^a-zA-Z0-9]/g, '_') : 'log'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadPDF = () => {
    window.print();
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
              {log?.label || 'Log 1: 10/11/2026'}
            </div>
            <div className="flex items-center space-x-2 text-sm">
              <span className="font-bold text-gray-900">{log?.course || 'BSIT 4C'}</span>
              <span className="text-gray-600">{log?.subject || 'IT-ELEC 3'}</span>
              <span className="text-gray-600">{log?.code || '124897'}</span>
            </div>
          </div>

          <div className="flex items-center gap-6">
            {/* Download Logs As Section */}
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-gray-700">Download Logs as</span>
              <button
                type="button"
                onClick={handleDownloadCSV}
                className="border-2 border-blue-600 text-blue-600 hover:bg-blue-50 rounded-full px-5 py-1.5 text-sm font-medium transition cursor-pointer"
              >
                CSV
              </button>
              <button
                type="button"
                onClick={handleDownloadPDF}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-5 py-1.5 text-sm font-medium transition shadow-xs cursor-pointer"
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

        {/* Table Content */}
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-center border-collapse">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="py-3 px-4 font-semibold text-gray-700 text-sm">Date</th>
                <th className="py-3 px-4 font-semibold text-gray-700 text-sm">Time Stamp</th>
                <th className="py-3 px-4 font-semibold text-gray-700 text-sm">Status</th>
                <th className="py-3 px-4 font-semibold text-gray-700 text-sm">First Name</th>
                <th className="py-3 px-4 font-semibold text-gray-700 text-sm">Last Name</th>
                <th className="py-3 px-4 font-semibold text-gray-700 text-sm">Section</th>
                <th className="py-3 px-4 font-semibold text-gray-700 text-sm">Subject</th>
                <th className="py-3 px-4 font-semibold text-gray-700 text-sm">EDP Code</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {entries.map((entry, idx) => (
                <tr key={idx} className="hover:bg-gray-50/80 transition-colors">
                  <td className="py-3.5 px-4 text-sm text-gray-700">{entry.date}</td>
                  <td className="py-3.5 px-4 text-sm text-gray-700">{entry.timestamp}</td>
                  <td className="py-3.5 px-4 text-sm text-gray-700">{entry.status}</td>
                  <td className="py-3.5 px-4 text-sm text-gray-700">{entry.firstName}</td>
                  <td className="py-3.5 px-4 text-sm text-gray-700">{entry.lastName}</td>
                  <td className="py-3.5 px-4 text-sm text-gray-700">{entry.section}</td>
                  <td className="py-3.5 px-4 text-sm text-gray-700">{entry.subject}</td>
                  <td className="py-3.5 px-4 text-sm text-gray-700">{entry.code}</td>
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
