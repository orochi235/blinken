// The headline numbers of a benchmark run's record, shared by the sweep and the table.
const pct = (xs, p) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : Number.NaN;
};
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** The run's headline numbers, from its frames past the warmup. */
export function digest(r) {
  const kept = r.frames.filter((f) => f.t >= r.warmupMs);
  const gaps = kept.slice(1).map((f, i) => f.t - (kept[i]?.t ?? 0));
  const span = kept.length > 1 ? (kept.at(-1).t - kept[0].t) / 1000 : Number.NaN;
  return {
    frames: kept.length,
    fps: (kept.length - 1) / span,
    p50: pct(gaps, 0.5),
    p95: pct(gaps, 0.95),
    mixMs: mean(kept.map((f) => f.mixMs)),
    drawMs: mean(kept.map((f) => f.drawMs)),
  };
}

/** A run's record, by name; onto keeps its own files beside them. */
export const RECORD = /^\d{4}-.*\.json$/;

const n = (x, w, d) => x.toFixed(d).padStart(w);

// `node scripts/bench-digest.mjs <label>` prints that label's runs as a Markdown table, averaging
// repeats of one backend and light count.
if (import.meta.url === `file://${process.argv[1]}`) {
  const { readdirSync, readFileSync } = await import('node:fs');
  const dir = new URL('../bench/runs/', import.meta.url);
  const label = process.argv[2];
  const cells = new Map();
  for (const f of readdirSync(dir)
    .filter((f) => RECORD.test(f))
    .sort()) {
    const r = JSON.parse(readFileSync(new URL(f, dir), 'utf8'));
    if (r.label !== label || r.error) continue;
    const key = `${r.asked.lights ?? r.asked.digits} ${r.asked.way ?? r.backend}`;
    cells.set(key, [...(cells.get(key) ?? []), { r, d: digest(r) }]);
  }
  console.log('|   size | way     | runs |    fps | p50 ms | p95 ms | mix ms | draw ms |');
  console.log('| -----: | :------ | ---: | -----: | -----: | -----: | -----: | ------: |');
  for (const [, runs] of [...cells].sort((a, b) => parseInt(a[0], 10) - parseInt(b[0], 10))) {
    const { r } = runs[0];
    const avg = (k) => mean(runs.map((x) => x.d[k]));
    console.log(
      `| ${n(r.asked.lights ?? r.asked.digits, 6, 0)} | ${(r.asked.way ?? r.backend).padEnd(7)} | ${n(runs.length, 4, 0)} | ${n(avg('fps'), 6, 1)} | ${n(avg('p50'), 6, 2)} | ${n(avg('p95'), 6, 2)} | ${n(avg('mixMs'), 6, 2)} | ${n(avg('drawMs'), 7, 2)} |`,
    );
  }
}
