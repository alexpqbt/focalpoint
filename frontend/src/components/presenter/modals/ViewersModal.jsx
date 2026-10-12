import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

export default function ViewersModal({
  viewers = [],
  onRemoveViewer = () => {},
  onClose = () => {},
}) {
  const [labels, setLabels] = useState([]);

  useEffect(() => {
    fetch('/room-config')
      .then((r) => r.json())
      .then((c) => setLabels(c.user_inputs || []))
      .catch(() => setLabels([]));
  }, []);

  const handleRemoveViewer = (identity, e) => {
    e.stopPropagation();
    onRemoveViewer(identity);
  };

  const hasLabels = labels.length > 0;
  const columns = hasLabels ? labels : ['Name'];
  const gridStyle = {
    gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr)) auto`,
  };

  const cellValue = (viewer, label) =>
    hasLabels ? viewer.attributes?.[label] || '' : viewer.name;

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl max-w-2xl w-full shadow-2xl border border-blue-100 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-blue-100">
          <h3 className="font-semibold text-blue-700">Viewers: {viewers.length}</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-blue-500 hover:text-blue-700"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 max-h-96 overflow-y-auto space-y-2">
          <div
            className="grid gap-4 text-xs font-semibold text-blue-400 uppercase border-b pb-2"
            style={gridStyle}
          >
            {columns.map((label) => (
              <span key={label}>{label}</span>
            ))}
            <span className="text-right">Action</span>
          </div>
          {viewers.map((viewer) => (
            <div
              key={viewer.identity}
              className="grid gap-4 items-center text-sm py-2 border-b border-blue-50"
              style={gridStyle}
            >
              {columns.map((label) => (
                <span key={label} className="font-medium text-blue-900 break-words">
                  {cellValue(viewer, label)}
                </span>
              ))}
              <div className="text-right">
                <button
                  type="button"
                  onClick={(e) => handleRemoveViewer(viewer.identity, e)}
                  className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}