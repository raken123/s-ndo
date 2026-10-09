// Starter scenes for new projects.
const sun = { name: 'Sun', type: 'light', position: [12, 20, 8], light: { kind: 'directional', intensity: 1.2 } };

export const TEMPLATES = {
  empty: {
    name: 'Empty world',
    scene: {
      settings: { background: '#8ec5ff', fog: null, ambient: 0.6, gravity: 20, camera: { mode: 'orbit', position: [10, 9, 14] } },
      objects: [
        sun,
        { name: 'Ground', type: 'plane', position: [0, 0, 0], scale: [40, 1, 40], color: '#6dbb63', physics: { body: 'static' } },
      ],
      script: '',
    },
  },

  platformer: {
    name: 'Platformer starter',
    scene: {
      settings: { background: '#9fd3ff', fog: { color: '#9fd3ff', near: 30, far: 120 }, ambient: 0.6, gravity: 22, camera: { mode: 'follow', target: 'Player' } },
      objects: [
        sun,
        { name: 'Ground', type: 'box', position: [0, -0.5, 0], scale: [24, 1, 24], color: '#7cc56a', physics: { body: 'static' } },
        {
          name: 'Player', type: 'model', position: [0, 1.5, 6], physics: { body: 'dynamic' }, tags: ['player'],
          parts: [
            { type: 'capsule', position: [0, 0, 0], scale: [0.8, 0.6, 0.8], color: '#7c5cff' },
            { type: 'sphere', position: [0.18, 0.35, 0.33], scale: [0.18, 0.18, 0.18], color: '#ffffff' },
            { type: 'sphere', position: [-0.18, 0.35, 0.33], scale: [0.18, 0.18, 0.18], color: '#ffffff' },
            { type: 'sphere', position: [0.18, 0.35, 0.41], scale: [0.08, 0.08, 0.08], color: '#1b1b2f' },
            { type: 'sphere', position: [-0.18, 0.35, 0.41], scale: [0.08, 0.08, 0.08], color: '#1b1b2f' },
          ],
        },
        { name: 'Platform 1', type: 'box', position: [4, 1, 0], scale: [3, 0.5, 3], color: '#f4b860', physics: { body: 'static' } },
        { name: 'Platform 2', type: 'box', position: [0, 2.2, -5], scale: [3, 0.5, 3], color: '#f4b860', physics: { body: 'static' } },
        { name: 'Platform 3', type: 'box', position: [-5, 3.4, -2], scale: [3, 0.5, 3], color: '#f4b860', physics: { body: 'static' } },
        { name: 'Coin 1', type: 'torus', position: [4, 2.2, 0], rotation: [0, 0, 0], color: '#ffd34d', emissive: '#7a5a00', metalness: 0.6, roughness: 0.3, tags: ['coin'] },
        { name: 'Coin 2', type: 'torus', position: [0, 3.4, -5], color: '#ffd34d', emissive: '#7a5a00', metalness: 0.6, roughness: 0.3, tags: ['coin'] },
        { name: 'Coin 3', type: 'torus', position: [-5, 4.6, -2], color: '#ffd34d', emissive: '#7a5a00', metalness: 0.6, roughness: 0.3, tags: ['coin'] },
      ],
      script: `// Collect every coin to win.
const player = game.controls.platformer('Player', { speed: 6, jump: 10 });
const coins = game.findAll('coin');
game.state.score = 0;
game.ui.set('score', 'Coins: 0 / ' + coins.length);
game.ui.set('help', 'WASD to move · Space to jump · drag to look', { at: 'bottom', size: 14 });

game.onUpdate((dt) => {
  for (const c of game.findAll('coin')) c.rotation.y += dt * 3;
  if (player.position.y < -20) game.lose('You fell!');
});

player.onCollide((other) => {
  if (!other.hasTag('coin')) return;
  game.burst(other, { color: '#ffd34d' });
  game.sound.sfx('coin');
  other.destroy();
  game.state.score++;
  game.ui.set('score', 'Coins: ' + game.state.score + ' / ' + coins.length);
  if (game.state.score === coins.length) game.win('All coins collected!');
});`,
    },
  },
};

export function templateScene(id) {
  const t = TEMPLATES[id] || TEMPLATES.empty;
  return structuredClone(t.scene);
}
