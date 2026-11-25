// «ЕЩЁ»: program links, week order, next workout, rep phase, backup and version.
import { readAll, write, replaceAll } from '../db.js';
import { h, button, field, select, confirmDialog, toast, once } from '../ui.js';
import { POINTER, templatesOfKind } from '../logic/rotation.js';
import { STORES, makeBackup, parseBackup, backupFileName, backupAgeDays } from '../logic/backup.js';

const KINDS = { upper: 'Верх', lower: 'Низ' };

// Hands the whole DB to the iOS share sheet; falls back to a download.
// `data` is already in memory, so share() is still inside the user's tap.
export async function exportBackup(data, refresh) {
  const now = new Date();
  const settings = { ...data.settings, lastBackupAt: now.toISOString() };
  const dump = Object.fromEntries(STORES.map((n) => [n, n === 'settings' ? [settings] : data[n]]));
  const file = new File([makeBackup(dump, now.toISOString())], backupFileName(now), { type: 'application/json' });
  let shared = false;
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      shared = true;
    } catch (error) {
      if (error.name === 'AbortError') return; // cancelled: not a backup
    }
  }
  if (!shared) {
    const link = h('a', { href: URL.createObjectURL(file), download: file.name });
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 60000);
  }
  await write({ settings: [settings] });
  await refresh();
}

async function importBackup(file, refresh) {
  let incoming;
  try { incoming = parseBackup(await file.text()); } catch (error) { toast(error.message); return; }
  const ok = await confirmDialog(`В файле: упражнений ${incoming.exercises.length}, тренировок в программе ${incoming.templates.length}, записей ${incoming.logs.length}, сессий ${incoming.sessions.length}, веса тела ${incoming.bodyWeight.length}. Все данные на телефоне будут ЗАМЕНЕНЫ.`,
    'ЗАМЕНИТЬ', { danger: true });
  if (!ok) return;
  await replaceAll(incoming);
  await refresh();
  toast('Бэкап восстановлен');
}

export function moreScreen(data, refresh) {
  const { settings, templates } = data;
  const save = async (changes) => { await write({ settings: [Object.assign(settings, changes)] }); await refresh(); };
  // After a manual rotation change, an untouched session must not pin the old workout.
  const saveRotation = async (changes) => {
    const idle = data.sessions.filter((s) => !s.finishedAt && !Object.keys(s.done).length);
    await write({}, { sessions: idle.map((s) => s.id) });
    await save(changes);
  };
  const week = settings.weekSlots;
  const slotIndex = settings.nextSlotIndex % week.length;
  const age = settings.lastBackupAt ? backupAgeDays(settings, new Date()) : null;
  const file = h('input', { type: 'file', accept: 'application/json,.json', hidden: true,
    onchange: async () => { if (file.files[0]) await importBackup(file.files[0], refresh); file.value = ''; } });

  return [
    h('h1', {}, 'ЕЩЁ'),
    h('h2', { class: 'group' }, '> Программа'),
    templates.map((t) => h('a', { class: 'btn wide', href: `#/program/${t.id}` }, t.title.toUpperCase())),

    h('h2', { class: 'group' }, '> Порядок недели'),
    week.map((kind, i) => h('div', { class: 'row' }, h('span', { class: 'label' }, `${i + 1}:`),
      select(Object.entries(KINDS), kind,
        (v) => saveRotation({ weekSlots: week.map((k, j) => (j === i ? v : k)) }), { 'aria-label': `Слот ${i + 1}` }),
      week.length > 1 && button('×', () => saveRotation({ weekSlots: week.filter((_, j) => j !== i), nextSlotIndex: 0 }),
        'btn sq', { 'aria-label': 'Убрать слот' }))),
    button('+ слот', () => saveRotation({ weekSlots: [...week, 'upper'] }), 'btn small'),

    h('h2', { class: 'group' }, '> Следующая тренировка'),
    field('СЛОТ НЕДЕЛИ', select(week.map((k, i) => [i, `${i + 1}: ${KINDS[k]}`]), slotIndex,
      (v) => saveRotation({ nextSlotIndex: Number(v) }))),
    Object.keys(KINDS).map((kind) => {
      const list = templatesOfKind(templates, kind);
      return list.length > 1 && field(`СЛЕДУЮЩИЙ ${KINDS[kind].toUpperCase()}`,
        select(list.map((t, i) => [i, t.title]), settings[POINTER[kind]] % list.length,
          (v) => saveRotation({ [POINTER[kind]]: Number(v) })));
    }),

    h('h2', { class: 'group' }, '> Цикл'),
    h('div', { class: 'row' }, [8, 6].map((reps) => button(`${reps} ПОВТ.`,
      () => save({ currentPhaseReps: reps, phaseStartDate: new Date().toISOString() }),
      `btn grow ${settings.currentPhaseReps === reps ? 'primary' : ''}`,
      { 'aria-pressed': String(settings.currentPhaseReps === reps) }))),

    h('h2', { class: 'group' }, '> Бэкап'),
    h('p', { class: 'label' }, age == null ? 'бэкап ещё не делали' : `последний бэкап: ${age} дн. назад`),
    h('p', { class: 'en' }, 'Данные живут только на этом телефоне. Удаление иконки приложения удаляет всё.'),
    button('ЭКСПОРТ', once(() => exportBackup(data, refresh)), 'btn primary wide'),
    button('ИМПОРТ', () => file.click(), 'btn wide'),
    file,

    h('p', { class: 'version label' }, `sévère · версия ${self.APP_VERSION}`),
  ];
}
