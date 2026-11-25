// Pure helpers for weights, results, one-rep max and display text.

export const FULL_STACK = 'ФУЛЛ БЛОК';
export const MODE_LABELS = { platesOnly: 'в блинах', extra: 'доп. вес' };

export const roundQuarter = (n) => Math.round(n * 4) / 4;

// Accepts "62,5" and "62.5". Returns null for anything that is not a weight.
export function parseWeight(text) {
  const clean = String(text).trim().replace(',', '.');
  if (!/^\+?(\d+(\.\d*)?|\.\d+)$/.test(clean)) return null;
  const n = Number(clean);
  return n <= 2000 ? roundQuarter(n) : null;
}

export const stepWeight = (weight, delta) => Math.max(0, roundQuarter((weight ?? 0) + delta));

export function weightNumber(weight, mode) {
  if (weight == null) return '—';
  return (mode === 'extra' && weight > 0 ? '+' : '') + weight;
}

export function weightText(weight, isFullStack, mode) {
  if (mode === 'none') return '';
  if (isFullStack) return FULL_STACK;
  return weight == null ? '—' : `${weightNumber(weight, mode)} кг`;
}

export function shortDate(iso) {
  const d = new Date(iso);
  const two = (n) => String(n).padStart(2, '0');
  return `${two(d.getDate())}.${two(d.getMonth() + 1)}`;
}

export function longDate(iso) {
  return `${shortDate(iso)}.${new Date(iso).getFullYear()}`;
}

// "60 кг · 3×8 · 18.11"
export function resultText(log, mode) {
  return [weightText(log.weightKg, log.isFullStack, mode), `${log.sets}×${log.reps}`, shortDate(log.date)]
    .filter(Boolean).join(' · ');
}

export const newestFirst = (a, b) => b.date.localeCompare(a.date);

// Latest working entry (1RM attempts excluded), optionally only for one rep phase.
export function lastResult(logs, exerciseId, phaseReps = null) {
  return logs
    .filter((l) => l.exerciseId === exerciseId && !l.isOneRepMax
      && (phaseReps == null || l.cyclePhaseReps === phaseReps))
    .sort(newestFirst)[0] ?? null;
}

// The record is the heaviest 1RM entry; working sets never count.
export function oneRepMax(logs, exerciseId) {
  let best = null;
  for (const log of logs) {
    if (log.exerciseId !== exerciseId || !log.isOneRepMax) continue;
    if (!best || log.weightKg > best.weightKg
      || (log.weightKg === best.weightKg && log.date < best.date)) best = log;
  }
  return best;
}

// Non-null when the new attempt beats an existing record.
export function recordBeaten(logs, exerciseId, weightKg) {
  const previous = oneRepMax(logs, exerciseId);
  return previous && weightKg > previous.weightKg
    ? { weightKg, diff: weightKg - previous.weightKg } : null;
}

// Working weight after a saved working set. «ФУЛЛ БЛОК» keeps the last number for later.
export function applyEntry(exercise, { weightKg, isFullStack }) {
  if (exercise.weightMode === 'none') return exercise;
  return {
    ...exercise,
    workingWeightKg: isFullStack ? exercise.workingWeightKg : weightKg,
    isFullStackDefault: isFullStack,
  };
}
