// Notification service: delivery, grouping, badges and actions.
import { Emitter } from '../core/dom.js';
import { storage, settings } from '../core/store.js';

class NotificationService extends Emitter {
  constructor() {
    super();
    this.items = storage.get('rakenos.notifications') || [];
    this.seq = this.items.reduce((m, n) => Math.max(m, n.id), 0);
  }
  save() { storage.set('rakenos.notifications', this.items.slice(0, 80)); }

  /*
   * n: { appId, appName, title, body, icon, color, priority: 'time-sensitive'|'standard'|'quiet',
   *      actions: [{ label, id }], onAction(id), open: { appId, route } }
   */
  post(n) {
    if ((settings.get('notificationsMuted') || []).includes(n.appId)) return null;
    const item = {
      id: ++this.seq, time: Date.now(), priority: 'standard', read: false, ...n,
    };
    const handler = n.onAction; delete item.onAction;
    this.items.unshift(item);
    if (handler) (this.handlers ||= new Map()).set(item.id, handler);
    this.save();
    const silent = item.priority === 'quiet' || (settings.get('dnd') && item.priority !== 'time-sensitive');
    this.emit('post', item, { silent });
    this.emit('change');
    return item.id;
  }

  action(id, actionId) {
    const h = this.handlers && this.handlers.get(id);
    if (h) h(actionId);
    this.emit('action', this.items.find((n) => n.id === id), actionId);
  }

  dismiss(id) { this.items = this.items.filter((n) => n.id !== id); this.save(); this.emit('change'); }
  dismissApp(appId) { this.items = this.items.filter((n) => n.appId !== appId); this.save(); this.emit('change'); }
  clear() { this.items = []; this.save(); this.emit('change'); }
  markRead(appId) { let c = false; for (const n of this.items) if ((!appId || n.appId === appId) && !n.read) { n.read = true; c = true; } if (c) { this.save(); this.emit('change'); } }
  unread(appId) { return this.items.filter((n) => !n.read && (!appId || n.appId === appId)).length; }

  groups() {
    const map = new Map();
    for (const n of this.items) {
      if (!map.has(n.appId)) map.set(n.appId, { appId: n.appId, appName: n.appName, icon: n.icon, color: n.color, items: [] });
      map.get(n.appId).items.push(n);
    }
    return [...map.values()];
  }
}

export const notifications = new NotificationService();
