// «УПРАЖНЕНИЯ»: list with filter and search, and the add/edit form.
import { write } from '../db.js';
import { h, button, icon, openSheet, toast, once, field, select, toggle, ICON_NAMES } from '../ui.js';
import { weightText, parseWeight, oneRepMax } from '../logic/weights.js';
import { MUSCLE_GROUPS, addSlot, addOption } from '../logic/program.js';

const WEIGHT_MODES = [['total', 'Общий вес'], ['perHand', 'На одну руку'], ['platesOnly', 'В блинах'],
  ['extra', 'Доп. вес (0 = свой вес)'], ['none', 'Без веса']];

// Kept between re-renders so returning to the list keeps the filter.
const filter = { group: null, query: '' };

export function exercisesScreen(data, refresh) {
  const list = h('div');
  const draw = () => {
    const query = filter.query.trim().toLowerCase();
    const found = data.exercises
      .filter((e) => (!filter.group || e.muscleGroup === filter.group)
        && `${e.name} ${e.englishName}`.toLowerCase().includes(query))
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    list.replaceChildren(...Object.entries(MUSCLE_GROUPS).flatMap(([group, title]) => {
      const items = found.filter((e) => e.muscleGroup === group);
      return items.length ? [h('h2', { class: 'group' }, `> ${title}`), ...items.map(row)] : [];
    }));
    if (!found.length) list.append(h('p', { class: 'empty' }, 'Ничего не найдено'));
  };
  const row = (e) => {
    const max = e.tracksOneRepMax && oneRepMax(data.logs, e.id);
    return h('a', { class: 'card plain', href: `#/exercise/${e.id}` }, icon(e.iconName),
      h('div', { class: 'mid' }, h('span', { class: 'ru' }, e.name), h('span', { class: 'en' }, e.englishName),
        e.weightMode !== 'none' && h('span', { class: 'badge' },
          weightText(e.workingWeightKg, e.isFullStackDefault, e.weightMode)),
        max && h('span', { class: 'badge-1rm' }, `1ПМ ${max.weightKg} кг`)));
  };
  const chips = [[null, 'Все'], ...Object.entries(MUSCLE_GROUPS)].map(([group, title]) =>
    button(title, (e) => {
      filter.group = group;
      chips.forEach((c) => c.setAttribute('aria-pressed', c === e.currentTarget));
      draw();
    }, 'chip', { 'aria-pressed': String(filter.group === group) }));
  draw();
  return [
    h('header', { class: 'row between' }, h('h1', {}, 'УПРАЖНЕНИЯ'),
      button('+', () => openExerciseForm(data, refresh), 'btn primary sq', { 'aria-label': 'Новое упражнение' })),
    h('input', { type: 'search', placeholder: 'поиск', 'aria-label': 'Поиск', value: filter.query,
      oninput: (e) => { filter.query = e.target.value; draw(); } }),
    h('div', { class: 'chips' }, chips),
    list,
  ];
}

// exercise = null creates one. place = { templateId, section } preselects where a new one goes.
export function openExerciseForm(data, refresh, exercise = null, place = null) {
  const draft = exercise ? { ...exercise } : { name: '', englishName: '', muscleGroup: place?.section ?? 'chest',
    iconName: ICON_NAMES[0], weightMode: 'total', weightStep: 0.5, workingWeightKg: null,
    isFullStackDefault: false, tracksOneRepMax: false, notes: [] };

  openSheet(exercise ? 'ИЗМЕНИТЬ' : 'НОВОЕ УПРАЖНЕНИЕ', (close) => {
    const text = (value) => h('input', { type: 'text', maxlength: 100, value });
    const decimal = (value) => h('input', { type: 'text', inputmode: 'decimal', value: value == null ? '' : String(value) });
    const name = text(draft.name);
    const english = text(draft.englishName);
    const step = decimal(draft.weightStep);
    const weight = decimal(draft.workingWeightKg);
    const group = select(Object.entries(MUSCLE_GROUPS), draft.muscleGroup);
    const mode = select(WEIGHT_MODES, draft.weightMode);
    const picks = ICON_NAMES.map((n) => {
      const b = button(icon(n), () => {
        draft.iconName = n;
        picks.forEach((p) => p.setAttribute('aria-pressed', p === b));
      }, 'pickicon', { 'aria-label': n, 'aria-pressed': String(draft.iconName === n) });
      return b;
    });
    const placement = !exercise && placementFields(data, place);

    const save = once(async () => {
      const weightStep = parseWeight(step.value);
      const workingWeightKg = weight.value.trim() ? parseWeight(weight.value) : null;
      if (!name.value.trim()) return toast('Нужно название');
      if (!weightStep) return toast('Шаг кнопок: от 0,25');
      if (weight.value.trim() && workingWeightKg == null) return toast('Рабочий вес не распознан');
      const record = { ...draft, id: exercise?.id ?? crypto.randomUUID(),
        createdAt: exercise?.createdAt ?? new Date().toISOString(),
        name: name.value.trim(), englishName: english.value.trim(), muscleGroup: group.value,
        weightMode: mode.value, weightStep, workingWeightKg };
      const template = placement && placement.apply(record.id);
      await write({ exercises: [record], templates: template ? [template] : [] });
      close();
      await refresh();
    });

    return [
      field('НАЗВАНИЕ', name), field('АНГЛИЙСКОЕ НАЗВАНИЕ', english), field('ГРУППА МЫШЦ', group),
      h('div', { class: 'label' }, 'ИКОНКА'), h('div', { class: 'icongrid' }, picks),
      field('ЧТО ОЗНАЧАЕТ ВЕС', mode), field('ШАГ КНОПОК, КГ', step), field('РАБОЧИЙ ВЕС, КГ', weight),
      toggle('ФУЛЛ БЛОК', draft.isFullStackDefault, (on) => { draft.isFullStackDefault = on; }),
      toggle('СЛЕДИТЬ ЗА 1ПМ', draft.tracksOneRepMax, (on) => { draft.tracksOneRepMax = on; }),
      placement?.node,
      button('СОХРАНИТЬ', save, 'btn primary wide'),
    ];
  });
}

// «Добавить в тренировку»: workout, group, and optionally an «ИЛИ» alternative of an existing slot.
function placementFields(data, place) {
  const byId = new Map(data.exercises.map((e) => [e.id, e]));
  const where = h('div');
  let section;
  let slot;
  const template = () => data.templates.find((t) => t.id === workout.value);
  const draw = () => {
    const t = template();
    section = t?.kind === 'upper' ? select(Object.entries(MUSCLE_GROUPS), place?.section ?? 'chest') : null;
    slot = t ? select([['', 'Отдельное упражнение'],
      ...t.slots.map((s) => [s.id, `ИЛИ к: ${byId.get(s.options[0]).name}`])], '',
    (v) => { if (section) section.disabled = v !== ''; }) : null;
    where.replaceChildren(...[section && field('ГРУППА В ТРЕНИРОВКЕ', section),
      slot && field('КАК ДОБАВИТЬ', slot)].filter(Boolean));
  };
  const workout = select([['', 'Не добавлять'], ...data.templates.map((t) => [t.id, t.title])],
    place?.templateId ?? '', draw);
  draw();
  return {
    node: h('div', {}, field('ДОБАВИТЬ В ТРЕНИРОВКУ', workout), where),
    apply(exerciseId) {
      const t = template();
      if (!t) return null;
      return slot.value ? addOption(t, slot.value, exerciseId)
        : addSlot(t, section?.value ?? null, exerciseId, crypto.randomUUID());
    },
  };
}
