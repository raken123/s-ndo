/* Creation types (app, animation, slides, card, 3D model, UI design, image,
 * ...): the catalog comes from Hub AI Cloud; this file holds what each type
 * needs in the app: which agents can make it, which tools apply, and its
 * exports (video for animations, SVG/PNG for logos and diagrams, the
 * picture for images; 3D models export from their own viewer).
 */
(function () {
  'use strict';

  function list() {
    var c = Store.get('cloud.config', null);
    return (c && c.kinds) || window.HUB_CLOUD_CONFIG.kinds;
  }
  function get(id) { return list().filter(function (k) { return k.id === id; })[0] || list()[0]; }
  function output(id) { return get(id).output; }

  // The agents that make this type: the picture agent for images, the
  // others for everything else.
  function engines(id) {
    var img = output(id) === 'image';
    return Plans.engines().filter(function (e) { return (e.makes === 'image') === img; });
  }

  var NOT_FOR = {
    image: ['a11y', 'editor', 'seo', 'dna', 'translate', 'autofix', 'security', 'pwa', 'source'],
    model3d: ['a11y', 'translate', 'autofix']
  };
  function toolOk(id, tool) { return (NOT_FOR[output(id)] || []).indexOf(tool) < 0; }

  function bytesOf(dataUrl) {
    var m = /^data:([^;,]+);base64,(.*)$/.exec(dataUrl || '');
    if (!m) return null;
    var bin = atob(m[2]), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return { mime: m[1], bytes: out };
  }
  function blobBytes(blob) {
    return blob.arrayBuffer ? blob.arrayBuffer().then(function (b) { return new Uint8Array(b); }) : new Promise(function (res) {
      var r = new FileReader(); r.onload = function () { res(new Uint8Array(r.result)); }; r.readAsArrayBuffer(blob);
    });
  }

  // ---------- ✒️ Logos and 🔀 diagrams: the <svg id="art"> ----------

  function svgOf(html) {
    var doc = new DOMParser().parseFromString(html, 'text/html');
    var s = doc.querySelector('svg#art') || doc.querySelector('svg');
    if (!s) return null;
    Array.prototype.forEach.call(s.querySelectorAll('script, foreignObject'), function (x) { x.remove(); });
    return new XMLSerializer().serializeToString(s);
  }

  function svgBox(svg) {
    var doc = new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement;
    var vb = (doc.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number);
    if (vb.length === 4 && vb[2] > 0 && vb[3] > 0) return [vb[2], vb[3]];
    var w = parseFloat(doc.getAttribute('width')), h = parseFloat(doc.getAttribute('height'));
    return w > 0 && h > 0 ? [w, h] : [1024, 1024];
  }

  // PNG of an SVG, longest side `size` pixels.
  function pngOf(svg, size) {
    var box = svgBox(svg), k = size / Math.max(box[0], box[1]), w = Math.round(box[0] * k), h = Math.round(box[1] * k);
    var sized = svg.replace(/<svg\b([^>]*)>/, function (m, attrs) {
      return '<svg' + attrs.replace(/\s(width|height)="[^"]*"/g, '') + ' width="' + w + '" height="' + h + '">';
    });
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        var c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        c.toBlob(function (b) { b ? blobBytes(b).then(resolve) : reject(new Error('Could not draw the PNG.')); }, 'image/png');
      };
      img.onerror = function () { reject(new Error('This SVG could not be drawn.')); };
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(sized);
    });
  }

  // ---------- 🖼️ Images ----------

  function imageOf(html) {
    var m = /<img id="art"[^>]*\ssrc="(data:image\/[a-z]+;base64,[^"]+)"/.exec(html || '');
    return m ? m[1] : null;
  }

  // A photo to edit, as a data: URL no bigger than `max` pixels a side.
  function readPhoto(file, max) {
    max = max || 2048;
    return new Promise(function (resolve, reject) {
      if (!/^image\/(png|jpeg|webp|gif|heic|heif)$/.test(file.type)) return reject(new Error('Use a PNG, JPEG or WebP photo.'));
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
        var c = document.createElement('canvas');
        c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        var png = file.type === 'image/png' && file.size < 3e6;
        resolve({ dataUrl: c.toDataURL(png ? 'image/png' : 'image/jpeg', 0.9), name: file.name, w: c.width, h: c.height });
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('Could not open that photo.')); };
      img.src = url;
    });
  }

  // ---------- 🎞️ Animations: record the canvas to video ----------
  // The hub records itself (its iframe is sandboxed, so the app can't reach
  // in) and posts the video back.

  var RECORDER = '<script>(function(){window.addEventListener("message",function(e){if(!e.data||e.data.type!=="hub-record")return;' +
    'function fail(m){parent.postMessage({type:"hub-record-error",error:m},"*")}' +
    'var c=document.getElementById("stage")||document.querySelector("canvas");if(!c||!c.captureStream)return fail("This animation has no canvas to record.");' +
    'if(typeof MediaRecorder==="undefined")return fail("This device cannot record video.");' +
    'var t=["video/mp4;codecs=avc1","video/webm;codecs=vp9","video/webm;codecs=vp8","video/webm"].filter(function(x){return MediaRecorder.isTypeSupported(x)})[0];' +
    'if(!t)return fail("This device cannot record video.");var r=new MediaRecorder(c.captureStream(30),{mimeType:t,videoBitsPerSecond:8e6}),parts=[];' +
    'r.ondataavailable=function(ev){if(ev.data.size)parts.push(ev.data)};r.onstop=function(){new Blob(parts,{type:t}).arrayBuffer().then(function(b){' +
    'parent.postMessage({type:"hub-record-done",mime:t.split(";")[0],data:b},"*",[b])})};r.start(500);setTimeout(function(){r.stop()},e.data.seconds*1000)})})();</script>';

  function inject(html, snippet) {
    var i = html.search(/<\/body>/i);
    return i < 0 ? html + snippet : html.slice(0, i) + snippet + html.slice(i);
  }

  // Records `seconds` of the animation at w x h CSS pixels inside `holder`
  // (it must stay on screen: hidden frames are throttled). Resolves to
  // {mime, bytes, ext}.
  function record(html, seconds, w, h, holder, frameFn) {
    return new Promise(function (resolve, reject) {
      var f = frameFn(inject(html, RECORDER), 'rec-frame');
      holder.innerHTML = ''; holder.appendChild(f);
      // Measure once the box shows: a frame scaled to nothing is never drawn.
      var scale = Math.min(1, (holder.clientWidth || 300) / w, 360 / h);
      f.style.cssText = 'width:' + w + 'px;height:' + h + 'px;border:0;transform:scale(' + scale + ');transform-origin:0 0;background:#000';
      holder.style.height = Math.round(h * scale) + 'px';
      var done = false, timer = setTimeout(function () { finish(new Error('Recording timed out.')); }, (seconds + 15) * 1000);
      function finish(err, out) {
        if (done) return;
        done = true; clearTimeout(timer); window.removeEventListener('message', onMsg);
        if (err) reject(err); else resolve(out);
      }
      function onMsg(e) {
        if (e.source !== f.contentWindow || !e.data) return;
        if (e.data.type === 'hub-record-error') finish(new Error(e.data.error));
        if (e.data.type === 'hub-record-done') {
          var mime = e.data.mime || 'video/webm';
          if (!e.data.data || !e.data.data.byteLength) return finish(new Error('Nothing was recorded. Try again with the screen on.'));
          finish(null, { mime: mime, bytes: new Uint8Array(e.data.data), ext: mime === 'video/mp4' ? 'mp4' : 'webm' });
        }
      }
      window.addEventListener('message', onMsg);
      f.onload = function () { setTimeout(function () { f.contentWindow.postMessage({ type: 'hub-record', seconds: seconds }, '*'); }, 400); };
    });
  }

  window.Kinds = {
    list: list, get: get, output: output, engines: engines, toolOk: toolOk,
    svgOf: svgOf, pngOf: pngOf, imageOf: imageOf, bytesOf: bytesOf, readPhoto: readPhoto, record: record
  };
})();
