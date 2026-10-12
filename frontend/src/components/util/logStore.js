const KEY = 'focalpoint.logs';
const MAX_LOGS = 10;

export function loadLogs() {
  try {
    const logs = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(logs) ? logs : [];
  } catch {
    return [];
  }
}

export function saveLog(snapshot) {
  if (!snapshot?.rows?.length) return null; // nobody joined, nothing to save

  const logs = loadLogs();
  const number = logs.reduce((max, l) => Math.max(max, l.number || 0), 0) + 1;
  const date = new Date().toLocaleDateString('en-US');
  const entry = {
    id: Date.now(),
    number,
    label: `Log ${number}: ${date}`,
    fieldValues: snapshot.field_values || [],
    columns: snapshot.columns,
    rows: snapshot.rows,
  };

  try {
    localStorage.setItem(KEY, JSON.stringify([entry, ...logs].slice(0, MAX_LOGS)));
  } catch (err) {
    console.error('Failed to save log:', err);
    return null;
  }
  return entry;
}