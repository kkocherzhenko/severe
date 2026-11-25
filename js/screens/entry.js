// Bottom sheets that deal with weight: the entry form, manual working weight and a new 1RM.
import { write } from '../db.js';
import { h, button, icon, openSheet, flash, toast, once, stepper, toggle, field, footnotes, modeLabel } from '../ui.js';
import { MODE_LABELS, parseWeight, stepWeight, weightNumber, weightText, resultText, lastResult,
  oneRepMax, recordBeaten, applyEntry, longDate } from '../logic/weights.js';

// The huge weight number with ±step buttons. read() returns undefined while the input is invalid.
function weightControl(exercise, initial, initialFull) {
  let full = initialFull;
  const input = h('input', { class: 'bignum', type: 'text', inputmode: 'decimal', autocomplete: 'off',
    'aria-label': 'Вес, кг', value: initial == null ? '' : String(initial),
    onfocus: () => input.select(),
    onblur: () => { const n = parseWeight(input.value); if (n != null) input.value = String(n); } });
  const adjust = (delta) => button(`${delta > 0 ? '+' : '−'}${Math.abs(delta)}`, (e) => {
    input.value = String(stepWeight(parseWeight(input.value) ?? initial, delta));
    flash(e.currentTarget);
  }, Math.abs(delta) === exercise.weightStep ? 'btn primary big' : 'btn big');
  const steps = [...new Set([exercise.weightStep, 2.5])];
  const numbers = h('div', {}, input, h('div', { class: 'under' }, 'кг ', modeLabel(exercise, MODE_LABELS)),
    steps.map((s) => h('div', { class: 'row' }, adjust(-s), adjust(s))));
  const fullText = h('div', { class: 'bignum full', hidden: !full }, 'ФУЛЛ БЛОК');
  numbers.hidden = full;
  return {
    node: h('div', { class: 'weight' }, numbers, fullText,
      toggle('ФУЛЛ БЛОК', full, (on) => { full = on; numbers.hidden = on; fullText.hidden = !on; })),
    read() {
      if (full) return { weightKg: null, isFullStack: true };
      const weightKg = parseWeight(input.value);
      if (weightKg == null) { toast('Введи вес, например 62,5'); input.focus(); return undefined; }
      return { weightKg, isFullStack: false };
    },
  };
}

export function openEntry(data, exercise, slot, session, refresh) {
  const phase = data.settings.currentPhaseReps;
  const entry = { sets: slot.plannedSets, reps: slot.repsOverride ?? phase };
  const mode = exercise.weightMode;
  const last = lastResult(data.logs, exercise.id);
  const lastInPhase = lastResult(data.logs, exercise.id, phase);
  const max = exercise.tracksOneRepMax && oneRepMax(data.logs, exercise.id);

  openSheet('ЗАПИСЬ', (close) => {
    const weight = mode === 'none' ? null
      : weightControl(exercise, exercise.workingWeightKg, exercise.isFullStackDefault);
    const note = h('input', { type: 'text', maxlength: 200, placeholder: 'болело плечо' });
    const save = once(async (e) => {
      const value = weight ? weight.read() : { weightKg: null, isFullStack: false };
      if (!value) return;
      const log = { id: crypto.randomUUID(), date: new Date().toISOString(), exerciseId: exercise.id,
        ...value, ...entry, note: note.value.trim(), cyclePhaseReps: phase,
        workoutTitle: session.workoutTitle, isOneRepMax: false };
      const updated = applyEntry(exercise, value);
      const marked = { ...session, done: { ...session.done, [slot.id]: exercise.id },
        chosen: { ...session.chosen, [slot.id]: exercise.id } };
      flash(e.target);
      await write({ logs: [log], exercises: [updated], sessions: [marked] });
      await new Promise((r) => setTimeout(r, 150)); // let the glow be seen
      close();
      await refresh();
    });
    return [
      h('div', { class: 'head' }, icon(exercise.iconName),
        h('div', {}, h('div', { class: 'ru' }, exercise.name), h('div', { class: 'en' }, exercise.englishName))),
      footnotes(exercise),
      h('div', { class: 'previous' }, h('div', { class: 'label' }, '> ПРОШЛЫЙ РАЗ'),
        h('div', {}, last ? resultText(last, mode) : 'записей пока нет'),
        h('div', {}, `в фазе ${phase} повт.: ${lastInPhase ? resultText(lastInPhase, mode) : '—'}`),
        exercise.tracksOneRepMax && h('div', {}, h('span', { class: 'badge-1rm' }, '1ПМ'),
          max ? ` ${weightText(max.weightKg, false, mode)} · ${longDate(max.date)}` : ' —')),
      weight?.node,
      stepper('ПОДХОДЫ', entry.sets, (v) => { entry.sets = v; }),
      stepper('ПОВТОРЫ', entry.reps, (v) => { entry.reps = v; }),
      field('ЗАМЕТКА К ЗАПИСИ', note),
      button('СОХРАНИТЬ', save, 'btn primary wide'),
    ];
  });
}

// Manual change of the working weight. Not written to history.
export function openWorkingWeight(exercise, refresh) {
  openSheet('РАБОЧИЙ ВЕС', (close) => {
    const weight = weightControl(exercise, exercise.workingWeightKg, exercise.isFullStackDefault);
    return [h('div', { class: 'ru' }, exercise.name), weight.node,
      button('СОХРАНИТЬ', once(async () => {
        const value = weight.read();
        if (!value) return;
        await write({ exercises: [applyEntry(exercise, value)] });
        close();
        await refresh();
      }), 'btn primary wide')];
  });
}

export function openOneRepMax(data, exercise, workoutTitle, refresh) {
  openSheet('НОВАЯ ПОПЫТКА 1ПМ', (close) => {
    const input = h('input', { class: 'bignum', type: 'text', inputmode: 'decimal', placeholder: '0',
      'aria-label': '1ПМ, кг' });
    return [h('div', { class: 'ru' }, exercise.name), input,
      h('div', { class: 'under' }, 'кг ', modeLabel(exercise, MODE_LABELS)),
      button('СОХРАНИТЬ', once(async () => {
        const weightKg = parseWeight(input.value);
        if (!weightKg) { toast('Введи вес больше нуля'); return; }
        const beaten = recordBeaten(data.logs, exercise.id, weightKg);
        await write({ logs: [{ id: crypto.randomUUID(), date: new Date().toISOString(),
          exerciseId: exercise.id, weightKg, isFullStack: false, sets: 1, reps: 1, note: '',
          cyclePhaseReps: data.settings.currentPhaseReps, workoutTitle, isOneRepMax: true }] });
        close();
        await refresh();
        if (beaten) showRecord(beaten, exercise.weightMode);
      }), 'btn primary wide')];
  });
}

function showRecord({ weightKg, diff }, mode) {
  const node = h('div', { class: 'record', role: 'alert', onclick: () => node.remove() },
    h('h1', {}, 'НОВЫЙ РЕКОРД'),
    h('div', { class: 'kg' }, `${weightNumber(weightKg, mode)} КГ`),
    h('div', {}, `+${diff}`));
  document.body.append(node);
  setTimeout(() => node.remove(), 1500);
}
