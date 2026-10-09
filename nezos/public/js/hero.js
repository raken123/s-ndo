// Small animated scene for the landing page mock-up, built with the real engine.
import { THREE, buildObject, applySettings, defaultLights, addDefaultSun } from './engine/engine.js';

export function hero(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  applySettings(scene, { background: '#151a33', fog: { color: '#151a33', near: 14, far: 40 } });
  defaultLights(scene, { ambient: 0.7 });
  addDefaultSun(scene);
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(9, 7, 11);
  camera.lookAt(0, 1, 0);

  const islands = [[0, 0, 0, 5], [5.5, 1.2, -3, 3], [-5, 2, -4, 3.2]];
  for (const [x, y, z, s] of islands) {
    scene.add(buildObject({ type: 'cylinder', position: [x, y - 0.4, z], scale: [s, 0.8, s], color: '#6fcf6a' }));
    scene.add(buildObject({ type: 'cone', position: [x, y - 1.6, z], rotation: [180, 0, 0], scale: [s * 0.9, 1.8, s * 0.9], color: '#8a5a3b' }));
  }
  const player = buildObject({
    type: 'model', position: [0, 0.6, 0.6], parts: [
      { type: 'capsule', scale: [0.8, 0.6, 0.8], color: '#7c5cff' },
      { type: 'sphere', position: [0.18, 0.35, 0.33], scale: [0.18, 0.18, 0.18], color: '#fff' },
      { type: 'sphere', position: [-0.18, 0.35, 0.33], scale: [0.18, 0.18, 0.18], color: '#fff' },
    ],
  });
  scene.add(player);
  const coins = [[5.5, 2.2, -3], [-5, 3, -4], [1.5, 1, -1.5]].map((p) => {
    const c = buildObject({ type: 'torus', position: p, color: '#ffd34d', emissive: '#7a5a00', metalness: 0.6, roughness: 0.3 });
    scene.add(c);
    return c;
  });
  const castle = buildObject({
    type: 'model', position: [-5, 2, -4.6], parts: [
      { type: 'box', position: [0, 0.8, 0], scale: [1.6, 1.6, 1.2], color: '#d9d4e8' },
      { type: 'cylinder', position: [-0.9, 1.1, 0], scale: [0.6, 2.2, 0.6], color: '#c9c2dc' },
      { type: 'cylinder', position: [0.9, 1.1, 0], scale: [0.6, 2.2, 0.6], color: '#c9c2dc' },
      { type: 'cone', position: [-0.9, 2.6, 0], scale: [0.8, 0.9, 0.8], color: '#ff6b81' },
      { type: 'cone', position: [0.9, 2.6, 0], scale: [0.8, 0.9, 0.8], color: '#ff6b81' },
    ],
  });
  scene.add(castle);

  const clock = new THREE.Clock();
  function frame() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== Math.floor(w * renderer.getPixelRatio())) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    const t = clock.getElapsedTime();
    player.position.y = 0.6 + Math.abs(Math.sin(t * 2.5)) * 0.8;
    coins.forEach((c, i) => { c.rotation.y = t * 2 + i; });
    camera.position.x = Math.sin(t * 0.15) * 14;
    camera.position.z = Math.cos(t * 0.15) * 14;
    camera.lookAt(0, 1, -1.5);
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  frame();
}
