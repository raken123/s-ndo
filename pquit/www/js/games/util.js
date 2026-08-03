/** Shared bits for the mini games: canvas sizing, swipes, a game registry. */
(function (global) {
    'use strict';

    global.Games = global.Games || [];

    var Util = {
        /** Registers a game. mount(host, api) must return a teardown function. */
        register: function (game) { global.Games.push(game); },

        /** Sizes a canvas to its parent at the given height/width ratio, dpr-aware. */
        fitCanvas: function (canvas, ratio) {
            var host = canvas.parentNode;
            // clientWidth includes the host's padding, which the canvas must stay inside.
            var cs = global.getComputedStyle(host);
            var inset = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
            var w = Math.max(200, (host.clientWidth || 320) - (inset || 0));
            var maxH = (host.clientHeight || 480) - 70;
            var h = w * ratio;
            if (maxH > 120 && h > maxH) { h = maxH; w = h / ratio; }
            var dpr = Math.min(global.devicePixelRatio || 1, 2);
            canvas.style.width = Math.round(w) + 'px';
            canvas.style.height = Math.round(h) + 'px';
            canvas.style.margin = '0 auto';
            canvas.width = Math.round(w * dpr);
            canvas.height = Math.round(h * dpr);
            var ctx = canvas.getContext('2d');
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            return { w: w, h: h, ctx: ctx };
        },

        /** Calls back with 'up'|'down'|'left'|'right' on swipe, and 'tap'. */
        onSwipe: function (el, cb) {
            var sx = 0, sy = 0, st = 0, moved = false;

            function down(e) {
                var t = e.touches ? e.touches[0] : e;
                sx = t.clientX; sy = t.clientY; st = Date.now(); moved = false;
            }
            function move(e) {
                if (!st) return;
                e.preventDefault();
                var t = e.touches ? e.touches[0] : e;
                var dx = t.clientX - sx, dy = t.clientY - sy;
                if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;
                moved = true;
                st = 0;
                cb(Math.abs(dx) > Math.abs(dy)
                    ? (dx > 0 ? 'right' : 'left')
                    : (dy > 0 ? 'down' : 'up'));
            }
            function up() {
                if (st && !moved) cb('tap');
                st = 0;
            }

            el.addEventListener('touchstart', down, { passive: true });
            el.addEventListener('touchmove', move, { passive: false });
            el.addEventListener('touchend', up);
            el.addEventListener('mousedown', down);
            el.addEventListener('mousemove', move);
            el.addEventListener('mouseup', up);

            var keys = {
                ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
                w: 'up', s: 'down', a: 'left', d: 'right', ' ': 'tap'
            };
            function key(e) {
                if (keys[e.key]) { e.preventDefault(); cb(keys[e.key]); }
            }
            document.addEventListener('keydown', key);

            return function () {
                el.removeEventListener('touchstart', down);
                el.removeEventListener('touchmove', move);
                el.removeEventListener('touchend', up);
                el.removeEventListener('mousedown', down);
                el.removeEventListener('mousemove', move);
                el.removeEventListener('mouseup', up);
                document.removeEventListener('keydown', key);
            };
        },

        /** A row of buttons under the play area. */
        bar: function (host, buttons) {
            var wrap = document.createElement('div');
            wrap.className = 'game-bar';
            buttons.forEach(function (b) {
                var el = document.createElement('button');
                el.className = 'btn ghost';
                el.textContent = b.label;
                el.addEventListener('click', b.onClick);
                wrap.appendChild(el);
            });
            host.appendChild(wrap);
            return wrap;
        },

        msg: function (host, text) {
            var el = document.createElement('div');
            el.className = 'game-msg';
            el.textContent = text;
            host.appendChild(el);
            return el;
        }
    };

    global.GameUtil = Util;
})(window);
