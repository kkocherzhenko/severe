// One exercise: working weight, 1RM, notes and history by date.
import { h, button, icon, notesBlock, modeLabel } from '../ui.js';
import { MODE_LABELS, weightText, oneRepMax, longDate, newestFirst } from '../logic/weights.js';
import { openWorkingWeight, openOneRepMax } from './entry.js';
import { openExerciseForm } from './exercises.js';

export function exerciseScreen(data, refresh, id) {
  const exercise = data.exercises.find((e) => e.id === id);
  if (!exercise) return [h('p', { class: 'empty' }, 'Упражнение не найдено')];
  const mode = exercise.weightMode;
  const max = exercise.tracksOneRepMax && oneRepMax(data.logs, id);
  const history = data.logs.filter((l) => l.exerciseId === id).sort(newestFirst);
  return [
    h('div', { class: 'row between' }, h('a', { class: 'btn small', href: '#/exercises' }, '← НАЗАД'),
      button('Редактировать', () => openExerciseForm(data, refresh, exercise), 'btn small')),
    h('div', { class: 'head' }, icon(exercise.iconName),
      h('div', {}, h('div', { class: 'ru' }, exercise.name), h('div', { class: 'en' }, exercise.englishName))),
    mode !== 'none' && h('section', {}, h('div', { class: 'label' }, 'РАБОЧИЙ ВЕС:'),
      h('div', { class: 'hero' }, weightText(exercise.workingWeightKg, exercise.isFullStackDefault, mode).toUpperCase()),
      modeLabel(exercise, MODE_LABELS),
      h('div', {}, button('изменить', () => openWorkingWeight(exercise, refresh), 'btn small'))),
    exercise.tracksOneRepMax && h('section', {},
      h('div', { class: 'onerm' }, h('span', { class: 'badge-1rm' }, '1ПМ'),
        max ? ` ${max.weightKg} КГ (${longDate(max.date)})` : ' —'),
      button('+ 1ПМ', () => openOneRepMax(data, exercise, '', refresh), 'btn small')),
    notesBlock(exercise, refresh),
    h('h2', { class: 'group' }, '> История'),
    history.length ? history.map((log) => h('div', { class: 'log' },
      h('div', { class: 'label' }, [longDate(log.date), log.workoutTitle].filter(Boolean).join(' · ')),
      h('div', {}, log.isOneRepMax && h('span', { class: 'badge-1rm' }, '1ПМ'), ' ',
        [weightText(log.weightKg, log.isFullStack, mode), `${log.sets}×${log.reps}`].filter(Boolean).join(' · ')),
      log.note && h('div', { class: 'en' }, log.note)))
      : h('p', { class: 'empty' }, 'Записей пока нет'),
  ];
}
