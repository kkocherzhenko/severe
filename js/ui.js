// Small DOM toolkit and the shared components. User text only ever goes in as text nodes.
import { write } from './db.js';

export function h(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === false) continue;
    if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else if (key === 'class') node.className = value;
    else if (key === 'value' || key === 'checked') node[key] = value;
    else node.setAttribute(key, value === true ? '' : value);
  }
  node.append(...children.flat(Infinity).filter((c) => c != null && c !== false && c !== ''));
  return node;
}

export const button = (label, onclick, cls = '', props = {}) =>
  h('button', { type: 'button', class: cls, onclick, ...props }, label);

// ---- Exercise icons: the provided SVG set, loaded once and inlined so CSS can tint it.
export const ICON_NAMES = ['bench', 'cableCurl1', 'cableLat', 'calf', 'chestRow', 'crossover', 'dbCurlSup',
  'hack', 'inclBar45', 'inclCable', 'inclDb45', 'inclDbCurl45', 'inclPlate', 'inclSmith45', 'isoPulldown',
  'latCable', 'latMachine', 'legCurl', 'legPress', 'oneArmExt', 'overhead', 'preacher', 'pullup', 'pushdown',
  'rdl', 'rdlSeated', 'row', 'seatedOverhead', 'shoulderPress2', 'smithSquat', 'tbar', 'wristCurl', 'wristExt'];
const icons = new Map();

export const loadIcons = () => Promise.all(ICON_NAMES.map(async (name) => {
  const response = await fetch(`icons/${name}.svg`);
  if (response.ok) icons.set(name, await response.text());
}));

export function icon(name) {
  const box = h('div', { class: 'ico', 'aria-hidden': 'true' });
  box.innerHTML = icons.get(name) ?? ''; // trusted: only our own files can be in the map
  return box;
}

// ---- Feedback (there are no haptics on iOS web).
export function flash(node) {
  node.classList.remove('flash');
  void node.offsetWidth; // restart the animation
  node.classList.add('flash');
}

export function toast(message) {
  const node = h('div', { class: 'toast', role: 'alert' }, message);
  document.body.append(node);
  setTimeout(() => node.remove(), 4000);
}

// ---- Bottom sheet and in-app dialog.
const layer = () => document.getElementById('overlay');
export const closeSheets = () => layer().replaceChildren();

export function openSheet(title, build) {
  const opener = document.activeElement;
  const close = () => { backdrop.remove(); opener?.focus?.(); };
  const sheet = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': title, tabindex: '-1' },
    h('div', { class: 'sheet-top' }, h('span', { class: 'label' }, `> ${title}`),
      button('×', () => close(), 'x', { 'aria-label': 'Закрыть' })),
    build(() => close()));
  const backdrop = h('div', { class: 'backdrop', onclick: (e) => e.target === backdrop && close() }, sheet);
  layer().append(backdrop);
  sheet.focus();
  return close;
}

export function confirmDialog(message, okLabel, { danger = false } = {}) {
  return new Promise((resolve) => {
    const answer = (value) => { backdrop.remove(); resolve(value); };
    const backdrop = h('div', { class: 'backdrop center' },
      h('div', { class: 'dialog', role: 'alertdialog', 'aria-modal': 'true' },
        h('p', {}, message),
        h('div', { class: 'row' },
          button('ОТМЕНА', () => answer(false), 'btn'),
          button(okLabel, () => answer(true), `btn ${danger ? 'danger' : 'primary'}`))));
    layer().append(backdrop);
  });
}

// Runs an async save once, even on a double tap; re-enables the button if it fails.
export const once = (action) => async (event) => {
  const target = event.currentTarget;
  if (target.disabled) return;
  target.disabled = true;
  try { await action(event); } finally { target.disabled = false; }
};

// ---- Form pieces.
export const field = (label, control) => h('label', { class: 'field' }, h('span', { class: 'label' }, label), control);

export const select = (options, value, onchange, props = {}) => {
  const node = h('select', { onchange: (e) => onchange?.(e.target.value), ...props },
    options.map(([v, text]) => h('option', { value: v }, text)));
  node.value = String(value);
  return node;
};

export function toggle(label, pressed, onchange) {
  const node = button(label, () => {
    const next = node.getAttribute('aria-pressed') !== 'true';
    node.setAttribute('aria-pressed', next);
    onchange?.(next);
  }, 'btn toggle', { 'aria-pressed': String(pressed) });
  return node;
}

export function stepper(label, value, onchange, { min = 1, max = 99 } = {}) {
  const output = h('output', {}, String(value));
  const move = (delta) => (e) => {
    value = Math.min(max, Math.max(min, value + delta));
    output.textContent = value;
    flash(e.currentTarget);
    onchange(value);
  };
  return h('div', { class: 'stepper' }, h('span', { class: 'label' }, label),
    button('−', move(-1), 'sq', { 'aria-label': `${label}: меньше` }), output,
    button('+', move(1), 'sq', { 'aria-label': `${label}: больше` }));
}

// ---- Persistent exercise notes: red footnotes.
export const footnotes = (exercise, onDelete) => exercise.notes.map((note) =>
  h('div', { class: 'footnote' }, h('b', {}, '! '), h('span', {}, note.text),
    onDelete && button('×', () => onDelete(note), 'del', { 'aria-label': 'Удалить заметку' })));

export function notesBlock(exercise, refresh) {
  const save = async () => { await write({ exercises: [exercise] }); await refresh(); };
  const input = h('input', { type: 'text', maxlength: 80, placeholder: 'ступеньки 85 · другой блок 40',
    'aria-label': 'Новая заметка', onkeydown: (e) => e.key === 'Enter' && add() });
  const form = h('div', { class: 'note-form', hidden: true }, input, button('OK', () => add(), 'ok'));
  const open = button('+ ЗАМЕТКА', () => { form.hidden = false; open.hidden = true; input.focus(); }, 'addnote');
  async function add() {
    const text = input.value.trim();
    input.value = '';
    form.hidden = true;
    open.hidden = false;
    if (!text) return;
    exercise.notes.push({ id: crypto.randomUUID(), text, createdAt: new Date().toISOString() });
    await save();
  }
  return h('div', { class: 'notes' },
    footnotes(exercise, async (note) => {
      exercise.notes = exercise.notes.filter((n) => n.id !== note.id);
      await save();
    }), open, form);
}

export const modeLabel = (exercise, labels) =>
  labels[exercise.weightMode] && h('span', { class: 'mode' }, labels[exercise.weightMode]);
