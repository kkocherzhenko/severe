// «СЕГОДНЯ»: the current workout, done marks, «ИЛИ» choice and finishing.
import { write } from '../db.js';
import { h, button, icon, openSheet, confirmDialog, once, notesBlock, modeLabel } from '../ui.js';
import { nextWorkout, advance, chosenOption, progress, finishSession } from '../logic/rotation.js';
import { MODE_LABELS, weightText, resultText, lastResult } from '../logic/weights.js';
import { MUSCLE_GROUPS } from '../logic/program.js';
import { backupAgeDays } from '../logic/backup.js';
import { openEntry, openWorkingWeight, openOneRepMax } from './entry.js';
import { exportBackup } from './more.js';

export function todayScreen(data, refresh) {
  const { settings, templates } = data;
  let session = data.sessions.find((s) => !s.finishedAt);
  const template = templates.find((t) => t.id === session?.templateId) ?? nextWorkout(settings, templates);
  const byId = new Map(data.exercises.map((e) => [e.id, e]));

  // The session is created by the first action. It is mutated in place so quick taps don't race.
  const current = () => {
    if (!session) {
      session = { id: crypto.randomUUID(), date: new Date().toISOString(), templateId: template.id,
        workoutTitle: template.title, chosen: {}, done: {}, doneExerciseIds: [], finishedAt: null };
      data.sessions.push(session);
    }
    session.templateId = template.id;
    session.workoutTitle = template.title;
    return session;
  };
  const saveSession = async () => { await write({ sessions: [current()] }); await refresh(); };

  function card(slot, id, index) {
    const exercise = byId.get(id);
    const isChoice = slot.options.length > 1;
    const selected = chosenOption(slot, session) === id;
    const done = session?.done[slot.id] === id;
    const last = lastResult(data.logs, id);
    // First tap on an unselected alternative selects it; a tap on the selected card opens the entry.
    const tap = async () => {
      if (isChoice && !selected) { current().chosen[slot.id] = id; await saveSession(); } else {
        openEntry(data, exercise, slot, current(), refresh);
      }
    };
    const mark = async (e) => {
      e.stopPropagation();
      const s = current();
      if (s.done[slot.id] === id) delete s.done[slot.id];
      else { s.done[slot.id] = id; s.chosen[slot.id] = id; }
      await saveSession();
    };
    const cls = ['card', isChoice && 'opt', isChoice && selected && 'sel', done && 'isdone'].filter(Boolean).join(' ');
    return h('div', { class: cls, onclick: (e) => { if (!e.target.closest('button,input,.notes')) tap(); } },
      icon(exercise.iconName),
      h('div', { class: 'mid' },
        index > 0 && h('div', { class: 'or' }, 'ИЛИ'),
        button([h('span', { class: 'ru' }, exercise.name), h('span', { class: 'en' }, exercise.englishName)],
          tap, 'title', isChoice ? { 'aria-pressed': String(selected) } : {}),
        exercise.weightMode !== 'none' && h('div', {},
          button(weightText(exercise.workingWeightKg, exercise.isFullStackDefault, exercise.weightMode),
            () => openWorkingWeight(exercise, refresh), 'badge', { 'aria-label': 'Изменить рабочий вес' }),
          modeLabel(exercise, MODE_LABELS)),
        h('div', { class: 'last' }, last ? resultText(last, exercise.weightMode) : 'ещё нет записей'),
        exercise.tracksOneRepMax && button('+ 1ПМ',
          () => openOneRepMax(data, exercise, template.title, refresh), 'addnote blue'),
        notesBlock(exercise, refresh)),
      button('', mark, 'done', { role: 'checkbox', 'aria-checked': String(done), 'aria-label': `Сделано: ${exercise.name}` }));
  }

  const list = [];
  let section;
  for (const slot of template.slots) {
    if (slot.section && slot.section !== section) {
      list.push(h('h2', { class: 'group' }, `> ${MUSCLE_GROUPS[slot.section]}`));
    }
    section = slot.section;
    list.push(h('div', { class: 'slot' }, slot.options.map((id, i) => card(slot, id, i))));
  }

  const pick = () => openSheet('СМЕНИТЬ ТРЕНИРОВКУ', (close) => templates.map((t) =>
    button(t.title.toUpperCase(), async () => {
      // Only the workout changes; done marks are keyed by slot, so switching back restores them.
      const s = current();
      Object.assign(s, { templateId: t.id, workoutTitle: t.title });
      await write({ sessions: [s] });
      close();
      await refresh();
    }, `btn wide ${t.id === template.id ? 'primary' : ''}`)));

  const finish = once(async () => {
    const count = progress(template, session).done;
    if (!count && !await confirmDialog('Ничего не отмечено. Всё равно завершить тренировку и перейти к следующей?', 'ЗАВЕРШИТЬ')) return;
    const result = finishSession(settings, templates, current(), new Date().toISOString());
    await write({ settings: [result.settings], templates: [result.template], sessions: [result.session] });
    await refresh();
    scrollTo(0, 0);
  });

  const { done, total } = progress(template, session);
  const after = nextWorkout(advance(settings, templates, template), templates);
  const age = backupAgeDays(settings, new Date());
  return [
    h('header', { class: 'today' },
      h('div', { class: 'logo' }, 'sévère', h('span', {}, '_')),
      h('h1', {}, 'СЕГОДНЯ'),
      h('div', { class: 'workout' }, template.kind === 'upper'
        ? [h('span', {}, 'ВЕРХ —'), h('span', { class: 'letter' }, template.label)]
        : h('span', { class: 'letter word' }, 'НИЗ')),
      h('div', { class: 'status' }, `> ЦИКЛ: ${settings.currentPhaseReps} ПОВТ. · СЛЕД.: ${after.title.toUpperCase()}`),
      h('div', { class: 'row between' }, h('div', { class: 'count' }, `СДЕЛАНО ${done}/${total}`),
        button('Сменить', pick, 'btn small'))),
    age > 14 && button(`! бэкап ${age} дн. назад`, () => exportBackup(data, refresh), 'footnote reminder'),
    ...list,
    button('ЗАВЕРШИТЬ ТРЕНИРОВКУ', finish, 'btn primary wide finish'),
  ];
}
