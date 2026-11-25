// Pure rotation logic: which workout comes next.
// settings.weekSlots is the week order; each kind (upper/lower) has its own pointer.

export const POINTER = { upper: 'nextUpperIndex', lower: 'nextLowerIndex' };

export const templatesOfKind = (templates, kind) =>
  templates.filter((t) => t.kind === kind).sort((a, b) => a.rotationIndex - b.rotationIndex);

export function nextWorkout(settings, templates) {
  const kind = settings.weekSlots[settings.nextSlotIndex % settings.weekSlots.length];
  const list = templatesOfKind(templates, kind);
  return list[settings[POINTER[kind]] % list.length];
}

// The week moves one slot on; only the pointer of the finished kind moves,
// to the variant after the one actually done (which may be a manual pick).
export function advance(settings, templates, done) {
  const list = templatesOfKind(templates, done.kind);
  const position = list.findIndex((t) => t.id === done.id);
  return {
    ...settings,
    nextSlotIndex: (settings.nextSlotIndex + 1) % settings.weekSlots.length,
    [POINTER[done.kind]]: (position + 1) % list.length,
  };
}

// The exercise selected in a slot: today's choice, else last time's, else the main one.
export function chosenOption(slot, session) {
  return [session?.chosen?.[slot.id], slot.lastChosenId]
    .find((id) => slot.options.includes(id)) ?? slot.options[0];
}

// session.done is { slotId: exerciseId }, so an exercise listed twice is marked per slot.
export function progress(template, session) {
  return {
    done: template.slots.filter((s) => session?.done?.[s.id]).length,
    total: template.slots.length,
  };
}

// Everything that changes when a workout is finished.
export function finishSession(settings, templates, session, now) {
  const template = templates.find((t) => t.id === session.templateId);
  const slots = template.slots.map((slot) => ({
    ...slot,
    lastChosenId: session.done[slot.id] ?? session.chosen[slot.id] ?? slot.lastChosenId,
  }));
  const ids = template.slots.map((s) => session.done[s.id]).filter(Boolean);
  return {
    settings: advance(settings, templates, template),
    template: { ...template, slots },
    session: { ...session, finishedAt: now, doneExerciseIds: [...new Set(ids)] },
  };
}
