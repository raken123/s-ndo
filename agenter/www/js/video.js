/* Video, made out of HTML.
 *
 * A spec becomes a standalone document: a canvas timeline that plays scenes, and
 * a Record button that runs canvas.captureStream() through MediaRecorder so the
 * page hands back a real .webm. No frames are rendered here — the generated
 * document is the video, and it is self-contained. Pro only. */
window.AGENTER = window.AGENTER || {};

(function () {
  'use strict';

  var PALETTES = [
    ['#4f46e5', '#06b6d4'], ['#db2777', '#f59e0b'], ['#059669', '#84cc16'],
    ['#7c3aed', '#ec4899'], ['#0ea5e9', '#22d3ee'], ['#ea580c', '#facc15']
  ];

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  /* Pull a title and beats out of whatever the user asked for. */
  function specFromPrompt(prompt) {
    var clean = String(prompt || '').trim();
    var title = clean.replace(/^(make|create|build|generate|do)\s+(me\s+)?(an?\s+)?/i, '')
                     .replace(/\bvideos?\b\s*(of|about|for|showing)?\s*/i, '')
                     .replace(/[.!?]+$/, '').trim();
    if (!title) title = 'Made with Agenter';
    if (title.length > 58) title = title.slice(0, 55).trim() + '…';

    var beats = clean.split(/[\n;]|(?:,\s)|(?:\.\s)/)
                     .map(function (s) { return s.trim(); })
                     .filter(function (s) { return s.length > 3; })
                     .slice(0, 5);
    if (beats.length < 3) beats = [title, 'Rendered in the browser', 'No plugins, no export step'];

    return {
      title: title,
      scenes: beats.map(function (b, i) {
        return {
          text: b.length > 62 ? b.slice(0, 59).trim() + '…' : b,
          palette: PALETTES[i % PALETTES.length]
        };
      }),
      secondsPerScene: 3.2
    };
  }

  function buildHTML(spec) {
    var scenes = JSON.stringify(spec.scenes);
    var per = Number(spec.secondsPerScene) || 3.2;

    return '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n' +
'<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
'<title>' + esc(spec.title) + '</title>\n<style>\n' +
'*{margin:0;padding:0;box-sizing:border-box}\n' +
'body{background:#05070d;color:#e8ecf7;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;\n' +
'  min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:16px}\n' +
'canvas{width:100%;max-width:960px;aspect-ratio:16/9;border-radius:12px;display:block;background:#000;\n' +
'  box-shadow:0 20px 60px rgba(0,0,0,.6)}\n' +
'.bar{width:100%;max-width:960px;display:flex;gap:10px;align-items:center}\n' +
'button{border:1px solid #232c45;background:#121727;color:#e8ecf7;border-radius:9px;padding:9px 16px;\n' +
'  font-size:13px;font-weight:600;cursor:pointer;font-family:inherit}\n' +
'button:hover{border-color:#6366f1}button:disabled{opacity:.45;cursor:default}\n' +
'.track{flex:1;height:5px;background:#232c45;border-radius:3px;overflow:hidden}\n' +
'.track i{display:block;height:100%;width:0;background:linear-gradient(90deg,#6366f1,#22d3ee)}\n' +
'.note{font-size:11.5px;color:#93a0bd;max-width:960px;text-align:center;line-height:1.6}\n' +
'</style>\n</head>\n<body>\n' +
'<canvas id="v" width="1280" height="720"></canvas>\n' +
'<div class="bar">\n' +
'  <button id="play">⏸ Pause</button>\n' +
'  <div class="track"><i id="fill"></i></div>\n' +
'  <button id="rec">● Record .webm</button>\n' +
'</div>\n' +
'<p class="note">This file is the video. It plays on a canvas; Record captures the same\n' +
'canvas through MediaRecorder and downloads a .webm. Nothing is fetched at runtime.</p>\n' +
'<script>\n' +
'(function(){\n' +
'var SCENES=' + scenes + ',PER=' + per + ',TOTAL=SCENES.length*PER;\n' +
'var cv=document.getElementById("v"),cx=cv.getContext("2d"),W=cv.width,H=cv.height;\n' +
'var playing=true,t=0,last=performance.now();\n' +
'var stars=[];for(var i=0;i<90;i++)stars.push({x:Math.random()*W,y:Math.random()*H,\n' +
'  r:Math.random()*2.2+.4,s:Math.random()*14+4,a:Math.random()*.5+.15});\n' +
'\n' +
'function mix(a,b,k){\n' +
'  var pa=parseInt(a.slice(1),16),pb=parseInt(b.slice(1),16);\n' +
'  var r=Math.round((pa>>16)+(((pb>>16)-(pa>>16))*k));\n' +
'  var g=Math.round(((pa>>8)&255)+((((pb>>8)&255)-((pa>>8)&255))*k));\n' +
'  var bl=Math.round((pa&255)+(((pb&255)-(pa&255))*k));\n' +
'  return "rgb("+r+","+g+","+bl+")";\n' +
'}\n' +
'function ease(k){return k<.5?4*k*k*k:1-Math.pow(-2*k+2,3)/2;}\n' +
'\n' +
'function draw(){\n' +
'  var idx=Math.min(SCENES.length-1,Math.floor(t/PER)),local=(t-idx*PER)/PER;\n' +
'  var nxt=SCENES[Math.min(SCENES.length-1,idx+1)],cur=SCENES[idx];\n' +
'  var blend=local>.82?ease((local-.82)/.18):0;\n' +
'  var c0=mix(cur.palette[0],nxt.palette[0],blend),c1=mix(cur.palette[1],nxt.palette[1],blend);\n' +
'\n' +
'  var g=cx.createLinearGradient(0,0,W,H);g.addColorStop(0,c0);g.addColorStop(1,c1);\n' +
'  cx.fillStyle=g;cx.fillRect(0,0,W,H);\n' +
'\n' +
'  cx.save();cx.globalCompositeOperation="screen";\n' +
'  for(var i=0;i<stars.length;i++){var s=stars[i];\n' +
'    var y=(s.y-t*s.s)%H;if(y<0)y+=H;\n' +
'    cx.globalAlpha=s.a;cx.fillStyle="#fff";\n' +
'    cx.beginPath();cx.arc(s.x,y,s.r,0,6.2832);cx.fill();}\n' +
'  cx.restore();cx.globalAlpha=1;\n' +
'\n' +
'  var pulse=40+Math.sin(t*1.6)*10;\n' +
'  cx.save();cx.globalCompositeOperation="overlay";cx.globalAlpha=.35;\n' +
'  cx.beginPath();cx.arc(W*.5,H*.5,H*.55+pulse,0,6.2832);\n' +
'  cx.fillStyle="rgba(0,0,0,.55)";cx.fill();cx.restore();cx.globalAlpha=1;\n' +
'\n' +
'  var inK=Math.min(1,local/.18),outK=local>.86?1-(local-.86)/.14:1;\n' +
'  var alpha=Math.max(0,Math.min(inK,outK)),lift=(1-ease(inK))*46;\n' +
'  cx.globalAlpha=alpha;\n' +
'  cx.textAlign="center";cx.textBaseline="middle";\n' +
'  cx.shadowColor="rgba(0,0,0,.45)";cx.shadowBlur=26;cx.shadowOffsetY=6;\n' +
'  cx.fillStyle="#fff";\n' +
'  cx.font="700 66px -apple-system,Segoe UI,Roboto,sans-serif";\n' +
'  wrap(cur.text,W/2,H/2+lift,W*.8,78);\n' +
'  cx.shadowBlur=0;cx.shadowOffsetY=0;\n' +
'  cx.globalAlpha=alpha*.75;\n' +
'  cx.font="500 26px -apple-system,Segoe UI,Roboto,sans-serif";\n' +
'  cx.fillText((idx+1)+" / "+SCENES.length,W/2,H-64+lift);\n' +
'  cx.globalAlpha=1;\n' +
'\n' +
'  cx.fillStyle="rgba(255,255,255,.85)";\n' +
'  cx.fillRect(0,H-6,W*(t/TOTAL),6);\n' +
'}\n' +
'function wrap(text,x,y,max,lh){\n' +
'  var words=String(text).split(" "),line="",lines=[];\n' +
'  for(var i=0;i<words.length;i++){var probe=line?line+" "+words[i]:words[i];\n' +
'    if(cx.measureText(probe).width>max&&line){lines.push(line);line=words[i];}else line=probe;}\n' +
'  if(line)lines.push(line);\n' +
'  var start=y-(lines.length-1)*lh/2;\n' +
'  for(var j=0;j<lines.length;j++)cx.fillText(lines[j],x,start+j*lh);\n' +
'}\n' +
'\n' +
'var fill=document.getElementById("fill"),playBtn=document.getElementById("play");\n' +
'function loop(now){\n' +
'  var dt=Math.min(.05,(now-last)/1000);last=now;\n' +
'  if(playing){t+=dt;if(t>=TOTAL)t=0;}\n' +
'  draw();fill.style.width=(t/TOTAL*100)+"%";\n' +
'  requestAnimationFrame(loop);\n' +
'}\n' +
'requestAnimationFrame(function(n){last=n;loop(n);});\n' +
'playBtn.onclick=function(){playing=!playing;playBtn.textContent=playing?"⏸ Pause":"▶ Play";};\n' +
'\n' +
'var recBtn=document.getElementById("rec"),mr=null,chunks=[];\n' +
'recBtn.onclick=function(){\n' +
'  if(mr){mr.stop();return;}\n' +
'  if(!cv.captureStream||typeof MediaRecorder==="undefined"){\n' +
'    recBtn.disabled=true;recBtn.textContent="Recording unsupported here";return;}\n' +
'  var types=["video/webm;codecs=vp9","video/webm;codecs=vp8","video/webm"],pick="";\n' +
'  for(var i=0;i<types.length;i++){if(MediaRecorder.isTypeSupported(types[i])){pick=types[i];break;}}\n' +
'  if(!pick){recBtn.disabled=true;recBtn.textContent="No webm encoder";return;}\n' +
'  chunks=[];t=0;playing=true;playBtn.textContent="⏸ Pause";\n' +
'  mr=new MediaRecorder(cv.captureStream(30),{mimeType:pick,videoBitsPerSecond:6000000});\n' +
'  mr.ondataavailable=function(e){if(e.data.size)chunks.push(e.data);};\n' +
'  mr.onstop=function(){\n' +
'    var blob=new Blob(chunks,{type:"video/webm"}),url=URL.createObjectURL(blob);\n' +
'    var a=document.createElement("a");a.href=url;\n' +
'    a.download=' + JSON.stringify(slug(spec.title)) + '+".webm";\n' +
'    document.body.appendChild(a);a.click();a.remove();\n' +
'    setTimeout(function(){URL.revokeObjectURL(url);},4000);\n' +
'    mr=null;recBtn.textContent="● Record .webm";};\n' +
'  mr.start();\n' +
'  recBtn.textContent="■ Stop ("+Math.round(TOTAL)+"s)";\n' +
'  setTimeout(function(){if(mr)mr.stop();},TOTAL*1000+250);\n' +
'};\n' +
'})();\n' +
'<\/script>\n</body>\n</html>\n';
  }

  function slug(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-')
                    .replace(/^-|-$/g, '').slice(0, 40) || 'agenter-video';
  }

  AGENTER.Video = {
    specFromPrompt: specFromPrompt,
    buildHTML: buildHTML,
    slug: slug
  };
})();
