import React, { useState } from 'react';

export default function Rooms() {
  const [rooms, setRooms] = useState([
    { id: 1, label: 'Room 1', course: 'BSIT 4C', subject: 'IT-ELEC 3', code: '1234567' },
    { id: 2, label: 'Room 2', course: 'BSIT 4C', subject: 'IT-ELEC 3', code: '1234567' },
  ]);
  
  const [logs, setLogs] = useState([
    { id: 1, label: 'Log 1: 10/11/2026', course: 'BSIT 4C', subject: 'IT-ELEC 3', code: '1234567' },
    { id: 2, label: 'Log 2: 10/10/2026', course: 'BSIT 4C', subject: 'IT-ELEC 3', code: '1234567' },
  ]);

  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleAddRoom = () => {
    // In a real app, this would open a form. Here we just add a dummy room for demonstration.
    const newId = rooms.length > 0 ? Math.max(...rooms.map(r => r.id)) + 1 : 1;
    const newRoom = {
      id: newId,
      label: `Room ${newId}`,
      course: 'BSIT 4C',
      subject: 'IT-ELEC 3',
      code: '1234567'
    };
    setRooms([...rooms, newRoom]);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  return (
    <div className="flex flex-col h-full w-80 bg-white border-r border-gray-200 shadow-sm">
      
      {/* Saved Rooms Section */}
      <div className="flex flex-col h-1/2 border-b border-gray-200">
        <div className="p-4 flex items-center justify-between border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800">Saved Rooms</h2>
          <button 
            onClick={handleAddRoom}
            className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium py-1.5 px-3 rounded-full flex items-center transition-colors"
          >
            Add Room
            <span className="ml-1 font-bold">+</span>
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {rooms.map((room) => (
            <div 
              key={room.id}
              className="p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors group"
            >
              <div className="text-xs text-gray-400 mb-1">
                {room.label}
              </div>
              <div className="flex items-center space-x-2 text-sm">
                <span className="font-bold text-gray-900">{room.course}</span>
                <span className="text-gray-600">{room.subject}</span>
                <span className="text-gray-600">{room.code}</span>
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
          {logs.map((log) => (
            <div 
              key={log.id}
              className="p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
            >
              <div className="text-xs text-gray-400 mb-1">
                {log.label}
              </div>
              <div className="flex items-center space-x-2 text-sm">
                <span className="font-bold text-gray-900">{log.course}</span>
                <span className="text-gray-600">{log.subject}</span>
                <span className="text-gray-600">{log.code}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add Room Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl w-96 p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Add New Room</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Course</label>
                <input type="text" className="w-full border border-gray-300 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-red-500" defaultValue="BSIT 4C" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                <input type="text" className="w-full border border-gray-300 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-red-500" defaultValue="IT-ELEC 3" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
                <input type="text" className="w-full border border-gray-300 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-red-500" defaultValue="1234567" />
              </div>
            </div>
            <div className="mt-6 flex justify-end space-x-3">
              <button 
                onClick={closeModal}
                className="px-4 py-2 bg-gray-100 text-gray-800 rounded-md hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={closeModal}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
