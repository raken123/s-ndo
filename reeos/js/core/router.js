/** Appregister och vy-växling. En app åt gången — delad skärm hör inte hemma
 *  i en bil i rörelse. */
import { emit } from './bus.js';
import { $ } from './ui.js';

const apps = new Map();
let current = null;
let currentTeardown = null;
const history = [];

export function register(app) {
  apps.set(app.id, app);
}

export const getApp = (id) => apps.get(id);
export const allApps = () => [...apps.values()];
export const currentApp = () => current;

/** Öppna en app. `params` skickas vidare till dess mount(). */
export function open(id, params = {}) {
  const app = apps.get(id);
  if (!app) { console.warn(`[router] okänd app: ${id}`); return; }

  if (current) {
    try { currentTeardown?.(); } catch (err) { console.error('[router] teardown', err); }
    if (current.id !== id) history.push(current.id);
    if (history.length > 12) history.shift();
  }

  const viewport = $('#viewport');
  const screen = document.createElement('section');
  screen.className = `screen${app.flush ? ' flush' : ''}`;
  screen.dataset.app = id;
  viewport.replaceChildren(screen);
  viewport.scrollTop = 0;

  current = app;
  currentTeardown = null;
  try {
    currentTeardown = app.mount(screen, params) ?? null;
  } catch (err) {
    console.error(`[router] ${id} kraschade`, err);
    screen.innerHTML = `<div class="empty"><b>${app.name} kunde inte öppnas</b><span class="hint">${err.message}</span></div>`;
  }

  location.hash = id === 'home' ? '' : `#${id}`;
  emit('router:changed', { id, app, params });
}

export function back() {
  const previous = history.pop();
  open(previous ?? 'home');
  // open() la tillbaka den vi lämnade; ta bort så bakåt inte pendlar.
  history.pop();
}

export const canGoBack = () => history.length > 0;

export function startRouter(defaultId = 'home') {
  const fromHash = location.hash.replace('#', '');
  open(apps.has(fromHash) ? fromHash : defaultId);

  window.addEventListener('hashchange', () => {
    const id = location.hash.replace('#', '') || 'home';
    if (apps.has(id) && current?.id !== id) open(id);
  });
}
