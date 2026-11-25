import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextWorkout, advance, chosenOption, progress, finishSession } from '../js/logic/rotation.js';
import { parseWeight, stepWeight, weightText, lastResult, oneRepMax, recordBeaten, applyEntry } from '../js/logic/weights.js';
import { makeBackup, parseBackup, backupAgeDays, backupFileName } from '../js/logic/backup.js';
import { addSlot, addOption, removeOption, moveSlot } from '../js/logic/program.js';
import { buildSeed } from '../js/seed.js';

const NOW = '2026-11-25T10:00:00.000Z';
let n = 0;
const seed = () => buildSeed(NOW, () => `id${++n}`);

test('rotation follows the owner order: Низ, B, C, Низ, A', () => {
  const { templates, settings: [first] } = seed();
  let settings = first;
  const titles = [];
  for (let i = 0; i < 7; i++) {
    const workout = nextWorkout(settings, templates);
    titles.push(workout.title);
    settings = advance(settings, templates, workout);
  }
  assert.deepEqual(titles, ['Низ', 'Верх B', 'Верх C', 'Низ', 'Верх A', 'Верх B', 'Низ']);
});

test('a manual pick moves only the pointer of its own kind', () => {
  const { templates, settings: [settings] } = seed();
  const after = advance(settings, templates, templates.find((t) => t.title === 'Верх C'));
  assert.equal(after.nextUpperIndex, 0);
  assert.equal(after.nextLowerIndex, 0);
  assert.equal(after.nextSlotIndex, 2);
});

test('choice, progress and finishing a session', () => {
  const { templates, settings: [settings] } = seed();
  const lower = templates.find((t) => t.kind === 'lower');
  const rdl = lower.slots[4];
  assert.equal(chosenOption(rdl, null), rdl.options[0]);
  const session = { id: 's', templateId: lower.id, chosen: { [rdl.id]: rdl.options[1] },
    done: { [lower.slots[0].id]: lower.slots[0].options[0] }, finishedAt: null };
  assert.deepEqual(progress(lower, session), { done: 1, total: 8 });
  const result = finishSession(settings, templates, session, NOW);
  assert.equal(chosenOption(result.template.slots[4], null), rdl.options[1]);
  assert.deepEqual(result.session.doneExerciseIds, lower.slots[0].options);
  assert.equal(result.session.finishedAt, NOW);
  assert.equal(result.settings.nextSlotIndex, 2);
});

test('weight input and steps', () => {
  assert.equal(parseWeight('71,25'), 71.25);
  assert.equal(parseWeight(' 62.6 '), 62.5);
  assert.equal(parseWeight('+27.5'), 27.5);
  for (const bad of ['', 'abc', '-5', '1e3', '1.2.3', '99999']) assert.equal(parseWeight(bad), null, bad);
  assert.equal(stepWeight(71.25, 0.25), 71.5);
  assert.equal(stepWeight(1, -2.5), 0);
  assert.equal(weightText(27.5, false, 'extra'), '+27.5 кг');
  assert.equal(weightText(null, true, 'total'), 'ФУЛЛ БЛОК');
});

const log = (date, weightKg, extra = {}) =>
  ({ id: date + weightKg, exerciseId: 'x', date, weightKg, cyclePhaseReps: 8, isOneRepMax: false, ...extra });

test('last result skips 1RM and respects the phase', () => {
  const logs = [log('2026-01-01', 60), log('2026-02-01', 70, { cyclePhaseReps: 6 }),
    log('2026-03-01', 100, { isOneRepMax: true })];
  assert.equal(lastResult(logs, 'x').weightKg, 70);
  assert.equal(lastResult(logs, 'x', 8).weightKg, 60);
  assert.equal(lastResult(logs, 'other'), null);
});

test('1RM counts only 1RM entries and reports only a beaten record', () => {
  const logs = [log('2026-01-01', 200), log('2026-02-01', 120, { isOneRepMax: true })];
  assert.equal(oneRepMax(logs, 'x').weightKg, 120);
  assert.deepEqual(recordBeaten(logs, 'x', 122.5), { weightKg: 122.5, diff: 2.5 });
  assert.equal(recordBeaten(logs, 'x', 120), null);
  assert.equal(recordBeaten([], 'x', 100), null);
});

test('working weight follows the saved entry', () => {
  const exercise = { weightMode: 'total', workingWeightKg: 60, isFullStackDefault: false };
  assert.equal(applyEntry(exercise, { weightKg: 62.5, isFullStack: false }).workingWeightKg, 62.5);
  const full = applyEntry(exercise, { weightKg: null, isFullStack: true });
  assert.deepEqual([full.workingWeightKg, full.isFullStackDefault], [60, true]);
  const none = { weightMode: 'none', workingWeightKg: null };
  assert.equal(applyEntry(none, { weightKg: null, isFullStack: false }), none);
});

test('seed matches the program', () => {
  const { exercises, templates } = seed();
  assert.equal(exercises.length, 33);
  assert.deepEqual(templates.map((t) => t.slots.length), [9, 8, 9, 9]);
  assert.deepEqual(exercises.filter((e) => e.tracksOneRepMax).map((e) => e.englishName),
    ['Smith squat', 'bench press']);
});

test('backup round-trip keeps every record', () => {
  const data = seed();
  data.logs.push(log('2026-01-01', 60, { exerciseId: data.exercises[0].id }));
  assert.deepEqual(parseBackup(makeBackup(data, NOW)), data);
});

test('broken backups are rejected before anything is replaced', () => {
  const broken = (change) => { const data = seed(); change(data); return makeBackup(data, NOW); };
  assert.throws(() => parseBackup('not json'));
  assert.throws(() => parseBackup('{"app":"other"}'));
  assert.throws(() => parseBackup(broken((d) => delete d.logs)));
  assert.throws(() => parseBackup(broken((d) => d.settings.pop())));
  assert.throws(() => parseBackup(broken((d) => d.exercises.shift())));
  assert.throws(() => parseBackup(broken((d) => d.exercises.push(d.exercises[0]))));
});

test('backup age and file name', () => {
  assert.equal(backupAgeDays({ lastBackupAt: null, installedAt: '2026-11-10T10:00:00.000Z' }, NOW), 15);
  assert.equal(backupAgeDays({ lastBackupAt: NOW, installedAt: '2020-01-01' }, NOW), 0);
  assert.equal(backupFileName(new Date(2026, 0, 5)), 'severe-backup-2026-01-05.json');
});

test('program edits keep muscle groups together', () => {
  const a = seed().templates.find((t) => t.title === 'Верх A');
  const sections = (t) => t.slots.map((s) => s.section);
  const added = addSlot(a, 'chest', 'new', 'slot');
  assert.equal(added.slots[2].id, 'slot');
  assert.deepEqual(added.slots.map((s) => s.order), added.slots.map((_, i) => i));
  assert.deepEqual(sections(addSlot(a, 'legs', 'new', 'slot')).slice(-2), ['legs', 'finisher']);
  assert.equal(moveSlot(a, a.slots[1].id, 1), a); // would leave the chest group
  assert.equal(moveSlot(a, a.slots[1].id, -1).slots[0].id, a.slots[1].id);
  const two = addOption(a, a.slots[0].id, 'alt');
  assert.equal(two.slots[0].options[1], 'alt');
  assert.equal(removeOption(two, a.slots[0].id, 'alt').slots.length, a.slots.length);
  assert.equal(removeOption(a, a.slots[0].id, a.slots[0].options[0]).slots.length, a.slots.length - 1);
});
