import React from 'react';

export default function ViewerFeed() {
  return (
    <div className="w-full max-w-5xl aspect-video bg-[#3d2b1f] border-8 border-[#5c4033] rounded-lg shadow-2xl flex flex-col items-center justify-center p-8 text-white relative">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-serif italic tracking-wide underline decoration-red-500">
          What we'll cover
        </h2>
        <ul className="text-left font-mono text-sm space-y-2 mt-4 bg-black/40 p-6 rounded border border-white/10">
          <li>1. Basic data structures 📚</li>
          <li>2. Big O notation 📈</li>
          <li>3. Searching algorithms 🔍</li>
          <li>4. Sorting algorithms 💻</li>
        </ul>
      </div>
    </div>
  );
}
