// The owner's program (SPEC.md section 11), written to the DB on first launch only.

const MODE = { t: 'total', h: 'perHand', p: 'platesOnly', e: 'extra' };

// key: [Russian name, English name, muscle group, icon, mode, working weight (null = full stack), extras]
const EXERCISES = {
  inclPlate: ['Жим в наклоне в тренажёре без тросов', 'incline press machine', 'chest', 'inclPlate', 'p', 85],
  inclBar: ['Жим штанги в наклоне', 'incline bench press', 'chest', 'inclBar45', 't', 82],
  inclSmith: ['Жим в наклоне в Смите', 'incline Smith press', 'chest', 'inclSmith45', 'p', 60],
  pushdown: ['Разгибания на верхнем блоке', 'triceps pushdown', 'triceps', 'pushdown', 't', 85],
  oneArmExt: ['Разгибание одной рукой на блоке', 'one-hand cable extension', 'triceps', 'oneArmExt', 't', 20],
  row: ['Тяга штанги в наклоне', 'barbell row', 'back', 'row', 't', 85],
  pullup: ['Подтягивания с весом', 'weighted pull-ups', 'back', 'pullup', 'e', 27.5],
  cableCurl: ['Сгибания одной рукой на блоке', 'one-arm cable curl', 'biceps', 'cableCurl1', 't', 38],
  inclCurl: ['Сгибания на наклонной скамье', 'incline dumbbell curl', 'biceps', 'inclDbCurl45', 'h', 16],
  cableLat: ['Махи в сторону одной рукой на блоке', 'cable lateral raise', 'shoulders', 'cableLat', 't', 20],
  supCurl: ['Сгибания стоя с супинацией', 'standing dumbbell curl with supination', 'finisher', 'dbCurlSup', 'h', 18],
  smithSquat: ['Присед в Смите', 'Smith squat', 'legs', 'smithSquat', 'p', 155, { tracksOneRepMax: true }],
  hack: ['Гакк-присед', 'hack squat', 'legs', 'hack', 'p', 130],
  legPress: ['Жим ногами', 'leg press', 'legs', 'legPress', 'p', 220],
  calf: ['Подъём на носки стоя в Смите', 'standing calf raise', 'legs', 'calf', 'p', 150],
  rdl: ['Румынская тяга со штангой', 'romanian deadlift', 'legs', 'rdl', 't', 100],
  rdlSeated: ['Румынская тяга сидя на блоке', 'seated cable RDL', 'legs', 'rdlSeated', 't', null],
  legCurl: ['Сгибания ног лёжа', 'lying hamstring curl', 'legs', 'legCurl', 't', 54],
  wristCurl: ['Сгибания кистей с гантелью', 'dumbbell wrist curl', 'forearms', 'wristCurl', 'h', 22.5],
  wristExt: ['Разгибания кистей с гантелью', 'dumbbell wrist extension', 'forearms', 'wristExt', 'h', 8],
  bench: ['Жим штанги лёжа', 'bench press', 'chest', 'bench', 't', 88, { tracksOneRepMax: true }],
  inclCable: ['Жим в наклоне в тренажёре с тросами', 'incline press machine (cables), «стрефа» zone', 'chest', 'inclCable', 't', 66],
  chestRow: ['Тяга с упором грудью', 'chest supported row', 'back', 'chestRow', 'p', 142],
  preacher: ['Сгибания одной рукой на скамье Скотта', 'one-arm preacher curl', 'biceps', 'preacher', 'h', 17.5],
  overhead: ['Разгибания из-за головы в кроссовере', 'cable overhead extension', 'triceps', 'overhead', 't', 80],
  latCable: ['Махи сидя в тренажёре с тросами', 'seated lateral raise (cables), «стрефа»', 'shoulders', 'latCable', 't', 50],
  latMachine: ['Махи сидя в тренажёре без тросов', 'seated lateral raise machine', 'shoulders', 'latMachine', 't', 50],
  crossover: ['Сведение рук в кроссовере', 'cable crossover', 'chest', 'crossover', 't', 34],
  inclDb: ['Жим гантелей в наклоне', 'incline dumbbell press', 'chest', 'inclDb45', 'h', 38],
  seatedOverhead: ['Разгибания из-за головы сидя на блоке', 'seated overhead cable extension (45° bench)', 'triceps', 'seatedOverhead', 't', 75],
  isoPulldown: ['Тяга сверху одной рукой', 'iso-lateral pulldown', 'back', 'isoPulldown', 'p', 60],
  tbar: ['Тяга Т-грифа', 'T-bar row', 'back', 'tbar', 'p', 71.25, { weightStep: 0.25 }],
  shoulderPress: ['Жим плеч в тренажёре с тросами', 'shoulder press machine, «стрефа»', 'shoulders', 'shoulderPress2', 't', 61],
};

