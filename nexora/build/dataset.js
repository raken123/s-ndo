// Writes nexora/colab/nexora_seed.jsonl: chat-format training examples
// (system, game request, finished game) made with the offline generator.
//   node nexora/build/dataset.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', 'src');
const ctx = { window: {}, console };
ctx.window = ctx;
vm.createContext(ctx);
for (const f of ['runtime.js', 'games.js', 'localgen.js', 'ai.js']) vm.runInContext(fs.readFileSync(path.join(SRC, f), 'utf8'), ctx, { filename: f });
const L = ctx.NexoraLocal, AI = ctx.NexoraAI;
const RT = {
  core: ['nxRng', 'nxNoise', 'nxShade', 'Nx3D', 'NexoraRuntime'].map(n => ctx[n].toString()).join('\n\n'),
  templates: Object.fromEntries(Object.values(L.TEMPLATE_FN).map(n => [n, ctx[n]])),
};

const GENRES = [
  ['2d', ['Ett plattformsspel där man hoppar mellan plattformar', 'En ninja som hoppar över fiender', 'Hoppa och samla mynt']],
  ['2d', ['Rymdskjutare med vågor av fiender', 'Skjut ner aliens som anfaller', 'Ett skepp som skjuter laser mot en boss']],
  ['2d', ['Ett orm-spel där ormen växer', 'Snake med hinder på banan']],
  ['2d', ['Blockkross med powerups', 'Krossa tegelstenar med en boll']],
  ['2d', ['Undvik bilar på vägen', 'Undvik fallande stenar och samla mynt']],
  ['2d', ['Samla diamanter och undvik jägare', 'Samla mynt, två spelare på samma tangentbord']],
  ['2d', ['Ett open world-äventyr med uppdrag', 'Utforska ett kungarike och hjälp byborna']],
  ['3d', ['En 3D-löpare med tre filer', 'Endless runner i 3D där man hoppar över hinder']],
  ['3d', ['En 3D-arena där man samlar kulor', 'Samla orbs i en 3D-arena och undvik fiender']],
  ['2d', ['Ett racingspel mot AI-bilar', 'Gokart-tävling på en slingrig bana']],
  ['2d', ['Ett pusselspel med tre i rad', 'Matcha juveler och gör kombos']],
  ['2d', ['Tower defense mot vågor av fiender', 'Försvara basen med uppgraderbara torn']],
];
const THEMES = ['i en lavavärld', 'på is och snö', 'i en skog', 'under havet', 'med neon-tema', 'i en godisvärld', 'i ett spökhus', 'i öknen', 'i rymden', ''];
const LEVEL = ['', ', lätt för barn', ', svårt'];

const out = [];
let n = 0;
for (const [dim, ideas] of GENRES) for (const idea of ideas) for (const theme of THEMES) {
  const prompt = (idea + ' ' + theme).trim() + LEVEL[n++ % 3];
  const multi = /två spelare/.test(prompt);
  const cfg = L.config(prompt, { dim, music: n % 2 === 0, sfx: true, multiplayer: multi, quests: true, allowOpenWorld: true });
  const features = ['sfx'].concat(cfg.music ? ['music'] : [], multi ? ['multiplayer'] : [], dim === '3d' ? ['threeD'] : [], cfg.genre === 'openworld' ? ['openworld', 'npc', 'quest', 'dialog'] : []);
  out.push(JSON.stringify({ messages: [
    { role: 'system', content: AI.GAME_SYSTEM },
    { role: 'user', content: AI.gamePrompt(prompt, { dim, features }) },
    { role: 'assistant', content: '```html\n' + L.buildHtml(cfg, RT) + '\n```' },
  ] }));
}
const file = path.join(__dirname, '..', 'colab', 'nexora_seed.jsonl');
fs.writeFileSync(file, out.join('\n') + '\n');
console.log('wrote', out.length, 'examples,', (fs.statSync(file).size / 1e6).toFixed(1), 'MB');
