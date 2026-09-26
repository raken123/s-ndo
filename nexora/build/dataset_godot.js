// Writes nexora/colab/nexora_godot_seed.jsonl: Godot-mode training examples.
// Each answer is a complete Python build script (Nexora's Godot generator plus the
// config for that brief), i.e. exactly what Astryx runs with run_python.
//   node nexora/build/dataset_godot.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', 'src');
const ctx = { console };
ctx.window = ctx;
vm.createContext(ctx);
for (const f of ['runtime.js', 'games.js', 'localgen.js', 'ai.js']) vm.runInContext(fs.readFileSync(path.join(SRC, f), 'utf8'), ctx, { filename: f });
const L = ctx.NexoraLocal, AI = ctx.NexoraAI;
const gen = fs.readFileSync(path.join(__dirname, '..', 'desktop', 'godot', 'nexora_godot_local.py'), 'utf8').split('\nif __name__ == "__main__":')[0];

const IDEAS = ['Ett utforskningsspel', 'Ett samlarspel i 3D', 'Ett tredjepersons äventyr', 'Samla kristaller och undvik jägare', 'Ett överlevnadsspel där man samlar energi', 'Ett jaktspel med tidsgräns'];
const PLACES = ['i en skog', 'i öknen', 'på is och snö', 'vid havet', 'i en lavavärld', 'i ett spökhus', 'i en neonstad', 'i en godisvärld', 'i rymden', 'på en äng'];
const MODS = ['', ', lätt för barn', ', svårt'];
const out = [];
let n = 0;
for (const idea of IDEAS) for (const place of PLACES) for (const hyper of [false, true]) {
  const prompt = idea + ' ' + place + MODS[n++ % 3];
  const a = L.config(prompt, { dim: '3d' });
  const theme = a.tagline.split('· ')[1].replace('-tema', '');
  const cfg = { title: a.title, tagline: 'Tredjeperson · ' + theme, seed: a.seed % 2147483647, difficulty: a.difficulty, palette: a.palette, hyperreal: hyper, models: [], hdri: '', ground_maps: {} };
  const script = gen.trimEnd() + "\n\n\nmain(json.loads(r'''" + JSON.stringify(cfg, null, 1) + "'''))\n";
  out.push(JSON.stringify({ messages: [
    { role: 'system', content: AI.GODOT_GUIDE },
    { role: 'user', content: 'Game idea: ' + prompt + '\n\nEngine: Godot 4.7 (GDScript). Write one Python script that creates the whole project in the current folder.' + (hyper ? '\nHYPERREALISTIC MODE: realistic environment settings (the assets are added separately).' : '') },
    { role: 'assistant', content: '```python\n' + script + '```' },
  ] }));
}
const file = path.join(__dirname, '..', 'colab', 'nexora_godot_seed.jsonl');
fs.writeFileSync(file, out.join('\n') + '\n');
console.log('wrote', out.length, 'examples,', (fs.statSync(file).size / 1e6).toFixed(1), 'MB');
