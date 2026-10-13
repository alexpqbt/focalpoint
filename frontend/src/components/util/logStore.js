export async function loadLogs() {
  try {
    const res = await fetch('/logs/saved');
    if (!res.ok) return [];
    const logs = await res.json();
    return Array.isArray(logs) ? logs : [];
  } catch (err) {
    console.error('Failed to load logs:', err);
    return [];
  }
}

export async function saveLog(snapshot) {
  if (!snapshot?.rows?.length) return null; // nobody joined, nothing to save
  try {
    const res = await fetch('/logs/saved', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        columns: snapshot.columns,
        rows: snapshot.rows,
        field_values: snapshot.field_values || [],
      }),
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const data = await res.json();
    return data.entry || null;
  } catch (err) {
    console.error('Failed to save log:', err);
    return null;
  }
}