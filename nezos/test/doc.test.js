import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SceneDoc, normalizeScene } from '../public/js/studio/doc.js';

test('normalizeScene fixes ids, names and vectors', () => {
  const s = normalizeScene({ objects: [{ name: 'A', type: 'weird', position: 'x' }, { name: 'A' }] });
  assert.equal(s.objects[0].type, 'box');
  assert.deepEqual(s.objects[0].position, [0, 0, 0]);
  assert.equal(s.objects[1].name, 'A 2');
  assert.notEqual(s.objects[0].id, s.objects[1].id);
});

test('applyOps applies AI operations as one undo step', () => {
  const doc = new SceneDoc({ objects: [{ name: 'Player', type: 'capsule', physics: { body: 'dynamic' } }] });
  const summary = doc.applyOps([
    { op: 'add', object: { name: 'Coin', type: 'torus', tags: 'coin, shiny' } },
    { op: 'update', name: 'player', set: { color: '#ff0000', physics: { bounce: 0.5 } } },
    { op: 'settings', set: { gravity: 9, camera: { mode: 'follow' } } },
    { op: 'script', code: 'game.log(1)' },
    { op: 'remove', name: 'Nothing' },
    { op: 'explode' },
  ]);
  assert.deepEqual(summary.added, ['Coin']);
  assert.deepEqual(summary.updated, ['Player']);
  assert.equal(summary.errors.length, 1);
  const player = doc.byName('Player');
  assert.equal(player.color, '#ff0000');
  assert.deepEqual(player.physics, { body: 'dynamic', bounce: 0.5 });
  assert.deepEqual(doc.byName('Coin').tags, ['coin', 'shiny']);
  assert.equal(doc.scene.settings.gravity, 9);
  assert.equal(doc.scene.script, 'game.log(1)');
  doc.undo();
  assert.equal(doc.scene.objects.length, 1);
  assert.equal(doc.scene.script, '');
  doc.redo();
  assert.equal(doc.scene.objects.length, 2);
});

test('replaceScene swaps the whole game', () => {
  const doc = new SceneDoc({ objects: [{ name: 'Old' }] });
  doc.applyOps([{ op: 'replaceScene', scene: { settings: { background: '#000000' }, objects: [{ name: 'New' }, { name: 'New' }], script: 'x' } }]);
  assert.deepEqual(doc.scene.objects.map((o) => o.name), ['New', 'New 2']);
  assert.equal(doc.scene.settings.background, '#000000');
});
