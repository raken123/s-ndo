/* Hub templates: the FunHub starter hubs, and the example answers the Hub
 * agents are fine-tuned on (hub-ai/cloud/training/build_dataset.py).
 *
 * Every template returns one self-contained HTML document (no network, no
 * external files), which is what a hub is. Template names match HUB_TYPES
 * in hub-ai/cloud/training/hubspec.py.
 *
 * Options: title, accent, dark, persist, extras, n (a number from the
 * request or null), topic, key (storage namespace), engine (label for the
 * footer).
 */
(function () {
  'use strict';

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  // JSON that is safe to drop inside a <script> element.
  function js(v) { return JSON.stringify(v).replace(/</g, '\\u003c'); }

  function page(p, css, body, script) {
    var dark = p.dark !== false;
    var vars = dark
      ? '--bg:#0f0f0f;--fg:#ececec;--card:#1a1a1a;--line:#2b2b2b;--muted:#8a8a8a;'
      : '--bg:#f6f6f6;--fg:#161616;--card:#ffffff;--line:#e2e2e2;--muted:#6f6f6f;';
    var store = p.persist
      ? 'var S={get:function(k,d){try{var v=localStorage.getItem(' + js(p.key + ':') + '+k);return v==null?d:JSON.parse(v)}catch(e){return d}},set:function(k,v){try{localStorage.setItem(' + js(p.key + ':') + '+k,JSON.stringify(v))}catch(e){}}};'
      : 'var S=(function(){var m={};return{get:function(k,d){return k in m?m[k]:d},set:function(k,v){m[k]=v}}})();';
    return '<!doctype html>\n<html lang="en"><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<meta name="generator" content="Hub AI">' +
      '<title>' + esc(p.title) + '</title><style>' +
      ':root{' + vars + '--accent:' + p.accent + '}' +
      '*{box-sizing:border-box}html,body{margin:0}' +
      'body{background:var(--bg);color:var(--fg);font:16px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;min-height:100vh}' +
      'main{max-width:520px;margin:0 auto;padding:20px 16px 40px}' +
      'h1{font-size:22px;margin:4px 0 16px;font-weight:650}' +
      '.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px;margin-bottom:12px}' +
      'button{font:inherit;border:1px solid var(--line);background:var(--card);color:var(--fg);border-radius:10px;padding:10px 14px;cursor:pointer}' +
      'button.primary{background:var(--accent);border-color:var(--accent);color:#fff}' +
      'button:active{transform:translateY(1px)}' +
      'input,select,textarea{font:inherit;width:100%;background:var(--bg);color:var(--fg);border:1px solid var(--line);border-radius:10px;padding:10px}' +
      'label{display:block;font-size:13px;color:var(--muted);margin:8px 0 4px}' +
      '.row{display:flex;gap:8px;align-items:center}.row>*{flex:1}' +
      '.muted{color:var(--muted)}.big{font-size:56px;font-weight:700;text-align:center;font-variant-numeric:tabular-nums;margin:10px 0}' +
      'footer{margin-top:28px;text-align:center;font-size:12px;color:var(--muted)}' +
      (css || '') + '</style></head><body><main><h1>' + esc(p.title) + '</h1>' + body +
      '<footer>Made with Hub AI' + (p.engine ? ' · ' + esc(p.engine) : '') + '</footer></main>' +
      '<script>(function(){' + store + script + '})();</script></body></html>';
  }

  // Small built-in question banks for quiz and flashcards.
  var BANKS = {
    space: [
      ['Which planet is known as the Red Planet?', 'Mars', ['Venus', 'Jupiter', 'Mercury']],
      ['What is the largest planet in the Solar System?', 'Jupiter', ['Saturn', 'Earth', 'Neptune']],
      ['What star is at the centre of our Solar System?', 'The Sun', ['Sirius', 'Polaris', 'Vega']],
      ['How many planets orbit the Sun?', '8', ['7', '9', '10']],
      ['Which planet has the most famous rings?', 'Saturn', ['Mars', 'Uranus', 'Mercury']],
      ['What is the name of our galaxy?', 'The Milky Way', ['Andromeda', 'Triangulum', 'Sombrero']]
    ],
    animals: [
      ['What is the largest animal on Earth?', 'Blue whale', ['Elephant', 'Giraffe', 'Great white shark']],
      ['How many legs does a spider have?', '8', ['6', '10', '12']],
      ['Which bird cannot fly?', 'Penguin', ['Eagle', 'Sparrow', 'Owl']],
      ['What do pandas mostly eat?', 'Bamboo', ['Fish', 'Berries', 'Grass']],
      ['Which animal is known as the king of the jungle?', 'Lion', ['Tiger', 'Gorilla', 'Bear']],
      ['What is a baby kangaroo called?', 'Joey', ['Cub', 'Kid', 'Calf']]
    ],
    geography: [
      ['What is the capital of France?', 'Paris', ['Lyon', 'Rome', 'Madrid']],
      ['Which is the longest river in the world?', 'The Nile', ['The Amazon', 'The Danube', 'The Thames']],
      ['Which continent is Kenya in?', 'Africa', ['Asia', 'South America', 'Europe']],
      ['What is the largest ocean?', 'Pacific', ['Atlantic', 'Indian', 'Arctic']],
      ['What is the capital of Japan?', 'Tokyo', ['Osaka', 'Kyoto', 'Seoul']],
      ['Which country has the most people?', 'India', ['USA', 'Brazil', 'Russia']]
    ],
    science: [
      ['What gas do plants take in?', 'Carbon dioxide', ['Oxygen', 'Helium', 'Nitrogen']],
      ['What is H2O?', 'Water', ['Salt', 'Hydrogen', 'Air']],
      ['What force keeps us on the ground?', 'Gravity', ['Magnetism', 'Friction', 'Wind']],
      ['At what temperature does water boil at sea level?', '100 °C', ['90 °C', '80 °C', '120 °C']],
      ['What part of the cell holds DNA?', 'Nucleus', ['Membrane', 'Wall', 'Ribosome']],
      ['What is the hardest natural material?', 'Diamond', ['Gold', 'Iron', 'Quartz']]
    ],
    general: [
      ['How many days are in a leap year?', '366', ['365', '364', '360']],
      ['How many sides does a hexagon have?', '6', ['5', '7', '8']],
      ['What colour do you get by mixing blue and yellow?', 'Green', ['Purple', 'Orange', 'Brown']],
      ['How many minutes are in an hour?', '60', ['100', '30', '90']],
      ['Which instrument has 88 keys?', 'Piano', ['Guitar', 'Violin', 'Flute']],
      ['What is 9 × 7?', '63', ['56', '72', '49']]
    ]
  };
  function bank(topic) {
    var t = String(topic || '').toLowerCase();
    if (/space|planet|star|astro|moon|galax/.test(t)) return BANKS.space;
    if (/animal|pet|dog|cat|zoo|wild/.test(t)) return BANKS.animals;
    if (/geo|countr|capital|world|map|travel/.test(t)) return BANKS.geography;
    if (/science|chem|bio|physic/.test(t)) return BANKS.science;
    return BANKS.general;
  }

  var T = {};

  T.todo = function (p) {
    return page(p,
      'ul{list-style:none;padding:0;margin:0}li{display:flex;gap:10px;align-items:center;padding:10px 4px;border-bottom:1px solid var(--line)}' +
      'li span{flex:1}li.done span{text-decoration:line-through;color:var(--muted)}li input{width:auto}li button{padding:4px 10px}',
      '<div class="card"><form id="f" class="row"><input id="t" placeholder="Add a task" autocomplete="off"><button class="primary" style="flex:0">Add</button></form></div>' +
      '<div class="card"><ul id="l"></ul><p id="e" class="muted">Nothing here yet.</p></div>' +
      (p.extras ? '<div class="row"><button id="c">Clear done</button><span id="s" class="muted" style="text-align:right"></span></div>' : ''),
      'var items=S.get("items",[]),l=document.getElementById("l");' +
      'function save(){S.set("items",items);draw()}' +
      'function draw(){l.innerHTML="";items.forEach(function(it,i){var li=document.createElement("li");if(it.d)li.className="done";' +
      'var c=document.createElement("input");c.type="checkbox";c.checked=it.d;c.onchange=function(){it.d=c.checked;save()};' +
      'var s=document.createElement("span");s.textContent=it.t;var b=document.createElement("button");b.textContent="×";b.onclick=function(){items.splice(i,1);save()};' +
      'li.append(c,s,b);l.appendChild(li)});document.getElementById("e").style.display=items.length?"none":"block";' +
      'var st=document.getElementById("s");if(st)st.textContent=items.filter(function(x){return x.d}).length+" / "+items.length+" done"}' +
      'document.getElementById("f").onsubmit=function(e){e.preventDefault();var t=document.getElementById("t");if(t.value.trim()){items.push({t:t.value.trim(),d:false});t.value="";save()}};' +
      'var cb=document.getElementById("c");if(cb)cb.onclick=function(){items=items.filter(function(x){return !x.d});save()};draw();');
  };

  T.notes = function (p) {
    return page(p,
      '.n{white-space:pre-wrap;margin:0}.n small{display:block;color:var(--muted);margin-top:6px}textarea{min-height:110px;resize:vertical}',
      '<div class="card"><textarea id="t" placeholder="Write a note…"></textarea><div class="row" style="margin-top:8px">' +
      (p.extras ? '<input id="q" placeholder="Search notes">' : '<span></span>') +
      '<button class="primary" id="a" style="flex:0">Save</button></div></div><div id="l"></div>',
      'var notes=S.get("notes",[]),l=document.getElementById("l"),q=document.getElementById("q");' +
      'function draw(){l.innerHTML="";var f=q?q.value.toLowerCase():"";notes.forEach(function(n,i){if(f&&n.t.toLowerCase().indexOf(f)<0)return;' +
      'var d=document.createElement("div");d.className="card";var p=document.createElement("p");p.className="n";p.textContent=n.t;' +
      'var s=document.createElement("small");s.textContent=new Date(n.at).toLocaleString();p.appendChild(s);' +
      'var b=document.createElement("button");b.textContent="Delete";b.style.marginTop="8px";b.onclick=function(){notes.splice(i,1);S.set("notes",notes);draw()};' +
      'd.append(p,b);l.appendChild(d)})}' +
      'document.getElementById("a").onclick=function(){var t=document.getElementById("t");if(!t.value.trim())return;notes.unshift({t:t.value,at:Date.now()});t.value="";S.set("notes",notes);draw()};' +
      'if(q)q.oninput=draw;draw();');
  };

  T.counter = function (p) {
    var step = p.n && p.n > 0 && p.n < 1000 ? p.n : 1;
    return page(p, '.btns{display:flex;gap:10px}.btns button{flex:1;font-size:28px;padding:18px}',
      '<div class="card"><div class="big" id="v">0</div><div class="btns"><button id="m">−</button><button class="primary" id="p">+</button></div>' +
      '<div class="row" style="margin-top:10px"><button id="r">Reset</button>' + (p.extras ? '<span class="muted" id="h" style="text-align:right"></span>' : '') + '</div></div>',
      'var step=' + step + ',v=S.get("v",0),hi=S.get("hi",0),el=document.getElementById("v"),h=document.getElementById("h");' +
      'function draw(){el.textContent=v;if(v>hi){hi=v;S.set("hi",hi)}if(h)h.textContent="Best: "+hi;S.set("v",v)}' +
      'document.getElementById("p").onclick=function(){v+=step;draw()};document.getElementById("m").onclick=function(){v-=step;draw()};' +
      'document.getElementById("r").onclick=function(){v=0;draw()};draw();');
  };

  T.timer = function (p) {
    var mins = p.n && p.n > 0 && p.n <= 600 ? p.n : 5;
    return page(p, '',
      '<div class="card"><div class="big" id="d"></div><div class="row"><input id="m" type="number" min="1" max="600" value="' + mins + '"><span class="muted" style="flex:0">min</span></div>' +
      '<div class="row" style="margin-top:10px"><button class="primary" id="s">Start</button><button id="r">Reset</button></div></div>' +
      (p.extras ? '<div class="row"><button data-m="1">1</button><button data-m="3">3</button><button data-m="5">5</button><button data-m="10">10</button><button data-m="25">25</button></div>' : ''),
      'var left=0,end=0,run=false,t,d=document.getElementById("d"),m=document.getElementById("m"),s=document.getElementById("s");' +
      'function fmt(x){x=Math.max(0,Math.ceil(x/1000));return Math.floor(x/60)+":"+("0"+x%60).slice(-2)}' +
      'function reset(){run=false;clearInterval(t);left=(+m.value||1)*60000;s.textContent="Start";d.textContent=fmt(left)}' +
      'function beep(){try{var a=new (window.AudioContext||window.webkitAudioContext)(),o=a.createOscillator();o.connect(a.destination);o.frequency.value=880;o.start();setTimeout(function(){o.stop()},600)}catch(e){}}' +
      'function tick(){left=end-Date.now();d.textContent=fmt(left);if(left<=0){clearInterval(t);run=false;s.textContent="Start";d.textContent="Done!";beep();if(navigator.vibrate)navigator.vibrate([200,100,200])}}' +
      's.onclick=function(){if(run){run=false;clearInterval(t);s.textContent="Resume"}else{if(left<=0)reset();end=Date.now()+left;run=true;s.textContent="Pause";t=setInterval(tick,200)}};' +
      'document.getElementById("r").onclick=reset;m.onchange=reset;' +
      'Array.prototype.forEach.call(document.querySelectorAll("[data-m]"),function(b){b.onclick=function(){m.value=b.getAttribute("data-m");reset()}});reset();');
  };

  T.calculator = function (p) {
    return page(p,
      '.disp{font-size:34px;text-align:right;padding:14px 6px;min-height:64px;word-break:break-all;font-variant-numeric:tabular-nums}' +
      '.keys{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.keys button{font-size:22px;padding:16px 0}.keys .op{color:var(--accent)}.keys .eq{background:var(--accent);color:#fff;border-color:var(--accent)}',
      '<div class="card"><div class="muted" id="h" style="text-align:right;min-height:20px"></div><div class="disp" id="d">0</div><div class="keys" id="k"></div></div>',
      'var keys=["C","(",")","÷","7","8","9","×","4","5","6","−","1","2","3","+","0",".","⌫","="],e="",d=document.getElementById("d"),h=document.getElementById("h"),k=document.getElementById("k");' +
      'keys.forEach(function(c){var b=document.createElement("button");b.textContent=c;if("÷×−+()".indexOf(c)>=0)b.className="op";if(c==="=")b.className="eq";b.onclick=function(){press(c)};k.appendChild(b)});' +
      'function calc(s){s=s.replace(/×/g,"*").replace(/÷/g,"/").replace(/−/g,"-");if(!/^[0-9+\\-*/().\\s]+$/.test(s))throw 0;var r=Function("return ("+s+")")();if(!isFinite(r))throw 0;return +r.toPrecision(12)}' +
      'function press(c){if(c==="C")e="";else if(c==="⌫")e=e.slice(0,-1);else if(c==="="){try{h.textContent=e+" =";e=String(calc(e))}catch(x){h.textContent="Error";e=""}}else e+=c;d.textContent=e||"0"}');
  };

  T.dice = function (p) {
    var sides = p.n && [4, 6, 8, 10, 12, 20, 100].indexOf(p.n) >= 0 ? p.n : 6;
    return page(p, '.dice{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin:14px 0}' +
      '.die{width:72px;height:72px;border-radius:14px;border:2px solid var(--accent);display:grid;place-items:center;font-size:30px;font-weight:700}',
      '<div class="card"><div class="row"><div><label>Dice</label><select id="c"><option>1</option><option selected>2</option><option>3</option><option>4</option><option>5</option></select></div>' +
      '<div><label>Sides</label><select id="s">' + [4, 6, 8, 10, 12, 20, 100].map(function (n) { return '<option' + (n === sides ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select></div></div>' +
      '<div class="dice" id="d"></div><div class="big" id="t" style="font-size:28px"></div><button class="primary" id="r" style="width:100%">Roll</button></div>' +
      (p.extras ? '<div class="card"><label>History</label><div id="h" class="muted"></div></div>' : ''),
      'var d=document.getElementById("d"),t=document.getElementById("t"),h=document.getElementById("h"),hist=S.get("h",[]);' +
      'function roll(){var c=+document.getElementById("c").value,s=+document.getElementById("s").value,v=[],sum=0;d.innerHTML="";' +
      'for(var i=0;i<c;i++){var x=1+Math.floor(Math.random()*s);v.push(x);sum+=x;var e=document.createElement("div");e.className="die";e.textContent=x;d.appendChild(e)}' +
      't.textContent="Total "+sum;hist.unshift(c+"d"+s+": "+v.join(" + ")+" = "+sum);hist=hist.slice(0,8);S.set("h",hist);if(h)h.innerHTML=hist.map(function(x){return "<div>"+x+"</div>"}).join("")}' +
      'document.getElementById("r").onclick=roll;roll();');
  };

  T.stopwatch = function (p) {
    return page(p, 'ol{padding-left:22px;margin:0}li{padding:4px 0;font-variant-numeric:tabular-nums}',
      '<div class="card"><div class="big" id="d">0:00.0</div><div class="row"><button class="primary" id="s">Start</button><button id="l">Lap</button><button id="r">Reset</button></div></div>' +
      '<div class="card"><ol id="laps"></ol></div>',
      'var acc=0,st=0,run=false,t,laps=[],d=document.getElementById("d"),s=document.getElementById("s");' +
      'function now(){return acc+(run?Date.now()-st:0)}' +
      'function fmt(ms){var x=Math.floor(ms/100),te=x%10,sec=Math.floor(x/10)%60,m=Math.floor(x/600);return m+":"+("0"+sec).slice(-2)+"."+te}' +
      'function draw(){d.textContent=fmt(now())}' +
      's.onclick=function(){if(run){acc=now();run=false;clearInterval(t);s.textContent="Start"}else{st=Date.now();run=true;t=setInterval(draw,50);s.textContent="Stop"}};' +
      'document.getElementById("l").onclick=function(){if(!run)return;laps.push(now());var o=document.getElementById("laps");var li=document.createElement("li");var prev=laps.length>1?laps[laps.length-2]:0;li.textContent=fmt(now())+"  (+"+fmt(now()-prev)+")";o.appendChild(li)};' +
      'document.getElementById("r").onclick=function(){acc=0;run=false;clearInterval(t);laps=[];document.getElementById("laps").innerHTML="";s.textContent="Start";draw()};');
  };

  T.quiz = function (p) {
    var qs = bank(p.topic);
    return page(p, '.opt{display:block;width:100%;text-align:left;margin-top:8px}.opt.ok{border-color:#2e9e5b;background:#2e9e5b22}.opt.no{border-color:#c94242;background:#c9424222}',
      '<div class="card"><div class="muted" id="n"></div><h2 id="q" style="font-size:19px;margin:8px 0 6px"></h2><div id="o"></div>' +
      '<button class="primary" id="nx" style="width:100%;margin-top:14px;display:none">Next</button></div>',
      'var Q=' + js(qs) + ',i=0,score=0,best=S.get("best",0);' +
      'function shuffle(a){for(var j=a.length-1;j>0;j--){var k=Math.floor(Math.random()*(j+1)),t=a[j];a[j]=a[k];a[k]=t}return a}Q=shuffle(Q.slice());' +
      'function show(){var nx=document.getElementById("nx"),o=document.getElementById("o");nx.style.display="none";o.innerHTML="";' +
      'if(i>=Q.length){if(score>best){best=score;S.set("best",best)}document.getElementById("n").textContent="Best: "+best+" / "+Q.length;document.getElementById("q").textContent="You scored "+score+" / "+Q.length;' +
      'var b=document.createElement("button");b.className="primary opt";b.textContent="Play again";b.onclick=function(){i=0;score=0;Q=shuffle(Q);show()};o.appendChild(b);return}' +
      'var q=Q[i];document.getElementById("n").textContent="Question "+(i+1)+" of "+Q.length+" · Score "+score;document.getElementById("q").textContent=q[0];' +
      'shuffle([q[1]].concat(q[2])).forEach(function(a){var b=document.createElement("button");b.className="opt";b.textContent=a;b.onclick=function(){' +
      'Array.prototype.forEach.call(o.children,function(x){x.disabled=true;if(x.textContent===q[1])x.classList.add("ok")});if(a===q[1])score++;else b.classList.add("no");nx.style.display="block"};o.appendChild(b)})}' +
      'document.getElementById("nx").onclick=function(){i++;show()};show();');
  };

  T.flashcards = function (p) {
    var cards = bank(p.topic).map(function (q) { return [q[0], q[1]]; });
    return page(p, '.fc{min-height:180px;display:grid;place-items:center;text-align:center;font-size:20px;cursor:pointer;user-select:none}',
      '<div class="card fc" id="c"></div><div class="row"><button id="pv">Back</button><button class="primary" id="fl">Flip</button><button id="nx">Next</button></div>' +
      '<p class="muted" id="n" style="text-align:center"></p>' +
      '<div class="card"><label>Add a card</label><input id="f" placeholder="Front"><input id="b" placeholder="Back" style="margin-top:8px"><button id="a" style="margin-top:8px;width:100%">Add card</button></div>',
      'var cards=S.get("cards",' + js(cards) + '),i=0,back=false,c=document.getElementById("c");' +
      'function draw(){if(!cards.length){c.textContent="No cards";return}i=(i+cards.length)%cards.length;c.textContent=cards[i][back?1:0];document.getElementById("n").textContent=(i+1)+" / "+cards.length+(back?" · answer":"")}' +
      'c.onclick=document.getElementById("fl").onclick=function(){back=!back;draw()};' +
      'document.getElementById("nx").onclick=function(){i++;back=false;draw()};document.getElementById("pv").onclick=function(){i--;back=false;draw()};' +
      'document.getElementById("a").onclick=function(){var f=document.getElementById("f"),b=document.getElementById("b");if(!f.value.trim()||!b.value.trim())return;cards.push([f.value.trim(),b.value.trim()]);S.set("cards",cards);f.value=b.value="";i=cards.length-1;back=false;draw()};draw();');
  };

  T.tipcalc = function (p) {
    var pct = p.n && p.n > 0 && p.n <= 50 ? p.n : 15;
    return page(p, '.out div{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--line)}.out b{font-variant-numeric:tabular-nums}',
      '<div class="card"><label>Bill</label><input id="b" type="number" inputmode="decimal" placeholder="0.00">' +
      '<label>Tip: <span id="pl">' + pct + '</span>%</label><input id="p" type="range" min="0" max="35" value="' + pct + '">' +
      '<label>People</label><input id="n" type="number" min="1" value="2"></div>' +
      '<div class="card out"><div><span>Tip</span><b id="t">0.00</b></div><div><span>Total</span><b id="to">0.00</b></div><div><span>Each person</span><b id="e" style="color:var(--accent)">0.00</b></div></div>',
      'function $(x){return document.getElementById(x)}function f(x){return(Math.round(x*100)/100).toFixed(2)}' +
      'function calc(){var b=+$("b").value||0,p=+$("p").value,n=Math.max(1,+$("n").value||1),t=b*p/100;$("pl").textContent=p;$("t").textContent=f(t);$("to").textContent=f(b+t);$("e").textContent=f((b+t)/n)}' +
      '["b","p","n"].forEach(function(x){$(x).oninput=calc});calc();');
  };

  T.converter = function (p) {
    return page(p, '',
      '<div class="card"><label>Type</label><select id="k"></select><div class="row" style="margin-top:10px"><input id="v" type="number" value="1"><select id="a"></select></div>' +
      '<div class="row" style="margin-top:8px"><div class="big" id="o" style="font-size:30px;text-align:left"></div><select id="b"></select></div></div>',
      'var U={Length:{m:1,km:1000,cm:0.01,mm:0.001,mi:1609.344,yd:0.9144,ft:0.3048,"in":0.0254},Weight:{kg:1,g:0.001,lb:0.45359237,oz:0.028349523,st:6.35029318},' +
      'Volume:{l:1,ml:0.001,gal:3.785411784,qt:0.946352946,cup:0.2365882365,"fl oz":0.0295735296},Temperature:{"°C":0,"°F":0,K:0}};' +
      'function $(x){return document.getElementById(x)}Object.keys(U).forEach(function(k){$("k").add(new Option(k,k))});' +
      'function fill(){var u=Object.keys(U[$("k").value]);["a","b"].forEach(function(s,i){$(s).innerHTML="";u.forEach(function(x){$(s).add(new Option(x,x))});$(s).selectedIndex=Math.min(i,u.length-1)});calc()}' +
      'function toC(v,u){return u==="°C"?v:u==="°F"?(v-32)*5/9:v-273.15}function fromC(v,u){return u==="°C"?v:u==="°F"?v*9/5+32:v+273.15}' +
      'function calc(){var k=$("k").value,v=+$("v").value,a=$("a").value,b=$("b").value,r;r=k==="Temperature"?fromC(toC(v,a),b):v*U[k][a]/U[k][b];$("o").textContent=+r.toPrecision(8)}' +
      '$("k").onchange=fill;$("v").oninput=$("a").onchange=$("b").onchange=calc;fill();');
  };

  T.pomodoro = function (p) {
    var work = p.n && p.n >= 5 && p.n <= 90 ? p.n : 25;
    return page(p, '.ring{width:220px;height:220px;margin:6px auto;position:relative}.ring svg{transform:rotate(-90deg)}.ring .big{position:absolute;inset:0;display:grid;place-items:center;margin:0;font-size:44px}',
      '<div class="card" style="text-align:center"><div class="muted" id="m">Focus</div><div class="ring"><svg width="220" height="220"><circle cx="110" cy="110" r="100" fill="none" stroke="var(--line)" stroke-width="10"/>' +
      '<circle id="c" cx="110" cy="110" r="100" fill="none" stroke="var(--accent)" stroke-width="10" stroke-linecap="round" stroke-dasharray="628.3" stroke-dashoffset="0"/></svg><div class="big" id="d"></div></div>' +
      '<div class="row"><button class="primary" id="s">Start</button><button id="sk">Skip</button></div><p class="muted" id="n"></p></div>' +
      '<div class="card row"><div><label>Focus (min)</label><input id="w" type="number" value="' + work + '"></div><div><label>Break (min)</label><input id="b" type="number" value="5"></div></div>',
      'function $(x){return document.getElementById(x)}var focus=true,len,left,end,run=false,t,done=S.get("done",0);' +
      'function setup(){len=(+(focus?$("w"):$("b")).value||1)*60000;left=len;$("m").textContent=focus?"Focus":"Break";draw()}' +
      'function draw(){var x=Math.max(0,Math.ceil(left/1000));$("d").textContent=Math.floor(x/60)+":"+("0"+x%60).slice(-2);$("c").setAttribute("stroke-dashoffset",628.3*(1-left/len));$("n").textContent=done+" focus sessions done"}' +
      'function next(){if(focus){done++;S.set("done",done)}focus=!focus;setup();if(navigator.vibrate)navigator.vibrate(300)}' +
      'function tick(){left=end-Date.now();if(left<=0){next();end=Date.now()+left}draw()}' +
      '$("s").onclick=function(){if(run){run=false;clearInterval(t);$("s").textContent="Start"}else{run=true;end=Date.now()+left;t=setInterval(tick,250);$("s").textContent="Pause"}};' +
      '$("sk").onclick=function(){next();end=Date.now()+left};$("w").onchange=$("b").onchange=function(){if(!run)setup()};setup();');
  };

  T.habit = function (p) {
    return page(p, '.h{display:flex;align-items:center;gap:6px;padding:8px 0;border-bottom:1px solid var(--line)}.h .nm{flex:1}.d{width:30px;height:30px;padding:0;border-radius:8px;font-size:11px}.d.on{background:var(--accent);border-color:var(--accent);color:#fff}',
      '<div class="card"><form id="f" class="row"><input id="t" placeholder="New habit, e.g. Drink water"><button class="primary" style="flex:0">Add</button></form></div><div class="card" id="l"></div>',
      'var H=S.get("habits",[]),l=document.getElementById("l");function key(d){return d.toISOString().slice(0,10)}' +
      'function days(){var a=[];for(var i=6;i>=0;i--){var d=new Date();d.setDate(d.getDate()-i);a.push(d)}return a}' +
      'function streak(h){var n=0,d=new Date();while(h.done[key(d)]){n++;d.setDate(d.getDate()-1)}return n}' +
      'function draw(){l.innerHTML=H.length?"":"<p class=muted>Add a habit to start tracking.</p>";H.forEach(function(h,hi){var r=document.createElement("div");r.className="h";' +
      'var n=document.createElement("div");n.className="nm";n.textContent=h.name+" · "+streak(h)+"🔥";r.appendChild(n);' +
      'days().forEach(function(d){var b=document.createElement("button");var k=key(d);b.className="d"+(h.done[k]?" on":"");b.textContent="SMTWTFS"[d.getDay()];b.onclick=function(){if(h.done[k])delete h.done[k];else h.done[k]=1;S.set("habits",H);draw()};r.appendChild(b)});' +
      'var x=document.createElement("button");x.className="d";x.textContent="×";x.onclick=function(){H.splice(hi,1);S.set("habits",H);draw()};r.appendChild(x);l.appendChild(r)})}' +
      'document.getElementById("f").onsubmit=function(e){e.preventDefault();var t=document.getElementById("t");if(t.value.trim()){H.push({name:t.value.trim(),done:{}});t.value="";S.set("habits",H);draw()}};draw();');
  };

  T.picker = function (p) {
    return page(p, 'textarea{min-height:130px}',
      '<div class="card"><label>One option per line</label><textarea id="t">Alex\nSam\nRiley\nJordan</textarea>' +
      '<div class="big" id="o" style="font-size:34px">?</div><button class="primary" id="g" style="width:100%">Pick</button></div>' +
      '<label><input type="checkbox" id="rm" style="width:auto"> Remove picked option</label>',
      'var t=document.getElementById("t"),o=document.getElementById("o");t.value=S.get("t",t.value);t.oninput=function(){S.set("t",t.value)};' +
      'document.getElementById("g").onclick=function(){var a=t.value.split("\\n").map(function(x){return x.trim()}).filter(Boolean);if(!a.length){o.textContent="Add options";return}' +
      'var n=0,pick=Math.floor(Math.random()*a.length),iv=setInterval(function(){o.textContent=a[n++%a.length];if(n>14){clearInterval(iv);o.textContent=a[pick];' +
      'if(document.getElementById("rm").checked){a.splice(pick,1);t.value=a.join("\\n");S.set("t",t.value)}}},70)};');
  };

  T.password = function (p) {
    var len = p.n && p.n >= 6 && p.n <= 64 ? p.n : 16;
    return page(p, '.pw{font-family:ui-monospace,monospace;font-size:20px;word-break:break-all;padding:12px;background:var(--bg);border-radius:10px;min-height:52px}',
      '<div class="card"><div class="pw" id="o"></div><div class="muted" id="s" style="margin-top:6px"></div>' +
      '<label>Length: <span id="ll">' + len + '</span></label><input id="l" type="range" min="6" max="64" value="' + len + '">' +
      '<label><input type="checkbox" id="u" checked style="width:auto"> Uppercase</label><label><input type="checkbox" id="d" checked style="width:auto"> Numbers</label>' +
      '<label><input type="checkbox" id="y" checked style="width:auto"> Symbols</label><div class="row" style="margin-top:10px"><button class="primary" id="g">Generate</button><button id="c">Copy</button></div></div>',
      'function $(x){return document.getElementById(x)}' +
      'function gen(){var s="abcdefghijkmnopqrstuvwxyz";if($("u").checked)s+="ABCDEFGHJKLMNPQRSTUVWXYZ";if($("d").checked)s+="23456789";if($("y").checked)s+="!@#$%^&*-_=+?";' +
      'var n=+$("l").value,a=new Uint32Array(n),r="";crypto.getRandomValues(a);for(var i=0;i<n;i++)r+=s[a[i]%s.length];$("o").textContent=r;$("ll").textContent=n;' +
      'var bits=Math.round(n*Math.log2(s.length));$("s").textContent="≈ "+bits+" bits · "+(bits<50?"weak":bits<80?"good":"strong")}' +
      '$("g").onclick=gen;$("l").oninput=gen;$("u").onchange=$("d").onchange=$("y").onchange=gen;' +
      '$("c").onclick=function(){var t=$("o").textContent;if(navigator.clipboard)navigator.clipboard.writeText(t).then(function(){$("c").textContent="Copied"},function(){});};gen();');
  };

  T.bmi = function (p) {
    return page(p, '',
      '<div class="card"><div class="row"><button id="mt" class="primary">Metric</button><button id="im">Imperial</button></div>' +
      '<label id="hl">Height (cm)</label><input id="h" type="number" value="170"><label id="wl">Weight (kg)</label><input id="w" type="number" value="65"></div>' +
      '<div class="card" style="text-align:center"><div class="big" id="b"></div><div id="c" style="font-weight:600"></div><p class="muted">BMI is a rough guide, not a diagnosis.</p></div>',
      'function $(x){return document.getElementById(x)}var metric=true;' +
      'function calc(){var h=+$("h").value,w=+$("w").value,b=metric?w/Math.pow(h/100,2):703*w/Math.pow(h,2);if(!isFinite(b)||b<=0){$("b").textContent="–";$("c").textContent="";return}' +
      '$("b").textContent=b.toFixed(1);var c=b<18.5?["Underweight","#d9a400"]:b<25?["Healthy range","#2e9e5b"]:b<30?["Overweight","#d9a400"]:["Obese","#c94242"];$("c").textContent=c[0];$("c").style.color=c[1]}' +
      'function mode(m){metric=m;$("mt").className=m?"primary":"";$("im").className=m?"":"primary";$("hl").textContent=m?"Height (cm)":"Height (in)";$("wl").textContent=m?"Weight (kg)":"Weight (lb)";$("h").value=m?170:67;$("w").value=m?65:143;calc()}' +
      '$("mt").onclick=function(){mode(true)};$("im").onclick=function(){mode(false)};$("h").oninput=$("w").oninput=calc;calc();');
  };

  T.memory = function (p) {
    var pairs = p.n && p.n >= 4 && p.n <= 12 ? p.n : 8;
    return page(p, '.g{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.c{aspect-ratio:1;font-size:30px;padding:0;display:grid;place-items:center}.c.up{background:var(--bg)}.c.ok{border-color:var(--accent);opacity:.7}',
      '<div class="row"><span class="muted" id="s"></span><button id="r" style="flex:0">New game</button></div><div class="g" id="g" style="margin-top:12px"></div>',
      'var E=["🍎","🐶","🚀","🌵","🎈","⚽","🍕","🎸","🐢","🌙","🍩","🦊"],n=' + pairs + ',best=S.get("best",0),cards,open,moves,found,lock;' +
      'function start(){var a=E.slice(0,n);a=a.concat(a);for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1)),t=a[i];a[i]=a[j];a[j]=t}cards=a;open=[];moves=0;found=0;lock=false;draw()}' +
      'function draw(){var g=document.getElementById("g");g.innerHTML="";cards.forEach(function(e,i){var b=document.createElement("button");b.className="c";b.dataset.i=i;b.textContent="";b.onclick=function(){flip(b,i)};g.appendChild(b)});stat()}' +
      'function stat(){document.getElementById("s").textContent="Moves "+moves+(best?" · Best "+best:"")}' +
      'function flip(b,i){if(lock||b.classList.contains("up"))return;b.classList.add("up");b.textContent=cards[i];open.push(b);if(open.length<2)return;moves++;var x=open[0],y=open[1];open=[];' +
      'if(cards[x.dataset.i]===cards[y.dataset.i]){x.classList.add("ok");y.classList.add("ok");found++;if(found===n){if(!best||moves<best){best=moves;S.set("best",best)}setTimeout(function(){alert("You won in "+moves+" moves!")},150)}stat()}' +
      'else{lock=true;setTimeout(function(){[x,y].forEach(function(c){c.classList.remove("up");c.textContent=""});lock=false;stat()},700)}}' +
      'document.getElementById("r").onclick=start;start();');
  };

  T.clicker = function (p) {
    return page(p, '.tap{width:180px;height:180px;border-radius:50%;margin:10px auto;display:block;font-size:56px;background:var(--accent);border:none;color:#fff}.u{display:flex;justify-content:space-between;align-items:center;margin-top:8px}',
      '<div class="card" style="text-align:center"><div class="big" id="c">0</div><div class="muted" id="r"></div><button class="tap" id="t">✦</button></div><div class="card" id="u"></div>',
      'var st=S.get("st",{c:0,per:1,auto:0,ups:[0,0,0]}),U=[["Stronger tap",15,function(){st.per+=1}],["Helper",50,function(){st.auto+=1}],["Factory",400,function(){st.auto+=8}]];' +
      'function cost(i){return Math.round(U[i][1]*Math.pow(1.4,st.ups[i]))}' +
      'function draw(){document.getElementById("c").textContent=Math.floor(st.c);document.getElementById("r").textContent=st.per+" per tap · "+st.auto+" per second";' +
      'var u=document.getElementById("u");u.innerHTML="";U.forEach(function(x,i){var r=document.createElement("div");r.className="u";var s=document.createElement("span");s.textContent=x[0]+" ("+st.ups[i]+")";var b=document.createElement("button");b.textContent=cost(i);b.disabled=st.c<cost(i);' +
      'b.onclick=function(){if(st.c>=cost(i)){st.c-=cost(i);st.ups[i]++;x[2]();S.set("st",st);draw()}};r.append(s,b);u.appendChild(r)})}' +
      'document.getElementById("t").onclick=function(){st.c+=st.per;S.set("st",st);draw()};setInterval(function(){if(st.auto){st.c+=st.auto/4;S.set("st",st);draw()}},250);draw();');
  };

  T.drawing = function (p) {
    return page(p, 'canvas{width:100%;height:60vh;background:#fff;border-radius:12px;touch-action:none;display:block}.tools{display:flex;gap:8px;margin-top:10px;align-items:center}.tools input[type=color]{width:48px;height:42px;padding:2px}',
      '<canvas id="c"></canvas><div class="tools"><input type="color" id="col" value="' + p.accent + '"><input type="range" id="sz" min="1" max="40" value="6"><button id="u">Undo</button><button id="x">Clear</button>' +
      (p.extras ? '<button id="sv">Save PNG</button>' : '') + '</div>',
      'var c=document.getElementById("c"),g=c.getContext("2d"),strokes=[],cur=null;' +
      'function size(){var r=c.getBoundingClientRect(),d=window.devicePixelRatio||1;c.width=r.width*d;c.height=r.height*d;g.setTransform(d,0,0,d,0,0);redraw()}' +
      'function redraw(){g.clearRect(0,0,c.width,c.height);strokes.forEach(line)}' +
      'function line(s){g.strokeStyle=s.c;g.lineWidth=s.w;g.lineCap=g.lineJoin="round";g.beginPath();s.p.forEach(function(q,i){i?g.lineTo(q[0],q[1]):g.moveTo(q[0],q[1])});if(s.p.length===1)g.lineTo(s.p[0][0]+.1,s.p[0][1]);g.stroke()}' +
      'function pt(e){var r=c.getBoundingClientRect();return[e.clientX-r.left,e.clientY-r.top]}' +
      'c.onpointerdown=function(e){c.setPointerCapture(e.pointerId);cur={c:document.getElementById("col").value,w:+document.getElementById("sz").value,p:[pt(e)]};strokes.push(cur);line(cur)};' +
      'c.onpointermove=function(e){if(!cur)return;cur.p.push(pt(e));line(cur)};c.onpointerup=c.onpointercancel=function(){cur=null};' +
      'document.getElementById("u").onclick=function(){strokes.pop();redraw()};document.getElementById("x").onclick=function(){strokes=[];redraw()};' +
      'var sv=document.getElementById("sv");if(sv)sv.onclick=function(){var a=document.createElement("a");a.download="drawing.png";a.href=c.toDataURL();a.click()};' +
      'window.addEventListener("resize",size);size();');
  };

  T.expense = function (p) {
    return page(p, '.e{display:flex;gap:8px;padding:8px 0;border-bottom:1px solid var(--line)}.e span:first-child{flex:1}.neg{color:#c94242}.pos{color:#2e9e5b}',
      '<div class="card" style="text-align:center"><div class="muted">Balance</div><div class="big" id="b">0.00</div><div class="row muted"><span id="in"></span><span id="out"></span></div></div>' +
      '<div class="card"><form id="f"><input id="d" placeholder="Description" required><div class="row" style="margin-top:8px"><input id="a" type="number" step="0.01" placeholder="Amount" required>' +
      '<select id="k"><option value="-1">Expense</option><option value="1">Income</option></select></div><button class="primary" style="width:100%;margin-top:8px">Add</button></form></div><div class="card" id="l"></div>',
      'var E=S.get("e",[]);function f(x){return x.toFixed(2)}' +
      'function draw(){var tot=0,i=0,o=0,l=document.getElementById("l");l.innerHTML=E.length?"":"<p class=muted>No entries yet.</p>";' +
      'E.forEach(function(e,j){tot+=e.v;if(e.v>0)i+=e.v;else o-=e.v;var r=document.createElement("div");r.className="e";var a=document.createElement("span");a.textContent=e.d+" · "+new Date(e.t).toLocaleDateString();' +
      'var b=document.createElement("span");b.className=e.v<0?"neg":"pos";b.textContent=(e.v<0?"−":"+")+f(Math.abs(e.v));var x=document.createElement("button");x.textContent="×";x.style.padding="0 10px";' +
      'x.onclick=function(){E.splice(j,1);S.set("e",E);draw()};r.append(a,b,x);l.appendChild(r)});' +
      'document.getElementById("b").textContent=f(tot);document.getElementById("in").textContent="In "+f(i);document.getElementById("out").textContent="Out "+f(o)}' +
      'document.getElementById("f").onsubmit=function(ev){ev.preventDefault();var a=+document.getElementById("a").value;if(!a)return;E.unshift({d:document.getElementById("d").value,v:Math.abs(a)*+document.getElementById("k").value,t:Date.now()});' +
      'S.set("e",E);this.reset();draw()};draw();');
  };

  T.countdown = function (p) {
    var d = new Date(); d.setDate(d.getDate() + (p.n && p.n > 0 && p.n < 3650 ? p.n : 30));
    var def = d.toISOString().slice(0, 10);
    return page(p, '.u{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;text-align:center}.u b{display:block;font-size:34px;font-variant-numeric:tabular-nums}.u span{font-size:12px;color:var(--muted)}',
      '<div class="card"><label>Event</label><input id="n" value="' + esc(p.topic || 'The big day') + '"><label>Date</label><input id="d" type="date" value="' + def + '"></div>' +
      '<div class="card"><p id="t" style="text-align:center;font-weight:600;margin:0 0 10px"></p><div class="u"><div><b id="dd">0</b><span>days</span></div><div><b id="hh">0</b><span>hours</span></div><div><b id="mm">0</b><span>min</span></div><div><b id="ss">0</b><span>sec</span></div></div></div>',
      'function $(x){return document.getElementById(x)}$("n").value=S.get("n",$("n").value);$("d").value=S.get("d",$("d").value);' +
      '$("n").oninput=function(){S.set("n",$("n").value);tick()};$("d").onchange=function(){S.set("d",$("d").value);tick()};' +
      'function tick(){var t=new Date($("d").value+"T00:00:00")-new Date(),past=t<0;t=Math.abs(t)/1000;$("dd").textContent=Math.floor(t/86400);$("hh").textContent=Math.floor(t/3600)%24;' +
      '$("mm").textContent=Math.floor(t/60)%60;$("ss").textContent=Math.floor(t)%60;$("t").textContent=$("n").value+(past?" was":" is in")}setInterval(tick,1000);tick();');
  };

  T.landing = function (p) {
    var name = p.topic || p.title;
    return page(p, '.hero{padding:34px 0 18px}.hero p{font-size:18px;color:var(--muted)}.f{display:grid;grid-template-columns:1fr 1fr;gap:10px}.f .card h3{margin:0 0 4px;font-size:16px}.f .card p{margin:0;font-size:14px;color:var(--muted)}',
      '<section class="hero"><p>Welcome to ' + esc(name) + '. Edit this text to say what you do and why people should care.</p>' +
      '<div class="row" style="max-width:320px"><button class="primary" id="cta">Get in touch</button><button id="more">Learn more</button></div></section>' +
      '<section class="f" id="feat"><div class="card"><h3>What we do</h3><p>A short line about the main thing you offer.</p></div><div class="card"><h3>Why us</h3><p>One reason people pick you.</p></div>' +
      '<div class="card"><h3>Where</h3><p>Your town, or online.</p></div><div class="card"><h3>When</h3><p>Opening hours or availability.</p></div></section>' +
      '<div class="card" id="contact" style="display:none;margin-top:12px"><label>Your email</label><input id="em" type="email" placeholder="you@example.com"><label>Message</label><textarea id="ms"></textarea>' +
      '<button class="primary" id="send" style="margin-top:8px;width:100%">Send</button><p class="muted" id="ok"></p></div>',
      'document.getElementById("cta").onclick=function(){var c=document.getElementById("contact");c.style.display="block";c.scrollIntoView({behavior:"smooth"})};' +
      'document.getElementById("more").onclick=function(){document.getElementById("feat").scrollIntoView({behavior:"smooth"})};' +
      'document.getElementById("send").onclick=function(){var m=S.get("msgs",[]);m.push({e:document.getElementById("em").value,m:document.getElementById("ms").value,t:Date.now()});S.set("msgs",m);' +
      'document.getElementById("ok").textContent="Saved on this device. Hook this form up to your own email service to receive messages."};');
  };

  T.snake = function (p) {
    return page(p, 'canvas{width:100%;max-width:400px;aspect-ratio:1;display:block;margin:0 auto;background:var(--card);border:1px solid var(--line);border-radius:12px;touch-action:none}' +
      '.pad{display:grid;grid-template-columns:repeat(3,64px);gap:6px;justify-content:center;margin-top:12px}.pad button{height:56px;font-size:22px}',
      '<div class="row"><span id="s">Score 0</span><span class="muted" id="b" style="text-align:right"></span></div><canvas id="c" width="400" height="400" style="margin-top:8px"></canvas>' +
      '<div class="pad"><span></span><button data-d="0,-1">▲</button><span></span><button data-d="-1,0">◀</button><button id="go" class="primary">▶︎</button><button data-d="1,0">▶</button><span></span><button data-d="0,1">▼</button><span></span></div>',
      'var c=document.getElementById("c"),g=c.getContext("2d"),N=20,Z=20,sn,dir,nd,food,score,best=S.get("best",0),t,alive=false;' +
      'var col=getComputedStyle(document.documentElement).getPropertyValue("--accent").trim()||"#3b82f6";' +
      'function place(){do{food=[Math.floor(Math.random()*N),Math.floor(Math.random()*N)]}while(sn.some(function(s){return s[0]===food[0]&&s[1]===food[1]}))}' +
      'function start(){sn=[[10,10],[9,10],[8,10]];dir=[1,0];nd=dir;score=0;place();alive=true;clearInterval(t);t=setInterval(step,' + (p.extras ? 110 : 140) + ');draw()}' +
      'function step(){dir=nd;var h=[sn[0][0]+dir[0],sn[0][1]+dir[1]];if(h[0]<0||h[1]<0||h[0]>=N||h[1]>=N||sn.some(function(s){return s[0]===h[0]&&s[1]===h[1]})){alive=false;clearInterval(t);if(score>best){best=score;S.set("best",best)}draw();return}' +
      'sn.unshift(h);if(h[0]===food[0]&&h[1]===food[1]){score++;place()}else sn.pop();draw()}' +
      'function draw(){g.clearRect(0,0,400,400);g.fillStyle="#e5484d";g.fillRect(food[0]*Z+3,food[1]*Z+3,Z-6,Z-6);g.fillStyle=col;sn.forEach(function(s){g.fillRect(s[0]*Z+1,s[1]*Z+1,Z-2,Z-2)});' +
      'document.getElementById("s").textContent="Score "+score;document.getElementById("b").textContent="Best "+best;if(!alive){g.fillStyle="rgba(0,0,0,.55)";g.fillRect(0,0,400,400);g.fillStyle="#fff";g.font="22px sans-serif";g.textAlign="center";g.fillText("Tap ▶︎ to play",200,205)}}' +
      'function turn(x,y){if(x===-dir[0]&&y===-dir[1])return;nd=[x,y]}' +
      'Array.prototype.forEach.call(document.querySelectorAll("[data-d]"),function(b){b.onclick=function(){var d=b.getAttribute("data-d").split(",");turn(+d[0],+d[1])}});' +
      'document.getElementById("go").onclick=start;document.addEventListener("keydown",function(e){var k={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0]}[e.key];if(k){e.preventDefault();turn(k[0],k[1])}});' +
      'var sx,sy;c.addEventListener("touchstart",function(e){sx=e.touches[0].clientX;sy=e.touches[0].clientY},{passive:true});' +
      'c.addEventListener("touchend",function(e){var dx=e.changedTouches[0].clientX-sx,dy=e.changedTouches[0].clientY-sy;if(Math.abs(dx)+Math.abs(dy)<20)return;if(Math.abs(dx)>Math.abs(dy))turn(dx>0?1:-1,0);else turn(0,dy>0?1:-1)});' +
      'sn=[[10,10],[9,10],[8,10]];dir=[1,0];score=0;place();draw();');
  };

  T.breathing = function (p) {
    return page(p, '.orb{width:200px;height:200px;border-radius:50%;margin:24px auto;background:var(--accent);opacity:.85;transform:scale(.55);transition:transform 4s ease-in-out}' +
      '.ph{text-align:center;font-size:22px;font-weight:600;min-height:30px}',
      '<div class="card"><label>Pattern</label><select id="m"><option value="4,4,4,4">Box 4-4-4-4</option><option value="4,7,8,0">4-7-8</option><option value="5,0,5,0">Even 5-5</option></select>' +
      '<div class="orb" id="o"></div><div class="ph" id="p">Ready</div><p class="muted" id="n" style="text-align:center"></p><button class="primary" id="s" style="width:100%">Start</button></div>',
      'var o=document.getElementById("o"),ph=document.getElementById("p"),run=false,tm,cycles=0;' +
      'function seq(){return document.getElementById("m").value.split(",").map(Number)}' +
      'function phase(i){if(!run)return;var s=seq(),names=["Breathe in","Hold","Breathe out","Hold"];if(!s[i]){next(i);return}' +
      'ph.textContent=names[i]+" · "+s[i];o.style.transitionDuration=s[i]+"s";if(i===0)o.style.transform="scale(1)";if(i===2)o.style.transform="scale(.55)";' +
      'var left=s[i];tm=setInterval(function(){left--;if(left>0)ph.textContent=names[i]+" · "+left;else{clearInterval(tm);next(i)}},1000)}' +
      'function next(i){if(i===3){cycles++;document.getElementById("n").textContent=cycles+" cycles"}phase((i+1)%4)}' +
      'document.getElementById("s").onclick=function(){run=!run;clearInterval(tm);this.textContent=run?"Stop":"Start";if(run)phase(0);else{ph.textContent="Ready";o.style.transform="scale(.55)"}};');
  };

  window.HubTemplates = { render: function (type, p) { return T[type](p); }, types: Object.keys(T), esc: esc };
})();
