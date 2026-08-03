/** Snake. Swipe to steer, tap to restart. */
(function () {
    'use strict';

    var CELLS = 17;

    GameUtil.register({
        id: 'snake',
        name: 'Snake',
        emoji: '🐍',
        desc: 'Old reliable. Gets faster the longer you last.',
        mount: mount
    });

    function mount(host, api) {
        host.innerHTML = '';
        var canvas = document.createElement('canvas');
        host.appendChild(canvas);
        var size = GameUtil.fitCanvas(canvas, 1);
        var ctx = size.ctx;
        var cell = size.w / CELLS;

        var msg = GameUtil.msg(host, 'Swipe to steer');

        var snake, dir, next, food, alive, score, step, acc, last, raf;

        function reset() {
            snake = [{ x: 8, y: 10 }, { x: 8, y: 11 }, { x: 8, y: 12 }];
            dir = { x: 0, y: -1 };
            next = dir;
            alive = true;
            score = 0;
            step = 190;
            acc = 0;
            last = 0;
            dropFood();
            api.setScore('0');
            msg.textContent = 'Swipe to steer';
        }

        function dropFood() {
            do {
                food = {
                    x: Math.floor(Math.random() * CELLS),
                    y: Math.floor(Math.random() * CELLS)
                };
            } while (snake.some(function (s) { return s.x === food.x && s.y === food.y; }));
        }

        function tick() {
            var head = { x: snake[0].x + next.x, y: snake[0].y + next.y };
            dir = next;

            if (head.x < 0 || head.y < 0 || head.x >= CELLS || head.y >= CELLS ||
                snake.some(function (s) { return s.x === head.x && s.y === head.y; })) {
                alive = false;
                msg.textContent = 'Gone. Tap to go again - score ' + score;
                return;
            }
            snake.unshift(head);
            if (head.x === food.x && head.y === food.y) {
                score += 1;
                api.setScore(String(score));
                step = Math.max(70, step - 5);
                dropFood();
            } else {
                snake.pop();
            }
        }

        function draw() {
            ctx.fillStyle = '#0d1023';
            ctx.fillRect(0, 0, size.w, size.h);

            ctx.fillStyle = '#e12c3c';
            round(food.x * cell + 2, food.y * cell + 2, cell - 4, 5);

            snake.forEach(function (s, i) {
                ctx.fillStyle = i === 0 ? '#8f9bff' : '#5a67d8';
                ctx.globalAlpha = i === 0 ? 1 : Math.max(0.35, 1 - i / (snake.length + 6));
                round(s.x * cell + 1.5, s.y * cell + 1.5, cell - 3, 5);
            });
            ctx.globalAlpha = 1;
        }

        function round(x, y, w, r) {
            ctx.beginPath();
            if (ctx.roundRect) {
                ctx.roundRect(x, y, w, w, r);
            } else {
                ctx.rect(x, y, w, w);
            }
            ctx.fill();
        }

        function loop(ts) {
            raf = requestAnimationFrame(loop);
            if (!last) last = ts;
            var dt = ts - last;
            last = ts;
            if (alive) {
                acc += dt;
                while (acc >= step) { acc -= step; tick(); }
            }
            draw();
        }

        var offSwipe = GameUtil.onSwipe(canvas, function (d) {
            if (!alive) {
                if (d === 'tap') reset();
                return;
            }
            var map = {
                up: { x: 0, y: -1 }, down: { x: 0, y: 1 },
                left: { x: -1, y: 0 }, right: { x: 1, y: 0 }
            };
            var n = map[d];
            if (n && (n.x !== -dir.x || n.y !== -dir.y)) next = n;
        });

        GameUtil.bar(host, [{ label: 'Restart', onClick: reset }]);

        reset();
        raf = requestAnimationFrame(loop);

        return function destroy() {
            cancelAnimationFrame(raf);
            offSwipe();
        };
    }
})();
