/** Breakout. Drag anywhere on the board to move the paddle. */
(function () {
    'use strict';

    var COLS = 7, ROWS = 5;

    GameUtil.register({
        id: 'breakout',
        name: 'Breakout',
        emoji: '🧱',
        desc: 'Drag the paddle, clear the wall. Three lives.',
        mount: mount
    });

    function mount(host, api) {
        host.innerHTML = '';
        var canvas = document.createElement('canvas');
        host.appendChild(canvas);
        var size = GameUtil.fitCanvas(canvas, 1.35);
        var ctx = size.ctx;
        var W = size.w, H = size.h;

        var msg = GameUtil.msg(host, 'Drag to move - tap to launch');

        var paddle = { w: W * 0.24, h: 12, x: W / 2 };
        var ball, bricks, lives, score, running, raf, last;

        function reset(full) {
            if (full) {
                score = 0;
                lives = 3;
                bricks = [];
                for (var r = 0; r < ROWS; r++) {
                    for (var c = 0; c < COLS; c++) {
                        bricks.push({ r: r, c: c, alive: true });
                    }
                }
            }
            ball = { x: paddle.x, y: H - 46, vx: 0, vy: 0, r: Math.max(5, W * 0.018) };
            running = false;
            api.setScore(score + '  ♥' + lives);
        }

        function launch() {
            if (running) return;
            var speed = H * 0.0009;
            ball.vx = (Math.random() < 0.5 ? -1 : 1) * speed * 0.55;
            ball.vy = -speed;
            running = true;
            msg.textContent = 'Keep it up';
        }

        function brickBox(b) {
            var pad = 6;
            var bw = (W - pad * (COLS + 1)) / COLS;
            var bh = H * 0.045;
            return {
                x: pad + b.c * (bw + pad),
                y: 34 + b.r * (bh + pad),
                w: bw,
                h: bh
            };
        }

        function step(dt) {
            if (!running) {
                ball.x = paddle.x;
                return;
            }
            ball.x += ball.vx * dt;
            ball.y += ball.vy * dt;

            if (ball.x < ball.r) { ball.x = ball.r; ball.vx *= -1; }
            if (ball.x > W - ball.r) { ball.x = W - ball.r; ball.vx *= -1; }
            if (ball.y < ball.r) { ball.y = ball.r; ball.vy *= -1; }

            // paddle
            var py = H - 26;
            if (ball.vy > 0 && ball.y + ball.r >= py && ball.y < py + paddle.h + 8 &&
                Math.abs(ball.x - paddle.x) < paddle.w / 2 + ball.r) {
                ball.y = py - ball.r;
                ball.vy *= -1;
                // steer by where it hit
                ball.vx += (ball.x - paddle.x) / (paddle.w / 2) * 0.12;
            }

            // bricks
            for (var i = 0; i < bricks.length; i++) {
                var b = bricks[i];
                if (!b.alive) continue;
                var box = brickBox(b);
                if (ball.x > box.x - ball.r && ball.x < box.x + box.w + ball.r &&
                    ball.y > box.y - ball.r && ball.y < box.y + box.h + ball.r) {
                    b.alive = false;
                    score += 10;
                    api.setScore(score + '  ♥' + lives);
                    var fromSide =
                        ball.x < box.x || ball.x > box.x + box.w;
                    if (fromSide) ball.vx *= -1; else ball.vy *= -1;
                    break;
                }
            }

            if (!bricks.some(function (b) { return b.alive; })) {
                msg.textContent = 'Wall cleared. Tap for a fresh one.';
                running = false;
                reset(true);
                return;
            }

            if (ball.y > H + 20) {
                lives -= 1;
                if (lives <= 0) {
                    msg.textContent = 'Out of lives - tap to start over. Score ' + score;
                    reset(true);
                } else {
                    msg.textContent = 'Tap to launch - ' + lives + ' left';
                    reset(false);
                }
            }
        }

        function draw() {
            ctx.fillStyle = '#0d1023';
            ctx.fillRect(0, 0, W, H);

            var colors = ['#e12c3c', '#e1683c', '#c33f7c', '#6b7dff', '#35d09a'];
            bricks.forEach(function (b) {
                if (!b.alive) return;
                var box = brickBox(b);
                ctx.fillStyle = colors[b.r % colors.length];
                ctx.globalAlpha = 0.92;
                rect(box.x, box.y, box.w, box.h, 4);
            });
            ctx.globalAlpha = 1;

            ctx.fillStyle = '#f2f4ff';
            rect(paddle.x - paddle.w / 2, H - 26, paddle.w, paddle.h, 6);

            ctx.beginPath();
            ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
            ctx.fillStyle = '#ffd166';
            ctx.fill();
        }

        function rect(x, y, w, h, r) {
            ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
            ctx.fill();
        }

        function loop(ts) {
            raf = requestAnimationFrame(loop);
            if (!last) last = ts;
            var dt = Math.min(34, ts - last);
            last = ts;
            step(dt);
            draw();
        }

        function pointer(e) {
            var t = e.touches ? e.touches[0] : e;
            var box = canvas.getBoundingClientRect();
            paddle.x = Math.max(paddle.w / 2,
                Math.min(W - paddle.w / 2, t.clientX - box.left));
            if (e.cancelable) e.preventDefault();
        }

        canvas.addEventListener('touchstart', pointer, { passive: false });
        canvas.addEventListener('touchmove', pointer, { passive: false });
        canvas.addEventListener('mousemove', pointer);
        canvas.addEventListener('click', launch);
        canvas.addEventListener('touchend', launch);

        GameUtil.bar(host, [{ label: 'Restart', onClick: function () { reset(true); } }]);

        reset(true);
        raf = requestAnimationFrame(loop);

        return function destroy() {
            cancelAnimationFrame(raf);
            canvas.removeEventListener('touchstart', pointer);
            canvas.removeEventListener('touchmove', pointer);
            canvas.removeEventListener('mousemove', pointer);
            canvas.removeEventListener('click', launch);
            canvas.removeEventListener('touchend', launch);
        };
    }
})();
