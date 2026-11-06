/** Saved work from before the rename to blinken (2026-11-05), moved once to the keys it reads now. */
try {
  for (const old of Object.keys(localStorage)) {
    if (!old.startsWith('bree')) continue;
    const key = `blinken${old.slice(4)}`;
    const value = localStorage.getItem(old);
    if (value !== null && localStorage.getItem(key) === null) localStorage.setItem(key, value);
    localStorage.removeItem(old);
  }
} catch {}

export {};