// [section, option, «ИЛИ» option...]; section null = the flat lower-day list.
const WORKOUTS = [
  ['upper', 'A', 'Вт', [
    ['chest', 'inclPlate'], ['chest', 'inclBar', 'inclSmith'],
    ['triceps', 'pushdown'], ['triceps', 'oneArmExt'],
    ['back', 'row'], ['back', 'pullup'],
    ['biceps', 'cableCurl', 'inclCurl'], ['shoulders', 'cableLat'], ['finisher', 'supCurl']]],
  ['lower', '', 'Чт', [
    [null, 'smithSquat'], [null, 'hack'], [null, 'legPress'], [null, 'calf'],
    [null, 'rdl', 'rdlSeated'], [null, 'legCurl'], [null, 'wristCurl'], [null, 'wristExt']]],
  ['upper', 'B', 'Сб', [
    ['chest', 'bench'], ['chest', 'inclCable'], ['back', 'chestRow'], ['back', 'pullup'],
    ['biceps', 'preacher'], ['triceps', 'overhead'], ['triceps', 'oneArmExt'],
    ['shoulders', 'latCable', 'latMachine'], ['finisher', 'supCurl']]],
  ['upper', 'C', null, [
    ['chest', 'crossover'], ['chest', 'inclDb'], ['triceps', 'oneArmExt'], ['triceps', 'seatedOverhead'],
    ['back', 'isoPulldown'], ['back', 'tbar'], ['biceps', 'supCurl'],
    ['shoulders', 'shoulderPress'], ['finisher', 'supCurl']]],
];

export function buildSeed(now, newId) {
  const ids = {};
  const exercises = Object.entries(EXERCISES).map(
    ([key, [name, englishName, muscleGroup, iconName, mode, weight, extras]]) => ({
      id: (ids[key] = newId()),
      name, englishName, muscleGroup, iconName,
      weightMode: MODE[mode],
      weightStep: 0.5,
      workingWeightKg: weight,
      isFullStackDefault: weight == null,
      tracksOneRepMax: false,
      notes: [],
      createdAt: now,
      ...extras,
    }));
  const counts = { upper: 0, lower: 0 };
  const templates = WORKOUTS.map(([kind, label, dayHint, slots]) => ({
    id: newId(), kind, label, dayHint,
    title: kind === 'upper' ? `Верх ${label}` : 'Низ',
    rotationIndex: counts[kind]++,
    slots: slots.map(([section, ...keys], order) => ({
      id: newId(), order, section,
      options: keys.map((k) => ids[k]),
      lastChosenId: null, plannedSets: 3, repsOverride: null,
    })),
  }));
  // Owner's answers: next is Низ, then Верх B; phase is 8 reps.
  const settings = {
    id: 'app',
    weekSlots: ['upper', 'lower', 'upper'],
    nextSlotIndex: 1, nextUpperIndex: 1, nextLowerIndex: 0,
    currentPhaseReps: 8, phaseStartDate: now,
    installedAt: now, lastBackupAt: null, seeded: true,
  };
  return { exercises, templates, logs: [], sessions: [], bodyWeight: [], settings: [settings] };
}
