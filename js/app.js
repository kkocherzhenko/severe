// Bootstrap, hash router, tab bar and service worker updates.
import { readAll, replaceAll } from './db.js';
import { buildSeed } from './seed.js';
import { h, button, loadIcons, closeSheets, toast } from './ui.js';
import { todayScreen } from './screens/today.js';
import { exercisesScreen } from './screens/exercises.js';
import { exerciseScreen } from './screens/exercise.js';
import { moreScreen } from './screens/more.js';
import { programScreen } from './screens/program.js';

// route: [screen, tab it belongs to]
const ROUTES = {
  today: [todayScreen, 'today'],
  exercises: [exercisesScreen, 'exercises'],
  exercise: [exerciseScreen, 'exercises'],
  more: [moreScreen, 'more'],
  program: [programScreen, 'more'],
};

let latest = 0;

async function render() {
  const ticket = ++latest;
  const [, name, id] = location.hash.split('/');
  const [screen, tab] = ROUTES[name] ?? ROUTES.today;
  const stored = await readAll();
  if (ticket !== latest) return; // a newer render has started
  const data = { ...stored, settings: stored.settings.find((s) => s.id === 'app') };
  data.templates.sort((a, b) => (a.kind === b.kind ? a.rotationIndex - b.rotationIndex : a.kind === 'upper' ? -1 : 1));
  const nodes = screen(data, render, id).flat(Infinity).filter(Boolean);
  document.getElementById('screen').replaceChildren(...nodes);
  for (const link of document.querySelectorAll('nav a')) {
    if (link.dataset.tab === tab) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
}

async function registerWorker() {
  if (!('serviceWorker' in navigator)) return;
  let accepted = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => accepted && location.reload());
  const registration = await navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' });
  const offer = () => {
    // No controller means this is the very first install, not an update.
    if (!registration.waiting || !navigator.serviceWorker.controller || document.querySelector('.update')) return;
    document.body.append(h('div', { class: 'update' }, 'Доступно обновление',
      button('ОБНОВИТЬ', () => {
        accepted = true;
        registration.waiting?.postMessage('skipWaiting');
      }, 'btn primary small')));
  };
  const watch = () => registration.installing?.addEventListener('statechange', offer);
  registration.addEventListener('updatefound', watch);
  watch();
  offer();
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) registration.update().catch(() => {}); // offline is fine
  });
}

async function start() {
  addEventListener('unhandledrejection', (e) => {
    console.error(e.reason);
    toast(`Ошибка: ${e.reason?.message ?? e.reason}`);
  });
  const [stored] = await Promise.all([readAll(), loadIcons()]);
  if (!stored.settings.length) {
    await replaceAll(buildSeed(new Date().toISOString(), () => crypto.randomUUID()));
  }
  navigator.storage?.persist?.().catch(() => {});
  addEventListener('hashchange', () => { closeSheets(); scrollTo(0, 0); render(); });
  await render();
}

start().catch((error) => {
  console.error(error);
  document.getElementById('screen').textContent = `Не удалось запустить: ${error.message}`;
});
registerWorker().catch((error) => console.error(error));
