/**
 * Base class for the features that are simply a panel floating in front of you.
 * It handles placement, registration with the pointer system and teardown, so
 * each feature only has to describe what it draws.
 */

import * as THREE from 'three';
import { Panel } from './panel.js';

export class PanelFeature {
  constructor(app, { width = 0.95, height = 0.72, ppm = 1150, name = 'feature', distance = 1.28, curve = 0 } = {}) {
    this.app = app;
    this.engine = app.engine;
    this.store = app.store;
    this.distance = distance;

    this.panel = new Panel({ width, height, ppm, name, curve });
    this.panel.render = (p) => this.render(p);
    this.group = new THREE.Group();
    this.group.name = name;
    this.group.visible = false;
    this.group.add(this.panel.mesh);
    this.app.interaction.register(this.panel.mesh);
    this.engine.add(this);
  }

  /** Override. */
  render() {}

  /** Override for per-second work such as countdowns. */
  tick() {}

  show(parent) {
    (parent || this.engine.stage).add(this.group);
    this.group.visible = true;
    this.engine.placeInFront(this.group, this.distance, 0.04);
    this.panel.scroll = 0;
    this.refresh();
    this.onShow?.();
  }

  hide() {
    this.onHide?.();
    this.group.visible = false;
    this.group.parent?.remove(this.group);
  }

  refresh() { this.panel.refresh(); }

  update(dt) {
    if (!this.group.visible) return;
    this.since = (this.since || 0) + dt;
    if (this.since >= 1) {
      this.since = 0;
      this.tick();
    }
  }

  dispose() {
    this.app.interaction.unregister(this.panel.mesh);
    this.panel.dispose();
    this.engine.remove(this);
  }
}
