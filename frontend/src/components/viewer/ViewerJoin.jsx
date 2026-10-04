import React, { useState } from 'react';

export default function ViewerJoin({ onConnect = () => {} }) {
  const [name, setName] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      alert("Please enter your display name");
      return;
    }
    onConnect(name.trim());
  };

  return (
    <main className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-slate-50 min-h-screen">
      <div className="bg-white/90 backdrop-blur-md p-8 rounded-2xl shadow-xl border border-red-100 max-w-sm w-full flex flex-col items-center space-y-6">
        <h2 className="text-xl font-bold text-red-600 tracking-tight">Enter display name</h2>
        <form onSubmit={handleSubmit} className="w-full space-y-4">
          <input 
            type="text"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border border-red-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-red-600 text-red-900 bg-white"
            autoFocus
          />
          <button 
            type="submit"
            className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-3 rounded-lg shadow transition active:scale-95"
          >
            Connect
          </button>
        </form>
      </div>
    </main>
  );
}
