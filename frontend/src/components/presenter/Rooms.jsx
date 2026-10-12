import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { createPortal } from 'react-dom';
import { Cast, X, Plus } from 'lucide-react';
import Logs from './Logs';
import { loadLogs } from '../util/logStore.js';

const cleanUserInputs = (inputs = []) =>
  inputs.map(v => v.trim()).filter(Boolean);

const findDuplicate = (labels) => {
  const seen = new Set();
  for (const label of labels) {
    const key = label.toLowerCase();
    if (seen.has(key)) return label;
    seen.add(key);
  }
  return null;
};

const DEFAULT_FIELDS = [
  { name: 'Section', value: 'BSIT 4C' },
  { name: 'Subject', value: 'IT-ELEC 3' },
  { name: 'EDP Code', value: '1234567' },
];

const copyFields = (fields = []) => fields.map(f => ({ ...f }));

const cleanFields = (fields = []) =>
  fields
    .map(f => ({ name: f.name.trim(), value: f.value.trim() }))
    .filter(f => f.name);

const Rooms = forwardRef(function Rooms({ className = '', onShareScreen = () => {} }, ref) {
    const [rooms, setRooms] = useState([
    {
      id: 1,
      label: 'Room 1',
      roomSize: '51',
      fields: copyFields(DEFAULT_FIELDS),
      userInputs: ['First Name', 'Last Name']
    },
    {
      id: 2,
      label: 'Room 2',
      roomSize: '51',
      fields: copyFields(DEFAULT_FIELDS),
      userInputs: ['First Name', 'Last Name']
    },
  ]);
  
  const [logs, setLogs] = useState(null); // null = still loading

  useEffect(() => {
    let cancelled = false;
    loadLogs().then((l) => {
      if (!cancelled) setLogs(l);
    });
    return () => { cancelled = true; };
  }, []);

  const [selectedRoom, setSelectedRoom] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [formData, setFormData] = useState({});
  const [inputError, setInputError] = useState('');

  const [selectedLog, setSelectedLog] = useState(null);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);

  const handleSelectRoom = (room) => {
    setInputError('');
    setSelectedRoom(room);
    setFormData({ 
      ...room,
      fields: copyFields(room.fields),
      userInputs: [...(room.userInputs || [])]
    });
    setIsCustomizing(false);
    setIsModalOpen(true);
  };

  const handleAddRoom = () => {
    setInputError('');
    const newId = rooms.length > 0 ? Math.max(...rooms.map(r => r.id)) + 1 : 1;
    const newRoom = {
      id: newId,
      label: `Room ${newId}`,
      roomSize: '51',
      fields: copyFields(DEFAULT_FIELDS),
      userInputs: ['First Name', 'Last Name']
    };
    setRooms(prev => [...prev, newRoom]);
    setSelectedRoom(newRoom);
    setFormData({ 
      ...newRoom,
      fields: copyFields(newRoom.fields),
      userInputs: [...newRoom.userInputs]
    });
    setIsCustomizing(true);
    setIsModalOpen(true);
  };

  useImperativeHandle(ref, () => ({
    handleAddRoom,
  }));

  const handleAddField = () => {
    setFormData(prev => ({
      ...prev,
      fields: [...(prev.fields || []), { name: '', value: '' }]
    }));
  };

  const handleRemoveField = (index) => {
    setFormData(prev => ({
      ...prev,
      fields: (prev.fields || []).filter((_, i) => i !== index)
    }));
  };

  const handleFieldChange = (index, key, value) => {
    setFormData(prev => {
      const newFields = [...(prev.fields || [])];
      newFields[index] = { ...newFields[index], [key]: value };
      return { ...prev, fields: newFields };
    });
  };

  const handleAddUserInput = () => {
    setFormData(prev => ({
      ...prev,
      userInputs: [...(prev.userInputs || []), '']
    }));
  };

  const handleRemoveUserInput = (index) => {
    setFormData(prev => ({
      ...prev,
      userInputs: (prev.userInputs || []).filter((_, i) => i !== index)
    }));
  };

  const handleUserInputChange = (index, value) => {
    setFormData(prev => {
      const newInputs = [...(prev.userInputs || [])];
      newInputs[index] = value;
      return { ...prev, userInputs: newInputs };
    });
  };

  const handleSaveCustomization = () => {
    const userInputs = cleanUserInputs(formData.userInputs);
    const fields = cleanFields(formData.fields);

    const dupInput = findDuplicate(userInputs);
    if (dupInput) {
      setInputError(`"${dupInput}" is used more than once in User Inputs.`);
      return;
    }
    const dupField = findDuplicate(fields.map(f => f.name));
    if (dupField) {
      setInputError(`"${dupField}" is used more than once in Fields.`);
      return;
    }
    if (userInputs.length > 5) {
      setInputError('User Inputs allow at most 5 entries.');
      return;
    }
    if (fields.length > 6) {
      setInputError('Fields allow at most 6 entries.');
      return;
    }

    setInputError('');
    const saved = { ...formData, userInputs, fields };
    setRooms(prev => prev.map(r => r.id === selectedRoom.id ? saved : r));
    setSelectedRoom(saved);
    setIsCustomizing(false);
  };

  const handleShareScreen = async () => {
  const userInputs = cleanUserInputs(selectedRoom.userInputs);
    try {
      const res = await fetch('/room-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_inputs: userInputs,
          fields: cleanFields(selectedRoom.fields),
        }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setInputError('Could not send viewer fields to the server.');
      return;
    }
    setInputError('');
    setIsModalOpen(false);
    if (onShareScreen) {
      onShareScreen(selectedRoom);
    }
  };

  const closeModal = () => {
    setInputError('');
    setIsModalOpen(false);
    setIsCustomizing(false);
  };

  return (
    <div className={`flex flex-col h-full w-80 bg-white/95 backdrop-blur-sm border border-gray-200/80 rounded-2xl shadow-xl overflow-hidden text-left ${className}`}>
      
      {/* Saved Rooms Section */}
      <div className="flex flex-col h-1/2 border-b border-gray-200">
        <div className="p-4 flex items-center justify-between border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800">Saved Rooms</h2>
          <button 
            onClick={handleAddRoom}
            className="bg-blue-400 hover:bg-blue-500 text-white text-sm font-medium py-1.5 px-3 rounded-full flex items-center transition-colors"
          >
            Add Room
            <span className="ml-1 font-bold">+</span>
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {rooms.map((room) => (
            <div 
              key={room.id}
              onClick={() => handleSelectRoom(room)}
              className="p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors group"
            >
              <div className="text-xs text-gray-400 mb-1">
                {room.label}
              </div>
              <div className="flex items-center space-x-2 text-sm">
                {(room.fields || []).map((f, i) => (
                  <span key={i} className={i === 0 ? 'font-bold text-gray-900' : 'text-gray-600'}>
                    {f.value}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Logs Section */}
      <div className="flex flex-col h-1/2">
        <div className="p-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800">Logs</h2>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {logs && logs.length === 0 && (
            <p className="p-3 text-sm text-gray-400">No saved logs yet.</p>
          )}
          {(logs || []).map((log) => (
            <div
              key={log.id}
              onClick={() => {
                setSelectedLog(log);
                setIsLogModalOpen(true);
              }}
              className="p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors group"
            >
              <div className="text-xs text-gray-400 mb-1">
                {log.label}
              </div>
              <div className="flex items-center space-x-2 text-sm">
                {(log.fieldValues || []).filter(Boolean).map((v, i) => (
                  <span key={i} className={i === 0 ? 'font-bold text-gray-900' : 'text-gray-600'}>
                    {v}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Customization Modal rendered outside container via portal to hover above sidebar and splashscreen */}
      {isModalOpen && selectedRoom && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4"
          onClick={closeModal}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl border border-gray-100 max-w-4xl w-full p-8 relative animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-6 border-b border-gray-100">
              <div className="flex items-center gap-4">
                <h2 className="text-xl font-bold text-gray-900">
                  {isCustomizing ? `Customize ${selectedRoom.label}` : selectedRoom.label}
                </h2>
                <button
                  type="button"
                  onClick={handleShareScreen}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-5 rounded-full flex items-center gap-2 text-sm shadow-md transition-all active:scale-95"
                >
                  <span>Share Screen</span>
                  <Cast className="w-4 h-4" />
                </button>
                {isCustomizing ? (
                  <button
                    type="button"
                    onClick={handleSaveCustomization}
                    className="border-2 border-blue-600 text-blue-600 hover:bg-blue-50 font-medium py-2 px-5 rounded-full text-sm transition-all"
                  >
                    Save Customization
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsCustomizing(true)}
                    className="border-2 border-blue-600 text-blue-600 hover:bg-blue-50 font-medium py-2 px-5 rounded-full text-sm transition-all"
                  >
                    Customize
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-700 p-1 rounded-lg transition-colors"
                aria-label="Close modal"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {inputError && (
              <p className="pt-4 text-sm text-red-600" role="alert">{inputError}</p>
            )}

            {/* Modal Body */}
            {isCustomizing ? (
              <div className="space-y-6 pt-6">
                {/* Room Size Section */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Room size (Max 51)
                  </label>
                  <input
                    type="text"
                    value={formData.roomSize ?? '51'}
                    onChange={(e) => setFormData(prev => ({ ...prev, roomSize: e.target.value }))}
                    placeholder="51"
                    className="w-72 border border-gray-300 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
                  />
                </div>

                {/* Fields Section */}
                <div>
                  <div className="mb-3">
                    <button
                      type="button"
                      onClick={handleAddField}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-xl flex items-center gap-1.5 text-sm shadow-sm transition active:scale-95"
                    >
                      <span>Add Field</span>
                      <Plus className="w-4 h-4 font-bold" />
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {formData.fields?.map((field, idx) => (
                      <div key={idx} className="flex flex-col gap-2">
                        <div className="flex justify-between items-center text-xs text-gray-500 px-1">
                          <span>Field Name</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveField(idx)}
                            className="text-blue-600 hover:text-blue-800 font-medium cursor-pointer transition"
                          >
                            Remove
                          </button>
                        </div>
                        <input
                          type="text"
                          value={field.name}
                          maxLength={30}
                          onChange={(e) => handleFieldChange(idx, 'name', e.target.value)}
                          placeholder="Field Name"
                          className="w-full border border-gray-300 rounded-xl py-2 px-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
                        />
                        <input
                          type="text"
                          value={field.value}
                          maxLength={50}
                          onChange={(e) => handleFieldChange(idx, 'value', e.target.value)}
                          placeholder="Value"
                          className="w-full border border-gray-300 rounded-xl py-2 px-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* User Inputs Section */}
                <div>
                  <div className="mb-3">
                    <button
                      type="button"
                      onClick={handleAddUserInput}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-xl flex items-center gap-1.5 text-sm shadow-sm transition active:scale-95"
                    >
                      <span>User Inputs</span>
                      <Plus className="w-4 h-4 font-bold" />
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {formData.userInputs?.map((input, idx) => (
                      <div key={idx} className="flex flex-col">
                        <div className="flex justify-between items-center text-xs text-gray-500 mb-1 px-1">
                          <span>Input Name</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveUserInput(idx)}
                            className="text-blue-600 hover:text-blue-800 font-medium cursor-pointer transition"
                          >
                            Remove
                          </button>
                        </div>
                        <div className="relative">
                          <input
                            type="text"
                            value={input}
                            onChange={(e) => handleUserInputChange(idx, e.target.value)}
                            placeholder="Input Name"
                            className="w-full border border-gray-300 rounded-xl py-2 px-3 pr-8 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveUserInput(idx)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-blue-600 hover:text-blue-800 transition"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6 pt-6">
                {/* Max Size */}
                <div className="pb-6 border-b border-gray-200">
                  <div className="text-base">
                    <span className="font-bold text-gray-800">Max Size: </span>
                    <span className="text-gray-600">
                      {selectedRoom.roomSize ? `${selectedRoom.roomSize}` : 'Not Set (Default 51)'}
                    </span>
                  </div>
                </div>

                {/* Fields */}
                <div className="pb-6 border-b border-gray-200">
                  <h3 className="font-bold text-gray-800 text-base mb-2">Fields</h3>
                  <p className="text-gray-600 text-sm">
                    {selectedRoom.fields && selectedRoom.fields.length > 0
                      ? selectedRoom.fields.map(f => `${f.name}: ${f.value || '—'}`).join(', ')
                      : 'Not Set (Default logs)'}
                  </p>
                </div>

                {/* User Inputs */}
                <div className="pb-2">
                  <h3 className="font-bold text-gray-800 text-base mb-2">User Inputs</h3>
                  <p className="text-gray-600 text-sm">
                    {selectedRoom.userInputs && selectedRoom.userInputs.length > 0
                      ? selectedRoom.userInputs.filter(Boolean).join(', ')
                      : 'Not Set (Default Enter Name)'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* Logs Modal */}
      <Logs
        isOpen={isLogModalOpen}
        onClose={() => setIsLogModalOpen(false)}
        log={selectedLog}
      />

    </div>
  );
});

export default Rooms;
