// Writes nexora/colab/nexora_prompts.json: every kind of request the Nexora models answer
// (games, bug fixes, SVG sprites, 3D meshes, music, sound effects, text), built with the
// app's own prompt builders (NexoraAI.PROMPTS), so a model trained on them sees exactly
// what the app will ask. The PyTorch training kit (nexora/train) and the Colab notebook
// read this file. The game ideas are spread over as many kinds of game as possible –
// there are no templates or fixed genres.
//   node nexora/build/prompts.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = { console };
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', 'ai.js'), 'utf8'), ctx, { filename: 'ai.js' });
const AI = ctx.NexoraAI, P = AI.PROMPTS;

const IDEAS = [
  'Laga pizzor åt otåliga kunder i en food truck', 'Fotboll med robotar på månen', 'Ett rytmspel där man trummar i takt med regnet',
  'En katt som smyger förbi hundar för att stjäla fisk', 'Odla magiska växter och sälj dem på marknaden', 'Ett skräckspel i en övergiven tunnelbana med ficklampa',
  'Styr en brandbil genom staden och släck bränder', 'Vrid rör så att vattnet når fram till blommorna', 'En bi som pollinerar blommor innan vintern kommer',
  'Bygg ett torn av vingliga lådor så högt som möjligt', 'Ett golfspel på en minigolfbana i rymden', 'Flyg ett pappersflygplan genom ett klassrum',
  'Sortera paket på ett löpande band innan de faller ner', 'En pingvin som driver ett glasskafé på ett isflak', 'Minnesspel med par av djurkort',
  'Ett schackliknande spel där pjäserna är grönsaker', 'Fånga fjärilar med håv på en äng', 'En detektiv som letar ledtrådar i ett hus',
  'Dirigera tåg så att de inte krockar', 'Ett tennisspel mot en datorspelare', 'Fiska i en sjö med olika fiskar och ett timingspel',
  'Mata hungriga monster med rätt färg på godis', 'Parkera bilar på trånga platser', 'Ett ubåtsspel där man undviker minor i mörkret',
  'Gräv efter skatter under jorden med en borr', 'Hjälp ankungar över en väg', 'En trollkarl som ritar runor med musen för att kasta besvärjelser',
  'Stapla hamburgare enligt beställningar', 'Håll balansen på en enhjuling på en lina', 'Ett stridsspel med jättelika robotar, två spelare',
  'Släpp kulor i en flipperspelsmaskin', 'Försvara ett slott med katapulter', 'Ett tidsreseäventyr genom tre epoker',
  'En skateboardåkare som gör trick i en park', 'Rädda astronauter som svävar i rymden', 'Ett korsordsliknande ordspel på svenska',
  'Hoppa mellan molnen och samla regndroppar', 'Driv en lemonadstånd och sätt priser efter vädret', 'Ett stealthspel där en robot undviker kameror',
  'Måla hela golvet genom att rulla en färgboll', 'Ett curlingspel på is', 'En hund som gräver upp ben i trädgården innan ägaren kommer hem',
  'Styr ett segelfartyg med vinden', 'Ett överlevnadsspel på en öde ö med hunger och eld', 'Kasta papperskulor i papperskorgen på kontoret',
  'En ninja som springer på väggar i en neonstad', 'Klicka på kakor för att baka mer och köp uppgraderingar', 'Fånga fallande stjärnor i en korg',
  'Ett matteäventyr där man löser tal för att öppna dörrar', 'En snöbollskrig mellan två lag', 'Bygg en bro som klarar ett tåg',
  'Ett zombiespel där man barrikaderar ett hus', 'Guida en fladdermus genom en grotta med ekolod', 'Ett kortspel där man bygger en armé av kort',
  'Styr en drönare som levererar paket till balkonger', 'Balansera tallrikar som servitör i en restaurang', 'Ett labyrintspel som roterar',
  'En groda som hoppar mellan näckrosblad', 'Ett vattenpistolkrig i en trädgård, två spelare', 'Flyga en drake genom ringar av eld',
  'Ett spel om att städa ett stökigt rum på tid', 'Bowling med pingviner som käglor', 'Dansspel där man följer pilar i takt',
  'Ett hackerspel där man knäcker lösenord med logik', 'Styr en pizzabud på moped genom trafik', 'En vulkan som ska få utbrott med rätt ingredienser',
  'Ett spel om att klippa gräset i mönster', 'Jonglera med bollar som blir fler och fler', 'En spökjägare med dammsugare',
  'Rulla en snöboll som växer nedför en backe', 'Ett frågesportspel om djur', 'Plocka äpplen innan maskarna tar dem',
  'Ett pusselspel med ljusstrålar och speglar', 'Jaga en tjuv över hustaken', 'Rymdhandel mellan planeter med olika priser',
  'Håll en ballong uppe med fläktar', 'Ett basketspel med trickskott', 'Styr en myrkoloni som samlar mat',
  'Ett spel där man stämmer gitarrsträngar på gehör', 'Fånga Pokémon-liknande varelser i högt gräs', 'Ett ishockeyspel, två spelare',
  'En robotdammsugare som städar ett hus', 'Släcka ljus i ett hus innan elräkningen blir för dyr', 'En ubåt som fotograferar djuphavsfiskar',
  'Ett vikingaskepp som ror genom en storm', 'Bygg en snögubbe innan solen smälter den', 'Ett äventyr där man pratar med byborna och löser deras problem',
  'Ett 3D-spel där man kör en rullstol genom ett hinderlopp', 'Flyg ett helikopter i 3D mellan skyskrapor', 'Ett 3D-spel där man bygger med block',
  'Utforska en grotta i 3D med en fackla', 'Ett 3D-racingspel med gräsklippare', 'Spela bordtennis i 3D',
];
const DIMS = i => (/3D/.test(IDEAS[i]) ? '3d' : '2d');
const EXTRA = [[], ['sfx'], ['music', 'sfx'], ['story'], ['sfx', 'multiplayer'], ['npc', 'dialog'], ['quest', 'npc']];
const req = (kind, idea, [system, user], extra) => Object.assign({ kind, idea, system, user }, extra || {});
const requests = IDEAS.map((idea, i) => {
  const dim = DIMS(i);
  const features = EXTRA[i % EXTRA.length].filter(f => f !== 'multiplayer' || /två spelare/.test(idea)).concat(dim === '3d' ? ['threeD'] : []);
  return req('game', idea, P.game(idea, { dim, features }), { dim, features });
});

