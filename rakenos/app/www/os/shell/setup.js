// First-run Setup.
import { h, ic, wait } from '../core/dom.js';
import { settings } from '../core/store.js';
import { security } from '../services/security.js';
import { updates } from '../services/updates.js';
import { rakenMark } from './logo.js';
import { pinPad } from './pinpad.js';
import { wallpaperUrl } from './theme.js';
import { switchRow } from '../ui/components.js';

export function runSetup(layer) {
  return new Promise((resolve) => {
    const el = h('div', { class: 'setup', role: 'dialog', 'aria-label': 'Setup' });
    const stage = h('div', { class: 'setup__stage' });
    const footer = h('div', { class: 'setup__footer' });
    const dots = h('div', { class: 'setup__dots', 'aria-hidden': 'true' });
    el.append(stage, h('div', { class: 'setup__bottom' }, dots, footer));
    layer.appendChild(el);

    const steps = ['welcome', 'appearance', 'lock', 'updates', 'privacy', 'done'];
    let i = 0;

    const show = async (dir = 1) => {
      const name = steps[i];
      dots.replaceChildren(...steps.map((_, k) => h('span', { class: k === i ? 'is-active' : '' })));
      const next = h('div', { class: `setup__page setup__page--${name}` });
      footer.replaceChildren();
      build[name](next);
      const old = stage.firstChild;
      if (old) { old.classList.add(dir > 0 ? 'is-leaving' : 'is-leaving-back'); setTimeout(() => old.remove(), 360); }
      next.classList.add(dir > 0 ? 'is-entering' : 'is-entering-back');
      stage.appendChild(next);
      requestAnimationFrame(() => requestAnimationFrame(() => next.classList.remove('is-entering', 'is-entering-back')));
    };
    const go = (d) => { i = Math.max(0, Math.min(steps.length - 1, i + d)); show(d); };
    const primary = (label, fn) => footer.appendChild(h('button', { class: 'r-btn r-btn--primary r-btn--block setup__cta', onclick: fn }, label));
    const secondary = (label, fn) => footer.appendChild(h('button', { class: 'r-btn r-btn--plain r-btn--block', onclick: fn }, label));
    const header = (iconHtml, title, text) => [h('div', { class: 'setup__icon', html: iconHtml }), h('h1', { class: 'setup__title' }, title), text ? h('p', { class: 'setup__text' }, text) : null];

    const build = {
      welcome(p) {
        p.append(h('div', { class: 'setup__hero', html: rakenMark(72) }), h('h1', { class: 'setup__title setup__title--hero' }, 'Welcome to RakenOS'), h('p', { class: 'setup__text' }, 'Let’s set up a few things. It only takes a minute.'));
        primary('Get Started', () => go(1));
      },
      appearance(p) {
        p.append(...header(ic('contrast').html, 'Choose a look', 'You can change this at any time in Display settings.'));
        const opts = [['light', 'Light'], ['dark', 'Dark'], ['auto', 'Automatic']];
        const grid = h('div', { class: 'setup__themes', role: 'radiogroup' });
        const render = () => grid.replaceChildren(...opts.map(([v, label]) => h('button', {
          type: 'button', role: 'radio', 'aria-checked': String(settings.get('theme') === v), class: 'theme-option',
          onclick: () => { settings.set({ theme: v }); render(); },
        }, h('span', { class: `theme-option__preview theme-option__preview--${v}`, style: { backgroundImage: wallpaperUrl(settings.get('wallpaper'), v === 'auto' ? 'light' : v), '--dark-wp': wallpaperUrl(settings.get('wallpaper'), 'dark') } }, h('span', { class: 'theme-option__ui' })),
        h('span', { class: 'theme-option__label' }, label),
        h('span', { class: 'theme-option__radio' }, settings.get('theme') === v ? ic('check') : null))));
        render();
        p.appendChild(grid);
        primary('Continue', () => go(1));
      },
      lock(p) {
        let first = null;
        const pad = pinPad({
          title: 'Create a PIN', subtitle: 'Your PIN unlocks this device and protects your data.', light: false,
          onComplete: async (v) => {
            if (!first) { first = v; pad.reset(); pad.setTitle('Confirm your PIN', 'Enter the same PIN again.'); return; }
            if (v !== first) { first = null; pad.reset('The PINs didn’t match. Try again.', { shake: true }); pad.setTitle('Create a PIN'); return; }
            await security.setPin(v);
            pad.setTitle('PIN created', ''); await wait(350); go(1);
          },
        });
        p.appendChild(pad.el);
        setTimeout(() => pad.focus(), 400);
        secondary('Set up later', () => { security.removePin(); go(1); });
      },
      updates(p) {
        const eng = updates.engine;
        p.append(...header(ic('update').html, 'Automatic updates', 'RakenOS keeps itself secure with updates that arrive in stages. Your device receives each version on its rollout day.'));
        p.appendChild(h('div', { class: 'r-list setup__list' },
          switchRow({ title: 'Download updates automatically', checked: eng.settings.autoDownload, onChange: (v) => eng.setSettings({ autoDownload: v }) }),
          switchRow({ title: 'Install when ready', subtitle: 'Updates install while the device is locked.', checked: eng.settings.autoInstall, onChange: (v) => eng.setSettings({ autoInstall: v }) })));
        primary('Continue', () => go(1));
      },
      privacy(p) {
        p.append(...header(ic('hand').html, 'Your data, your device', 'RakenOS processes your data on the device. Nothing about how you use it leaves the device unless you choose to share it.'));
        p.appendChild(h('div', { class: 'r-list setup__list' },
          switchRow({ title: 'Share diagnostics', subtitle: 'Helps improve RakenOS. Reports never include personal data.', checked: settings.get('diagnostics'), onChange: (v) => settings.set({ diagnostics: v }) })));
        primary('Continue', () => go(1));
      },
      done(p) {
        p.append(h('div', { class: 'setup__hero setup__hero--done', html: ic('check').html }), h('h1', { class: 'setup__title setup__title--hero' }, 'You’re all set'), h('p', { class: 'setup__text' }, `RakenOS ${updates.installed} is ready to use.`));
        primary('Start using RakenOS', async () => {
          settings.set({ setupComplete: true });
          el.classList.add('is-done');
          await wait(450); el.remove(); resolve();
        });
      },
    };
    show(1);
  });
}
