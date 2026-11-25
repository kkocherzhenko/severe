// Pure backup format: build, serialize and strictly validate before anything is replaced.

export const STORES = ['exercises', 'templates', 'logs', 'sessions', 'bodyWeight', 'settings'];
const SCHEMA = 1;
const MODES = ['total', 'perHand', 'platesOnly', 'extra', 'none'];

export function makeBackup(data, now) {
  return JSON.stringify({ app: 'severe', schema: SCHEMA, exportedAt: now, data }, null, 1);
}

export const backupFileName = (date) => {
  const two = (n) => String(n).padStart(2, '0');
  return `severe-backup-${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}.json`;
};

// Whole days since the last backup (or since install if there was none).
export function backupAgeDays(settings, now) {
  const since = settings.lastBackupAt ?? settings.installedAt;
  return Math.floor((new Date(now) - new Date(since)) / 86400000);
}

const isText = (v) => typeof v === 'string' && v !== '';

// Returns the data object, or throws an Error with a Russian message.
export function parseBackup(text) {
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  let file;
  try { file = JSON.parse(text); } catch { throw new Error('Файл не читается: это не JSON.'); }
  check(file?.app === 'severe' && file.data, 'Это не бэкап sévère.');
  check(file.schema === SCHEMA, 'Бэкап другой версии формата.');
  const data = file.data;
  for (const store of STORES) {
    check(Array.isArray(data[store]) && data[store].every((r) => r && isText(r.id))
      && new Set(data[store].map((r) => r.id)).size === data[store].length,
    `Бэкап повреждён: раздел «${store}».`);
  }
  check(data.exercises.every((e) => isText(e.name) && MODES.includes(e.weightMode)
    && e.weightStep > 0 && Array.isArray(e.notes)), 'Бэкап повреждён: упражнения.');
  const known = new Set(data.exercises.map((e) => e.id));
  check(data.templates.every((t) => ['upper', 'lower'].includes(t.kind) && Array.isArray(t.slots)
    && t.slots.every((s) => s && isText(s.id) && Array.isArray(s.options) && s.options.length > 0
      && s.options.every((id) => known.has(id)))), 'Бэкап повреждён: программа.');
  check(data.logs.every((l) => isText(l.exerciseId) && isText(l.date)), 'Бэкап повреждён: записи.');
  check(data.sessions.every((s) => isText(s.date) && s.chosen && s.done), 'Бэкап повреждён: тренировки.');
  const app = data.settings.find((s) => s.id === 'app');
  check(app && Array.isArray(app.weekSlots) && app.weekSlots.length > 0
    && app.weekSlots.every((kind) => data.templates.some((t) => t.kind === kind))
    && ['nextSlotIndex', 'nextUpperIndex', 'nextLowerIndex'].every((k) => Number.isInteger(app[k]) && app[k] >= 0)
    && [6, 8].includes(app.currentPhaseReps), 'Бэкап повреждён: настройки.');
  return data;
}
