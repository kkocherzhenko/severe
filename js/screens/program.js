// Program editor for one workout template.
import { write } from '../db.js';
import { h, button, openSheet, confirmDialog, stepper, field, select } from '../ui.js';
import { MUSCLE_GROUPS, addSlot, addOption, updateSlot, removeOption, removeSlot, moveSlot } from '../logic/program.js';
import { openExerciseForm } from './exercises.js';

export function programScreen(data, refresh, id) {
  let template = data.templates.find((t) => t.id === id);
  if (!template) return [h('p', { class: 'empty' }, 'Тренировка не найдена')];
  const byId = new Map(data.exercises.map((e) => [e.id, e]));
  // `template` is replaced synchronously so quick taps build on each other.
  const save = async (next) => {
    template = next;
    data.templates[data.templates.findIndex((t) => t.id === id)] = next;
    await write({ templates: [next] });
    await refresh();
  };

  // Pick an existing exercise (or create one) for a new slot, or as an «ИЛИ» alternative.
  const pick = (section, slot = null) => openSheet(slot ? 'ДОБАВИТЬ «ИЛИ»' : '+ УПРАЖНЕНИЕ', (close) => {
    const use = async (exerciseId) => {
      close();
      await save(slot ? addOption(template, slot.id, exerciseId)
        : addSlot(template, section, exerciseId, crypto.randomUUID()));
    };
    return [
      !slot && button('СОЗДАТЬ НОВОЕ', () => {
        close();
        openExerciseForm(data, refresh, null, { templateId: id, section });
      }, 'btn primary wide'),
      [...data.exercises].sort((a, b) => a.name.localeCompare(b.name, 'ru'))
        .filter((e) => !slot?.options.includes(e.id))
        .map((e) => button(e.name, () => use(e.id), 'btn wide plain')),
    ];
  });

  const remove = async (question, next) => {
    if (await confirmDialog(question, 'УБРАТЬ', { danger: true })) await save(next());
  };

  const slotCard = (slot) => h('div', { class: 'edit' },
    slot.options.map((exerciseId, i) => h('div', { class: 'row' },
      h('span', { class: 'grow ru' }, i > 0 && h('span', { class: 'or' }, 'ИЛИ'), ' ', byId.get(exerciseId).name),
      i > 0 && button('↑', () => {
        const options = [...slot.options];
        [options[i - 1], options[i]] = [options[i], options[i - 1]];
        save(updateSlot(template, slot.id, { options }));
      }, 'btn sq', { 'aria-label': 'Вариант выше' }),
      slot.options.length > 1 && button('×',
        () => remove(`Убрать вариант «${byId.get(exerciseId).name}»?`, () => removeOption(template, slot.id, exerciseId)),
        'btn sq danger-line', { 'aria-label': 'Убрать вариант' }))),
    stepper('ПОДХОДЫ', slot.plannedSets, (v) => save(updateSlot(template, slot.id, { plannedSets: v }))),
    field('ПОВТОРЫ', select([['', 'по фазе цикла'], ...Array.from({ length: 30 }, (_, i) => [i + 1, String(i + 1)])],
      slot.repsOverride ?? '', (v) => save(updateSlot(template, slot.id, { repsOverride: v ? Number(v) : null })))),
    h('div', { class: 'row' },
      button('↑', () => save(moveSlot(template, slot.id, -1)), 'btn sq', { 'aria-label': 'Выше' }),
      button('↓', () => save(moveSlot(template, slot.id, 1)), 'btn sq', { 'aria-label': 'Ниже' }),
      button('+ ИЛИ', () => pick(slot.section, slot), 'btn small grow'),
      button('УБРАТЬ', () => remove('Убрать это упражнение из тренировки? История записей останется.',
        () => removeSlot(template, slot.id)), 'btn small danger-line')));

  // Upper: one block per group. Lower: a single flat list.
  const sections = template.kind === 'lower' ? [null] : [...new Set(template.slots.map((s) => s.section))];
  return [
    h('a', { class: 'btn small', href: '#/more' }, '← НАЗАД'),
    h('h1', {}, template.title.toUpperCase()),
    sections.map((section) => [
      section && h('h2', { class: 'group' }, `> ${MUSCLE_GROUPS[section]}`),
      template.slots.filter((s) => s.section === section).map(slotCard),
      button('+ упражнение', () => pick(section), 'btn wide dashed'),
    ]),
    template.kind === 'upper' && field('ДОБАВИТЬ ГРУППУ', select(
      [['', 'выбери группу…'], ...Object.entries(MUSCLE_GROUPS).filter(([g]) => !sections.includes(g))],
      '', (v) => v && pick(v))),
  ];
}
