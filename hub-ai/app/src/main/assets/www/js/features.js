/* The 20 extras. The catalog (names, which plan unlocks what) comes from
 * Hub AI Cloud; this file holds the parts that run in the app. The cloud
 * ones (Make It CRAZIER, Translate, Mashup) are modes of /v1/generate.
 */
(function () {
  'use strict';

  function catalog() {
    var c = Store.get('cloud.config', null);
    return (c && c.features) || window.HUB_CLOUD_CONFIG.features;
  }
  function info(id) { return catalog().filter(function (f) { return f.id === id; })[0]; }
  function has(id) {
    var me = Plans.me();
    var list = (me && me.features) || Plans.plan().features || [];
    return list.indexOf(id) >= 0;
  }
  function needs(id) {
    var f = info(id), p = Plans.plans()[f.plan];
    return f.emoji + ' ' + f.name + ' needs ' + p.name + '.';
  }

  // ---------- 🎲 Surprise Me ----------

  var IDEAS = [
    'A tamagotchi for a pet rock that gets sad if you ignore it',
    'A compliment generator that gets more dramatic every click',
    'A soundless disco where the whole screen dances',
    'A fortune cookie that predicts what you will eat for dinner',
    'A to-do list where finished tasks explode into fireworks',
    'A dog name generator that rates every name out of 10',
    'A "should I take a nap" decision machine',
    'A stopwatch that cheers louder the longer it runs',
    'A pizza topping roulette with a spinning wheel',
    'A tiny zoo where you feed emoji animals',
    'A weather report for your mood',
    'A countdown to the next time someone says "banana"',
    'A plant that grows one leaf every time you drink water',
    'A pirate name generator with a treasure map background',
    'A dance move randomizer for kitchen parties',
    'A haiku machine about whatever you type',
    'A "how many cats tall am I" height converter',
    'A button that is way too excited to be pressed',
    'A space mission control for making toast',
    'A superhero name generator based on your breakfast',
    'An excuse generator for being late to everything',
    'A memory game with only cats',
    'A clicker game where you build a banana empire',
    'A mood ring that changes when you shake the phone',
    'A dramatic movie trailer voice for your grocery list',
    'A rock paper scissors tournament against a smug robot',
    'A "rate my sandwich" judge with fancy scorecards',
    'A sleepy sloth timer that takes forever to finish',
    'A pixel art pad that only uses 4 colours',
    'A daily dad joke dispenser with a groan meter'
  ];
  function surprise() { return IDEAS[Math.floor(Math.random() * IDEAS.length)]; }

  // ---------- Power-ups injected into a hub ----------

  var POWERUPS = {
    confetti: '<script>(function(){var C=["#ff5c5c","#ffd166","#06d6a0","#4cc9f0","#b388ff","#ff8fab"];' +
      'document.addEventListener("pointerdown",function(e){for(var i=0;i<26;i++){var d=document.createElement("div"),a=Math.random()*6.28,v=4+Math.random()*7;' +
      'd.style.cssText="position:fixed;z-index:2147483647;pointer-events:none;width:8px;height:12px;border-radius:2px;left:"+e.clientX+"px;top:"+e.clientY+"px;background:"+C[i%C.length];' +
      'document.body.appendChild(d);(function(d,vx,vy){var x=0,y=0,r=0,t=0;(function f(){t++;x+=vx;y+=vy;vy+=0.35;r+=12;d.style.transform="translate("+x+"px,"+y+"px) rotate("+r+"deg)";d.style.opacity=1-t/70;' +
      'if(t<70)requestAnimationFrame(f);else d.remove()})()})(d,Math.cos(a)*v,Math.sin(a)*v-5)}},true)})();</script>',
    catwalk: '<style>@keyframes hubCatWalk{0%{left:-60px;transform:scaleX(-1)}49%{left:calc(100% + 10px);transform:scaleX(-1)}50%{left:calc(100% + 10px);transform:scaleX(1)}100%{left:-60px;transform:scaleX(1)}}' +
      '.hub-cat{position:fixed;bottom:6px;font-size:38px;z-index:2147483646;pointer-events:none;animation:hubCatWalk 16s linear infinite}</style>' +
      '<script>(function(){var c=document.createElement("div");c.className="hub-cat";c.textContent="🐈";document.body.appendChild(c)})();</script>',
    upsidedown: '<style>body{transform:rotate(180deg);transform-origin:50% 50%}</style>',
    rainbow: '<style>@keyframes hubRainbow{to{filter:hue-rotate(360deg)}}html{animation:hubRainbow 6s linear infinite}</style>',
    sounds: '<script>(function(){var A;document.addEventListener("click",function(e){if(!e.target.closest("button,a,input,select,label,[role=button]"))return;' +
      'try{A=A||new(window.AudioContext||window.webkitAudioContext)();var o=A.createOscillator(),g=A.createGain();o.type=["sine","triangle","square"][Math.floor(Math.random()*3)];' +
      'o.frequency.setValueAtTime(300+Math.random()*700,A.currentTime);o.frequency.exponentialRampToValueAtTime(900+Math.random()*900,A.currentTime+0.12);' +
      'g.gain.setValueAtTime(0.12,A.currentTime);g.gain.exponentialRampToValueAtTime(0.001,A.currentTime+0.18);o.connect(g);g.connect(A.destination);o.start();o.stop(A.currentTime+0.2)}catch(x){}},true)})();</script>'
  };
  var POWERUP_LIST = ['confetti', 'catwalk', 'upsidedown', 'rainbow', 'sounds', 'nowatermark'];

  function inject(html, snippet) {
    var i = html.search(/<\/body>/i);
    return i < 0 ? html + snippet : html.slice(0, i) + snippet + html.slice(i);
  }

  function stripWatermark(html) {
    return html
      .replace(/<footer[^>]*>\s*Made with Hub AI[\s\S]*?<\/footer>/gi, '')
      .replace(/Made with Hub AI(\s*·\s*[^<]*)?/g, '');
  }

  // The hub as previewed and exported, with the power-ups the plan allows.
  function apply(html, powerups) {
    var out = html;
    (powerups || []).forEach(function (p) {
      if (!has(p)) return;
      if (p === 'nowatermark') out = stripWatermark(out);
      else if (POWERUPS[p]) out = inject(out, POWERUPS[p]);
    });
    return out;
  }

  // ---------- 🧬 Hub DNA ----------

  function dna(html) {
    var doc = new DOMParser().parseFromString(html, 'text/html');
    var colors = {};
    (html.match(/#[0-9a-f]{6}\b|#[0-9a-f]{3}\b/gi) || []).forEach(function (c) { c = c.toLowerCase(); colors[c] = (colors[c] || 0) + 1; });
    var top = Object.keys(colors).sort(function (a, b) { return colors[b] - colors[a]; }).slice(0, 12);
    var scripts = Array.prototype.map.call(doc.scripts, function (s) { return s.textContent.length; }).reduce(function (a, b) { return a + b; }, 0);
    var styles = Array.prototype.map.call(doc.querySelectorAll('style'), function (s) { return s.textContent.length; }).reduce(function (a, b) { return a + b; }, 0);
    return {
      title: (doc.title || '').trim(),
      kb: Math.round(new Blob([html]).size / 102.4) / 10,
      lines: html.split('\n').length,
      elements: doc.querySelectorAll('*').length,
      buttons: doc.querySelectorAll('button,[role=button]').length,
      inputs: doc.querySelectorAll('input,textarea,select').length,
      canvas: doc.querySelectorAll('canvas').length,
      jsChars: scripts, cssChars: styles,
      remembers: /localStorage/.test(html),
      animates: /@keyframes|requestAnimationFrame/.test(html),
      colors: top
    };
  }

  // ---------- 🔥 Daily Hub Challenge ----------

  var CHALLENGES = [
    'A game you can win in under 10 seconds', 'A tool for deciding what to eat', 'Something that makes your friends laugh',
    'An app with exactly three buttons', 'A hub about space', 'A tracker for something weird', 'A hub that only uses emojis',
    'A tiny shop for imaginary things', 'A quiz about yourself', 'A calm hub for a stressful day', 'A hub for your pet',
    'A party game for 4 people', 'A hub that changes every time you open it', 'A retro arcade game', 'A gift idea machine',
    'A hub in black and white only', 'A hub that teaches one fun fact', 'A soundboard with no sound (just vibes)',
    'A countdown to something you love', 'A hub your grandma would use', 'A hub for a rainy day', 'A secret club hub',
    'A hub that compliments you', 'A board game score keeper', 'A hub about bananas', 'A hub with a hidden easter egg',
    'A workout for lazy people', 'A hub that rates your outfit', 'A one-button game', 'A hub that tells a story'
  ];
  function dayKey(d) { d = d || new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function challenge() {
    var n = Math.floor(Date.now() / 86400000);
    var st = Store.get('challenge', { last: null, streak: 0 });
    var y = new Date(); y.setDate(y.getDate() - 1);
    var alive = st.last === dayKey() || st.last === dayKey(y);
    return { prompt: CHALLENGES[n % CHALLENGES.length], doneToday: st.last === dayKey(), streak: alive ? st.streak : 0 };
  }
  function completeChallenge() {
    var c = challenge();
    if (c.doneToday) return c.streak;
    var streak = c.streak + 1;
    Store.set('challenge', { last: dayKey(), streak: streak });
    return streak;
  }

  // ---------- 🧩 Embed Code ----------

  function embed(html, title) {
    var src = html.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    return '<iframe title="' + String(title).replace(/"/g, '&quot;') + '" style="width:100%;height:640px;border:0;border-radius:12px" ' +
      'sandbox="allow-scripts allow-forms allow-modals" srcdoc="' + src + '"></iframe>';
  }

  // ---------- 🔐 Password Lock ----------
  // A self-contained SHA-256 (it must also run inside the exported file, where
  // crypto.subtle may be missing), used to stretch the password and as a
  // counter-mode keystream. The loader carries the same code.

  var SHA = 'function sha256(m){var K=[1116352408,1899447441,3049323471,3921009573,961987163,1508970993,2453635748,2870763221,3624381080,310598401,607225278,1426881987,1925078388,2162078206,2614888103,3248222580,3835390401,4022224774,264347078,604807628,770255983,1249150122,1555081692,1996064986,2554220882,2821834349,2952996808,3210313671,3336571891,3584528711,113926993,338241895,666307205,773529912,1294757372,1396182291,1695183700,1986661051,2177026350,2456956037,2730485921,2820302411,3259730800,3345764771,3516065817,3600352804,4094571909,275423344,430227734,506948616,659060556,883997877,958139571,1322822218,1537002063,1747873779,1955562222,2024104815,2227730452,2361852424,2428436474,2756734187,3204031479,3329325298],' +
    'H=[1779033703,3144134277,1013904242,2773480762,1359893119,2600822924,528734635,1541459225],l=m.length,n=((l+9+63)>>6)<<6,b=new Uint8Array(n),w=new Uint32Array(64),i,j;b.set(m);b[l]=128;var bl=l*8;' +
    'b[n-4]=bl>>>24;b[n-3]=bl>>>16&255;b[n-2]=bl>>>8&255;b[n-1]=bl&255;b[n-5]=(l/536870912)>>>0;for(i=0;i<n;i+=64){for(j=0;j<16;j++)w[j]=b[i+4*j]<<24|b[i+4*j+1]<<16|b[i+4*j+2]<<8|b[i+4*j+3];' +
    'for(j=16;j<64;j++){var x=w[j-15],y=w[j-2];w[j]=(((x>>>7|x<<25)^(x>>>18|x<<14)^x>>>3)+w[j-7]+((y>>>17|y<<15)^(y>>>19|y<<13)^y>>>10)+w[j-16])|0}' +
    'var a=H[0],c=H[1],d=H[2],e=H[3],f=H[4],g=H[5],h=H[6],k=H[7];for(j=0;j<64;j++){var t1=(k+((f>>>6|f<<26)^(f>>>11|f<<21)^(f>>>25|f<<7))+(f&g^~f&h)+K[j]+w[j])|0,' +
    't2=(((a>>>2|a<<30)^(a>>>13|a<<19)^(a>>>22|a<<10))+(a&c^a&d^c&d))|0;k=h;h=g;g=f;f=(e+t1)|0;e=d;d=c;c=a;a=(t1+t2)|0}' +
    'H[0]=H[0]+a|0;H[1]=H[1]+c|0;H[2]=H[2]+d|0;H[3]=H[3]+e|0;H[4]=H[4]+f|0;H[5]=H[5]+g|0;H[6]=H[6]+h|0;H[7]=H[7]+k|0}' +
    'var o=new Uint8Array(32);for(i=0;i<8;i++){o[4*i]=H[i]>>>24;o[4*i+1]=H[i]>>>16&255;o[4*i+2]=H[i]>>>8&255;o[4*i+3]=H[i]&255}return o}' +
    'function cat(a,b){var o=new Uint8Array(a.length+b.length);o.set(a);o.set(b,a.length);return o}' +
    'function stretch(pw,salt,n){var k=sha256(cat(salt,new TextEncoder().encode(pw)));for(var i=0;i<n;i++)k=sha256(cat(k,salt));return k}' +
    'function xor(key,data){var o=new Uint8Array(data.length),c=new Uint8Array(4);for(var i=0;i<data.length;i+=32){var n=i/32;c[0]=n>>>24;c[1]=n>>>16&255;c[2]=n>>>8&255;c[3]=n&255;' +
    'var s=sha256(cat(key,c));for(var j=0;j<32&&i+j<data.length;j++)o[i+j]=data[i+j]^s[j]}return o}';
  // eslint-disable-next-line no-new-func
  var lib = new Function(SHA + 'return {sha256:sha256,cat:cat,stretch:stretch,xor:xor};')();
  var ROUNDS = 40000;

  function b64(u8) { var s = ''; for (var i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); }
  function hex(u8) { return Array.prototype.map.call(u8, function (x) { return ('0' + x.toString(16)).slice(-2); }).join(''); }

  function lock(html, password, title) {
    var salt = new Uint8Array(16);
    crypto.getRandomValues(salt);
    var key = lib.stretch(password, salt, ROUNDS);
    var check = hex(lib.sha256(lib.cat(key, new TextEncoder().encode('hub-ai-check'))));
    var data = b64(lib.xor(key, new TextEncoder().encode(html)));
    var t = String(title || 'Locked hub').replace(/[<&"]/g, '');
    return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>🔐 ' + t + '</title>' +
      '<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0d0d0d;color:#ececec;font:16px system-ui,sans-serif}' +
      'form{width:min(320px,90vw);text-align:center}input,button{font:inherit;width:100%;box-sizing:border-box;padding:12px;border-radius:10px;margin-top:10px}' +
      'input{background:#161616;color:#ececec;border:1px solid #2b2b2b}button{background:#ececec;color:#0d0d0d;border:0;font-weight:600}p{color:#8d8d8d;min-height:20px}</style></head>' +
      '<body><form id="f"><h1 style="font-size:20px">🔐 ' + t + '</h1><input id="p" type="password" placeholder="Password" autofocus><button>Open</button><p id="m"></p></form>' +
      '<script>' + SHA + 'var SALT="' + b64(salt) + '",CHECK="' + check + '",N=' + ROUNDS + ',DATA="' + data + '";' +
      'function un(s){var b=atob(s),o=new Uint8Array(b.length);for(var i=0;i<b.length;i++)o[i]=b.charCodeAt(i);return o}' +
      'function hx(u){return Array.prototype.map.call(u,function(x){return("0"+x.toString(16)).slice(-2)}).join("")}' +
      'document.getElementById("f").onsubmit=function(e){e.preventDefault();var m=document.getElementById("m");m.textContent="Unlocking…";setTimeout(function(){' +
      'var k=stretch(document.getElementById("p").value,un(SALT),N);if(hx(sha256(cat(k,new TextEncoder().encode("hub-ai-check"))))!==CHECK){m.textContent="Wrong password.";return}' +
      'var h=new TextDecoder().decode(xor(k,un(DATA)));document.open();document.write(h);document.close()},30)};</script></body></html>';
  }

  // ---------- 📲 Install as App ----------

  function pwaFiles(html, title, color) {
    var name = String(title || 'Hub').slice(0, 40);
    var accent = color || '#3b74d9';
    var head = '<link rel="manifest" href="manifest.webmanifest"><meta name="theme-color" content="#0d0d0d">' +
      '<link rel="icon" href="icon.svg"><link rel="apple-touch-icon" href="icon.svg"><meta name="apple-mobile-web-app-capable" content="yes">';
    var page = /<\/head>/i.test(html) ? html.replace(/<\/head>/i, head + '</head>') : head + html;
    page = inject(page, '<script>if("serviceWorker" in navigator)navigator.serviceWorker.register("sw.js").catch(function(){});</script>');
    var letter = (name.match(/[A-Za-z0-9]/) || ['H'])[0].toUpperCase();
    return [
      { name: 'index.html', data: page },
      { name: 'manifest.webmanifest', data: JSON.stringify({
        name: name, short_name: name.slice(0, 12), start_url: './', display: 'standalone',
        background_color: '#0d0d0d', theme_color: '#0d0d0d',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }]
      }, null, 2) },
      { name: 'sw.js', data: 'var C="hub-v1",F=["./","index.html","manifest.webmanifest","icon.svg"];' +
        'self.addEventListener("install",function(e){e.waitUntil(caches.open(C).then(function(c){return c.addAll(F)}))});' +
        'self.addEventListener("fetch",function(e){e.respondWith(caches.match(e.request).then(function(r){return r||fetch(e.request)}))});' },
      { name: 'icon.svg', data: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="110" fill="#0d0d0d"/>' +
        '<text x="256" y="340" font-size="260" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="700" fill="' + accent + '">' + letter + '</text></svg>' },
      { name: 'README.txt', data: name + ' — an installable hub made with Hub AI.\n\nPut these files on any HTTPS web host (GitHub Pages, Netlify, ...).\n' +
        'Open the page on a phone and choose "Add to Home Screen" / "Install app". It then works offline.\n' }
    ];
  }

  // ---------- 🎨 Brand Kit ----------

  function brand() { return Store.get('brandkit', { on: false, name: '', color: '#3b74d9' }); }
  function brandPrompt(prompt) {
    var b = brand();
    if (!b.on || !b.name || !has('brandkit')) return prompt;
    return prompt + '\n\nBrand kit: this hub is for ' + b.name + '. Use ' + b.color + ' as the main accent colour and show "' + b.name + '" in the header.';
  }

  window.Features = {
    catalog: catalog, info: info, has: has, needs: needs,
    surprise: surprise, POWERUP_LIST: POWERUP_LIST, apply: apply, stripWatermark: stripWatermark,
    dna: dna, challenge: challenge, completeChallenge: completeChallenge, embed: embed,
    lock: lock, pwaFiles: pwaFiles, brand: brand, brandPrompt: brandPrompt,
    LANGUAGES: ['English', 'Swedish', 'Spanish', 'French', 'German', 'Italian', 'Portuguese', 'Japanese', 'Korean', 'Chinese', 'Arabic', 'Hindi', 'Turkish', 'Polish', 'Dutch', 'Finnish'],
    _lib: lib
  };
})();
