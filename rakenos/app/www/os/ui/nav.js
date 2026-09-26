/*
 * Navigation stack for multi-page apps (Settings, Store, Files …).
 * Pages slide in from the right and support the system back gesture.
 */
import { h, ic, trackScroll, nextFrame, wait } from '../core/dom.js';

export class NavStack {
  constructor(host) {
    this.container = h('div', { class: 'nav-stack' });
    host.appendChild(this.container);
    this.pages = [];
  }

  get depth() { return this.pages.length; }
  get top() { return this.pages[this.pages.length - 1]; }

  /*
   * page: { title, large (bool), build(page) → node, trailing: node, onShow, onHide, back: label }
   */
  async push(def, { animate = true } = {}) {
    const prev = this.top;
    const scroller = h('div', { class: 'page__scroll' });
    const backLabel = def.back || (prev && prev.def.title) || '';
    const bar = h('header', { class: `r-navbar ${def.large === false ? 'r-navbar--inline' : ''}` },
      h('div', { class: 'r-navbar__leading' }, prev ? h('button', { class: 'r-back', onclick: () => this.pop(), 'aria-label': `Back to ${backLabel}` }, ic('chevron-left'), h('span', { class: 'r-back__label' }, backLabel.length > 14 ? 'Back' : backLabel)) : (def.leading || null)),
      h('div', { class: 'r-navbar__title' }, def.title || ''),
      h('div', { class: 'r-navbar__trailing' }, def.trailing || null));
    const el = h('section', { class: 'page', 'aria-label': def.title || 'Page' }, bar, scroller);
    const page = { def, el, scroller, bar, nav: this, setTitle: (t) => { def.title = t; bar.querySelector('.r-navbar__title').textContent = t; const lt = scroller.querySelector(':scope > .r-large-title'); if (lt) lt.textContent = t; }, refresh: () => this.refresh(page) };
    if (def.large !== false && def.title) scroller.appendChild(h('h1', { class: 'r-large-title' }, def.title));
    const body = def.build(page);
    if (body) scroller.appendChild(body);
    trackScroll(scroller, bar);
    this.pages.push(page);
    this.container.appendChild(el);
    if (prev && animate) {
      el.classList.add('page--enter');
      await nextFrame();
      el.classList.remove('page--enter');
      prev.el.classList.add('page--behind');
      await wait(380);
    } else if (prev) prev.el.classList.add('page--behind');
    if (prev) { prev.el.hidden = true; prev.def.onHide && prev.def.onHide(prev); }
    def.onShow && def.onShow(page);
    return page;
  }

  refresh(page = this.top) {
    const keepScroll = page.scroller.scrollTop;
    const lt = page.scroller.querySelector(':scope > .r-large-title');
    page.scroller.replaceChildren(...(lt ? [lt] : []));
    const body = page.def.build(page);
    if (body) page.scroller.appendChild(body);
    page.scroller.scrollTop = keepScroll;
  }

  async pop() {
    if (this.pages.length < 2) return false;
    const page = this.pages.pop();
    const prev = this.top;
    prev.el.hidden = false;
    await nextFrame();
    prev.el.classList.remove('page--behind');
    page.el.classList.add('page--leave');
    page.def.onHide && page.def.onHide(page);
    page.def.onDestroy && page.def.onDestroy(page);
    prev.def.onShow && prev.def.onShow(prev);
    await wait(340);
    page.el.remove();
    return true;
  }

  async popToRoot() { while (this.pages.length > 1) await this.pop(); }

  destroy() { for (const p of this.pages) { p.def.onDestroy && p.def.onDestroy(p); } this.pages = []; this.container.replaceChildren(); }
}
