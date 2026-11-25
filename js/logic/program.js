// Pure edits of a workout template. Each returns a new template.

export const MUSCLE_GROUPS = {
  chest: 'Грудь', back: 'Спина', shoulders: 'Плечи', biceps: 'Бицепс', triceps: 'Трицепс',
  legs: 'Ноги', forearms: 'Предплечья', finisher: 'Добивка', other: 'Другое',
};

const renumber = (template, slots) => ({ ...template, slots: slots.map((s, order) => ({ ...s, order })) });

// A new slot goes to the end of its group; a new group goes before the finisher.
export function addSlot(template, section, exerciseId, slotId) {
  const slots = [...template.slots];
  let at = slots.findLastIndex((s) => s.section === section) + 1;
  if (!at) {
    const finisher = slots.findIndex((s) => s.section === 'finisher');
    at = section !== 'finisher' && finisher >= 0 ? finisher : slots.length;
  }
  slots.splice(at, 0, { id: slotId, order: 0, section, options: [exerciseId],
    lastChosenId: null, plannedSets: 3, repsOverride: null });
  return renumber(template, slots);
}

export const addOption = (template, slotId, exerciseId) => renumber(template, template.slots.map((s) =>
  s.id === slotId && !s.options.includes(exerciseId) ? { ...s, options: [...s.options, exerciseId] } : s));

export const updateSlot = (template, slotId, changes) => renumber(template,
  template.slots.map((s) => (s.id === slotId ? { ...s, ...changes } : s)));

// Removing the last option removes the slot.
export function removeOption(template, slotId, exerciseId) {
  return renumber(template, template.slots
    .map((s) => (s.id === slotId ? { ...s, options: s.options.filter((id) => id !== exerciseId) } : s))
    .filter((s) => s.options.length));
}

export const removeSlot = (template, slotId) =>
  renumber(template, template.slots.filter((s) => s.id !== slotId));

// Slots move only inside their muscle group, so group headers never split.
export function moveSlot(template, slotId, direction) {
  const slots = [...template.slots];
  const from = slots.findIndex((s) => s.id === slotId);
  const to = from + direction;
  if (slots[to]?.section !== slots[from].section) return template;
  [slots[from], slots[to]] = [slots[to], slots[from]];
  return renumber(template, slots);
}
