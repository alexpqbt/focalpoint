import React, { useState, useEffect } from 'react';

export default function ViewerJoin({ onConnect = () => {} }) {
  const [userInputs, setUserInputs] = useState(null);
  const [answers, setAnswers] = useState({});
  const [name, setName] = useState('');

  useEffect(() => {
    fetch('/room-config')
      .then((r) => r.json())
      .then((c) => setUserInputs(c.user_inputs || []))
      .catch(() => setUserInputs([]));
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!userInputs || userInputs.length === 0) {
      if (!name.trim()) {
        alert('Please enter your display name');
        return;
      }
      onConnect(name.trim());
      return;
    }

    const values = userInputs.map((label) => (answers[label] || '').trim());
    if (values.some((v) => !v)) {
      alert('Please fill in all fields');
      return;
    }
    const answersByLabel = {};
    userInputs.forEach((label, i) => {
      answersByLabel[label] = values[i];
    });
    onConnect(values.join(' '), answersByLabel);
  };

  if (userInputs === null) {
    return <main className="flex-1 flex items-center justify-center p-6 bg-slate-50 min-h-screen text-blue-700">Loading…</main>;
  }

  const inputClass =
    'w-full border border-blue-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-blue-600 text-blue-900 bg-white';

  return (
    <main className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-slate-50 min-h-screen">
      <div className="bg-white/90 backdrop-blur-md p-8 rounded-2xl shadow-xl border border-blue-100 max-w-sm w-full flex flex-col items-center space-y-6">
        <h2 className="text-xl font-bold text-blue-600 tracking-tight">Enter display name</h2>
        <form onSubmit={handleSubmit} className="w-full space-y-4">
          {userInputs.length === 0 ? (
            <input
              type="text"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              autoFocus
            />
          ) : (
            userInputs.map((label, i) => (
              <input
                key={label}
                type="text"
                placeholder={label}
                aria-label={label}
                value={answers[label] || ''}
                onChange={(e) => setAnswers({ ...answers, [label]: e.target.value })}
                className={inputClass}
                autoFocus={i === 0}
              />
            ))
          )}
          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg shadow transition active:scale-95"
          >
            Connect
          </button>
        </form>
      </div>
    </main>
  );
}