const SPRITES = ['en drake', 'en robot', 'ett spöke', 'en riddare', 'en katt med hatt', 'en raket', 'en svamp med ansikte', 'en pirat', 'ett träd', 'en slime',
  'en magisk kristall', 'en bil sedd från sidan', 'en uggla', 'ett skattkistemynt', 'en zombie', 'en astronaut', 'en fisk', 'ett hus', 'en ninja', 'en blomma'];
const STYLES = ['pixel', 'platt', 'neon', 'retro'];
SPRITES.forEach((p, i) => requests.push(req('svg', p, P.image(p, { style: STYLES[i % 4], frames: i % 3 === 0 ? 4 : 1 }), { style: STYLES[i % 4], frames: i % 3 === 0 ? 4 : 1 })));
['ett svärd', 'en skattkista', 'en svamp', 'en planet med ring', 'ett träd', 'en stol', 'ett hus med skorsten', 'en raket', 'en tunna', 'en sten',
  'en lykta', 'en båt', 'ett slott', 'en kaktus', 'en robot', 'en bil', 'en fisk', 'en kristall', 'en bro', 'en väderkvarn']
  .forEach(p => requests.push(req('mesh', p, P.mesh(p))));
['snabb boss-musik', 'lugn skogsmeny', 'glad pizzarestaurang', 'spöklik tunnelbana', 'episk rymdstrid', 'mysig vinterby', 'retro arkad-tema', 'segerfanfar',
  'undervattensgrotta', 'actionfylld racing', 'sorgsen regnig kväll', 'magisk trädgård']
  .forEach(p => requests.push(req('music', p, P.music(p))));
['hopp', 'mynt', 'laser', 'explosion', 'powerup', 'träff', 'en slemmig dörr som öppnas', 'ett magiskt förtrollningsljud', 'fotsteg i snö', 'en robot som startar',
  'ett glas som går sönder', 'en kassa som plingar', 'en drake som ryter', 'vatten som plaskar', 'en portal som öppnas', 'game over']
  .forEach(p => requests.push(req('sfx', p, P.sfx(p))));
[['story', 'ett vikingaäventyr i en frusen skog'], ['npc', 'en pizzeria i rymden'], ['quest', 'en magisk trädgård'], ['dialog', 'ett skräckspel i tunnelbanan'], ['line', 'robotfotboll på månen'],
  ['story', 'en katt som stjäl fisk'], ['npc', 'ett ninjadojo'], ['quest', 'en piratö'], ['dialog', 'en detektiv i ett gammalt hus'], ['line', 'en food truck']]
  .forEach(([task, p]) => requests.push(req('text', p, P.text(task, p), { task })));

// Bug-fix requests are built during training from real errors; this is their exact shape.
const [fixSystem, fixUser] = P.fix('@@HTML@@', ['@@ERRORS@@']);
// The six example games the ad shows, with the ideas they were written for.
const EXAMPLES = { pizza: 'Laga pizzor åt otåliga kunder i en food truck', football: 'Fotboll med robotar på månen', rhythm: 'Ett rytmspel där man trummar i takt med regnet',
  cat: 'En katt som smyger förbi hundar för att stjäla fisk', garden: 'Odla magiska växter och sälj dem på marknaden', subway: 'Ett skräckspel i en övergiven tunnelbana med ficklampa' };
const file = path.join(__dirname, '..', 'colab', 'nexora_prompts.json');
fs.writeFileSync(file, JSON.stringify({ version: 2, system: AI.GAME_SYSTEM, fix: { system: fixSystem, user: fixUser }, examples: EXAMPLES, requests }, null, 1) + '\n');
const count = requests.reduce((o, r) => (o[r.kind] = (o[r.kind] || 0) + 1, o), {});
console.log('wrote', requests.length, 'requests', JSON.stringify(count), 'to', path.relative(process.cwd(), file));
