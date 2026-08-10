/*
 * app.js -- screens, state and the loop that ties the prayer clock to the lock.
 *
 * Flow:  setup -> home (doomscroll freely) -> adhan fires -> locked
 *        -> follow the stickman -> checkmark -> unlocked -> home.
 */
(function () {
  'use strict';

  var STORE_KEY = 'addictstop.v1';
  var $ = function (id) { return document.getElementById(id); };

  var state = {
    settings: {
      latitude: null,
      longitude: null,
      method: 'MWL',
      madhab: 'standard',
      pace: 1,
      armed: false
    },
    log: {},            // "YYYY-MM-DD:key" -> { at, mode }
    status: {},         // last native status snapshot
    screen: null,
    session: null,
    locked: null,       // the prayer we are locked for
    timer: null,
    raf: null,
    lastFrame: 0,
    held: null
  };

  /* ------------------------------------------------------------------ store */

  function load() {
    try {
      var raw = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
      if (raw.settings) {
        Object.keys(raw.settings).forEach(function (k) {
          state.settings[k] = raw.settings[k];
        });
      }
      state.log = raw.log || {};
    } catch (e) {
      // Corrupt store: start clean rather than refusing to boot.
      state.log = {};
    }
  }

  function save() {
    localStorage.setItem(STORE_KEY, JSON.stringify({
      settings: state.settings,
      log: state.log
    }));
  }

  function configured() {
    return typeof state.settings.latitude === 'number' &&
      typeof state.settings.longitude === 'number';
  }

  /* ------------------------------------------------------------------- util */

  function pad(n) { return n < 10 ? '0' + n : String(n); }

  function clock(date) {
    return date ? pad(date.getHours()) + ':' + pad(date.getMinutes()) : '--:--';
  }

  function dayKey(date) {
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
  }

  function logKey(prayer) {
    return dayKey(prayer.at) + ':' + prayer.key;
  }

  function humanGap(ms) {
    var s = Math.max(0, Math.round(ms / 1000));
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    if (h > 0) return h + 'h ' + m + 'm';
    if (m > 0) return m + 'm';
    return s + 's';
  }

  function stopwatch(ms) {
    var s = Math.max(0, Math.round(ms / 1000));
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return h > 0 ? h + ':' + pad(m) + ':' + pad(sec) : m + ':' + pad(sec);
  }

  function buzz(pattern) {
    if (navigator.vibrate) {
      try { navigator.vibrate(pattern); } catch (e) { /* not fatal */ }
    }
  }

  var toastTimer = null;
  function toast(message) {
    var el = document.querySelector('.toast');
    if (el) el.remove();
    el = document.createElement('div');
    el.className = 'toast';
    el.textContent = message;
    document.body.appendChild(el);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.remove(); }, 3200);
  }

  function show(id) {
    ['screen-setup', 'screen-home', 'screen-locked', 'screen-salah', 'screen-done']
      .forEach(function (s) { $(s).hidden = s !== id; });
    state.screen = id;
  }

  /* --------------------------------------------------------------- prayers */

  function prayerSchedule() {
    return PrayerTimes.schedule(new Date(), state.settings);
  }

  function nextPrayer(now) {
    return PrayerTimes.next(now || new Date(), state.settings);
  }

  /*
   * The prayer you are inside the window of and have not dealt with yet.
   *
   * Once a window closes the lock lifts on its own: a missed prayer is between
   * you and God, and holding your phone hostage all afternoon over a Fajr that
   * expired at sunrise would just make people uninstall the app.
   */
  function outstandingPrayer(now) {
    now = now || new Date();
    var list = prayerSchedule();
    for (var i = list.length - 1; i >= 0; i--) {
      var p = list[i];
      if (p.at <= now && now < p.until) {
        return state.log[logKey(p)] ? null : p;
      }
    }
    return null;
  }

  function pushSchedule() {
    if (!configured()) return Promise.resolve();
    var now = new Date();
    var upcoming = prayerSchedule()
      .filter(function (p) { return p.at > now && !state.log[logKey(p)]; })
      .slice(0, 12)
      .map(function (p) {
        return { key: p.key, name: p.name, rakahs: p.rakahs, at: p.at.getTime() };
      });
    return Native.schedule(upcoming);
  }

  /* ------------------------------------------------------------ permissions */

  var PERMISSIONS = [
    {
      key: 'accessibility', which: 'accessibility',
      title: 'Block other apps',
      why: 'Accessibility service — lets AddictStop send you back here while the lock is on.'
    },
    {
      key: 'notifications', which: 'notifications',
      title: 'Call the adhan',
      why: 'Notifications — so the prayer alert can reach you.'
    },
    {
      key: 'exactAlarms', which: 'exactAlarms',
      title: 'Fire exactly on time',
      why: 'Alarms & reminders — a prayer time that drifts by 20 minutes is no use.'
    },
    {
      key: 'overlay', which: 'overlay',
      title: 'Come to the front',
      why: 'Display over other apps — needed to open this screen from the background.'
    },
    {
      key: 'batteryUnrestricted', which: 'battery',
      title: 'Survive doze',
      why: 'Unrestricted battery — otherwise Android may sit on the alarm.'
    }
  ];

  /*
   * On a platform that cannot hold other apps shut -- iOS -- only the adhan
   * permission means anything, so the rest of the checklist is dropped rather
   * than left there as five switches that promise something untrue.
   */
  function relevantPermissions() {
    if (state.status.canBlock === false) {
      return PERMISSIONS.filter(function (p) { return p.key === 'notifications'; });
    }
    return PERMISSIONS;
  }

  function renderPermissions(listEl) {
    if (!listEl) return;
    listEl.innerHTML = '';
    relevantPermissions().forEach(function (perm) {
      var on = !!state.status[perm.key];
      var li = document.createElement('li');
      li.className = on ? 'on' : '';

      var state_ = document.createElement('span');
      state_.className = 'state';
      state_.textContent = on ? '✓' : '';
      li.appendChild(state_);

      var text = document.createElement('span');
      text.className = 'text';
      var strong = document.createElement('strong');
      strong.textContent = perm.title;
      var span = document.createElement('span');
      span.textContent = perm.why;
      text.appendChild(strong);
      text.appendChild(span);
      li.appendChild(text);

      var go = document.createElement('button');
      go.className = 'go';
      go.type = 'button';
      go.textContent = on ? 'Done' : 'Grant';
      go.addEventListener('click', function () {
        Native.open(perm.which).then(refreshStatus);
      });
      li.appendChild(go);

      listEl.appendChild(li);
    });
  }

  function refreshStatus() {
    return Native.getStatus().then(function (status) {
      state.status = status || {};
      renderPermissions($('perm-list'));
      renderPermissions($('set-perm-list'));
      renderPlatformCopy();
      return state.status;
    });
  }

  /* Where the platform cannot block, say so everywhere rather than in one
   * apologetic footnote. */
  function renderPlatformCopy() {
    var blocks = state.status.canBlock !== false;
    $('brand-lede').textContent = blocks
      ? 'When the adhan starts, your apps stop. Follow the stickman through salah, tick it off, and go back to your feed until the next one.'
      : 'When the adhan starts, this app calls it and asks for the prayer back. Follow the stickman through salah and tick it off — on iOS, on your honour.';
    $('perm-heading').textContent = blocks ? '3 · Let it hold the lock' : '3 · Let it call the adhan';
    $('perm-sub').textContent = blocks
      ? 'Android only lets an app block other apps if you say so, one switch at a time.'
      : 'iOS gives an app no way to shut another one, so there is only the one switch that matters.';
    $('perm-note').textContent = blocks
      ? 'AddictStop only reads which app is in front, never what is on the screen. Settings and the phone dialler always stay reachable.'
      : 'Real blocking on iOS needs Apple’s Screen Time entitlement and a native extension, which this build does not have. Everything else works the same.';
  }

  /* ----------------------------------------------------------------- adhan */

  /*
   * The bundled recitation. It plays here when the lock is raised with the app
   * already in front; when the alarm fires in the background the notification
   * channel plays the same file, and the native side posts a silent
   * notification instead so it is never called twice at once.
   */
  function playAdhan() {
    var audio = $('adhan-audio');
    if (!audio) return;
    try {
      audio.currentTime = 0;
      var played = audio.play();
      if (played && played.catch) {
        // Autoplay can be refused until the screen has been touched; the
        // notification has the sound covered either way.
        played.catch(function () { $('btn-hush').hidden = true; });
      }
      $('btn-hush').hidden = false;
    } catch (e) {
      $('btn-hush').hidden = true;
    }
  }

  function stopAdhan() {
    var audio = $('adhan-audio');
    if (!audio) return;
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch (e) {
      // Nothing to stop.
    }
    $('btn-hush').hidden = true;
  }

  /* -------------------------------------------------------------- the lock */

  function enterLock(prayer, options) {
    state.locked = prayer;
    $('lock-prayer').textContent = prayer.name;
    $('lock-arabic').textContent = prayer.arabic || '';
    $('lock-elapsed').textContent = '';
    $('lock-lede').textContent = state.status.canBlock === false
      ? 'iOS will not let one app shut another, so nothing is being held closed — this one is on your honour. The stickman will lead; copy him, pose for pose.'
      : 'Every other app is shut until this prayer is done. The stickman will lead — copy him, pose for pose.';
    show('screen-locked');
    buzz([0, 220, 120, 220]);
    if (!options || options.sound !== false) playAdhan();
  }

  function triggerLock(prayer) {
    if (state.screen === 'screen-salah') return;
    Native.lock(prayer.name, prayer.rakahs).then(function () {
      enterLock(prayer);
    });
  }

  function releaseLock() {
    stopAdhan();
    return Native.unlock().then(function () {
      state.locked = null;
      return pushSchedule();
    });
  }

  /* ---------------------------------------------------------------- streak */

  function computeStreak() {
    var now = new Date();
    // Only prayers whose window has closed can break a streak -- one you still
    // have time for is not a miss yet.
    var list = PrayerTimes.schedule(now, state.settings, 0, 6)
      .filter(function (p) { return p.until <= now || state.log[logKey(p)]; })
      .sort(function (a, b) { return b.at - a.at; });

    var streak = 0;
    for (var i = 0; i < list.length; i++) {
      var entry = state.log[logKey(list[i])];
      if (!entry) break;
      if (entry.mode === 'followed') streak++;
      // An excused prayer neither counts nor breaks the run.
      else if (entry.mode && entry.mode.indexOf('excuse') === 0) continue;
      else break;
    }
    return streak;
  }

  function renderStreak() {
    var streak = computeStreak();
    $('streak-count').textContent = String(streak);
    var dots = $('streak-dots');
    dots.innerHTML = '';
    var shown = Math.min(streak, 20);
    for (var i = 0; i < 20; i++) {
      var dot = document.createElement('i');
      if (i < shown) dot.className = 'on';
      dots.appendChild(dot);
    }
  }

  /* ------------------------------------------------------------------ home */

  function renderHome() {
    if (!configured()) return;
    var now = new Date();
    var next = nextPrayer(now);
    var today = PrayerTimes.compute(now, state.settings);

    $('home-status').textContent = state.settings.armed ? 'Armed' : 'Disarmed';
    if (next) {
      $('home-next-name').textContent = next.name;
      $('home-next-when').textContent = 'in ' + humanGap(next.at - now) + ' · ' + clock(next.at);
    }

    var list = $('times-list');
    list.innerHTML = '';
    PrayerTimes.ORDER.forEach(function (key) {
      var at = today[key];
      var li = document.createElement('li');
      var isPrayer = !!PrayerTimes.RAKAHS[key];
      var done = isPrayer && at && state.log[dayKey(at) + ':' + key];

      if (at && at < now) li.classList.add('past');
      if (next && next.key === key && at && Math.abs(at - next.at) < 60000) li.classList.add('next');

      var tick = document.createElement('span');
      tick.className = 'tick';
      tick.textContent = done ? (done.mode === 'followed' ? '✓' : '·') : '';
      li.appendChild(tick);

      var name = document.createElement('span');
      name.className = 'name';
      name.textContent = PrayerTimes.LABELS[key] + (isPrayer ? '' : ' (end of Fajr)');
      li.appendChild(name);

      var ar = document.createElement('span');
      ar.className = 'ar';
      ar.textContent = PrayerTimes.ARABIC[key];
      li.appendChild(ar);

      var when = document.createElement('span');
      when.className = 'at';
      when.textContent = clock(at);
      li.appendChild(when);

      list.appendChild(li);
    });

    $('times-note').textContent = today.polarFallback
      ? 'The sun does not rise or set where you are today, so times are taken from the 48th parallel — the common "nearest latitude" convention.'
      : PrayerTimes.METHODS[state.settings.method].name;

    renderStreak();
  }

  function tickHome() {
    if (!configured()) return;
    var now = new Date();
    var next = nextPrayer(now);
    var current = PrayerTimes.current(now, state.settings);

    if (next) {
      var span = next.at - now;
      $('countdown').textContent = stopwatch(span);
      $('home-next-when').textContent = 'in ' + humanGap(span) + ' · ' + clock(next.at);

      // The ring fills over the window between the previous prayer and the next.
      var from = current ? current.at.getTime() : next.at.getTime() - 6 * 3600000;
      var total = Math.max(1, next.at.getTime() - from);
      var done = Math.min(1, Math.max(0, (now - from) / total));
      $('ring-fg').style.strokeDashoffset = String(326.7 * (1 - done));
    }

    var due = outstandingPrayer(now);
    if (!state.settings.armed) {
      $('doomscroll-note').textContent = 'Disarmed — nothing will be blocked.';
    } else if (state.status.canBlock === false) {
      $('doomscroll-note').textContent = 'Scroll on. ' + (next ? next.name : 'The next prayer') + ' will call you.';
    } else {
      $('doomscroll-note').textContent = 'Doomscroll away. You are clear until ' + (next ? next.name : 'the next prayer') + '.';
    }

    if (due && state.settings.armed && state.screen === 'screen-home') {
      triggerLock(due);
    }
  }

  /* ----------------------------------------------------------------- salah */

  var stickman = null;

  function startSalah(prayer) {
    stopAdhan();
    state.session = new Salah.Session(prayer, { pace: state.settings.pace });
    state.held = null;
    $('salah-prayer').textContent = prayer.name;
    show('screen-salah');

    if (!stickman) stickman = new Stickman($('stickman'));
    stickman.setPose(state.session.step().pose, true);
    renderStep(true);

    state.lastFrame = performance.now();
    cancelAnimationFrame(state.raf);
    state.raf = requestAnimationFrame(frame);
  }

  function renderStep() {
    var session = state.session;
    var step = session.step();
    var pose = Stickman.POSES[step.pose];

    $('salah-rakah').textContent = session.rakahLabel();
    $('pose-label').textContent = pose.label;
    $('pose-arabic').textContent = pose.arabic;
    $('pose-dhikr').textContent = step.dhikr || '';
    $('pose-hint').textContent = step.note ? step.note + ' · ' + pose.hint : pose.hint;

    Array.prototype.forEach.call(document.querySelectorAll('.pose-btn'), function (btn) {
      btn.classList.toggle('wanted', btn.dataset.group === pose.group);
    });
  }

  function frame(now) {
    var session = state.session;
    if (!session) return;

    var dt = Math.min(0.05, (now - state.lastFrame) / 1000);
    state.lastFrame = now;

    var advanced = session.tick(dt);
    if (advanced) {
      buzz(30);
      if (session.done) {
        finishSalah();
        return;
      }
      stickman.setPose(session.step().pose);
      renderStep();
    }

    var want = session.group();
    var wrong = state.held && state.held !== want;
    $('hold-fill').style.width = (session.fraction() * 100).toFixed(1) + '%';
    $('hold-track').classList.toggle('wrong', !!wrong);
    $('salah-overall').style.width = (session.overall() * 100).toFixed(1) + '%';

    var text;
    if (wrong) text = 'That is not the pose he is in';
    else if (!state.held) text = 'Hold ' + Stickman.GROUPS[want].label.toLowerCase() + ' to follow him';
    else text = Math.max(0, session.step().seconds - session.progress).toFixed(1) + 's';
    $('hold-text').textContent = text;

    Array.prototype.forEach.call(document.querySelectorAll('.pose-btn'), function (btn) {
      var held = btn.dataset.group === state.held;
      btn.classList.toggle('held', held);
      btn.classList.toggle('wrong', held && !!wrong);
    });

    stickman.draw(now, { bg: '#0b1f1a' });
    state.raf = requestAnimationFrame(frame);
  }

  function finishSalah() {
    cancelAnimationFrame(state.raf);
    var prayer = state.session.prayer;
    if (!prayer.test) {
      state.log[logKey(prayer)] = { at: Date.now(), mode: 'followed' };
      save();
    }
    buzz([0, 60, 60, 60, 60, 220]);

    $('done-prayer').textContent = prayer.test ? 'Dry run done' : prayer.name + ' prayed';
    $('done-note').textContent = prayer.test
      ? 'That is exactly how it will go when the adhan is called. Nothing was ticked off.'
      : 'Ticked off. The lock is lifted until the next adhan.';
    var next = nextPrayer(new Date());
    $('done-next').textContent = next
      ? 'Next up: ' + next.name + ' at ' + clock(next.at) + '.'
      : '';
    $('check-mark').classList.remove('go');
    show('screen-done');
    // restart the stroke animation now the node is visible
    void $('check-mark').offsetWidth;
    $('check-mark').classList.add('go');

    state.session = null;
  }

  function excuse(reason) {
    var prayer = state.locked || outstandingPrayer(new Date());
    if (prayer && !prayer.test) {
      state.log[logKey(prayer)] = { at: Date.now(), mode: 'excuse:' + reason };
      save();
    }
    closeSheets();
    cancelAnimationFrame(state.raf);
    state.session = null;
    releaseLock().then(function () {
      show('screen-home');
      renderHome();
      toast('Noted. The lock is off.');
    });
  }

  /* ---------------------------------------------------------------- sheets */

  function openSheet(id) {
    $('sheet-scrim').hidden = false;
    $(id).hidden = false;
  }

  function closeSheets() {
    $('sheet-scrim').hidden = true;
    $('sheet-settings').hidden = true;
    $('sheet-excuse').hidden = true;
  }

  /* ------------------------------------------------------------------ wire */

  function fillMethods(select) {
    select.innerHTML = '';
    Object.keys(PrayerTimes.METHODS).forEach(function (key) {
      var opt = document.createElement('option');
      opt.value = key;
      opt.textContent = PrayerTimes.METHODS[key].name;
      select.appendChild(opt);
    });
  }

  function readSetupInputs() {
    var lat = parseFloat($('in-lat').value);
    var lng = parseFloat($('in-lng').value);
    if (isFinite(lat) && isFinite(lng)) {
      state.settings.latitude = lat;
      state.settings.longitude = lng;
    }
    state.settings.method = $('in-method').value;
    state.settings.madhab = $('in-madhab').value;
  }

  function locate() {
    $('locate-status').textContent = 'Asking for your location…';
    if (!navigator.geolocation) {
      $('locate-status').textContent = 'No location service on this device — type the coordinates instead.';
      return;
    }
    navigator.geolocation.getCurrentPosition(function (pos) {
      $('in-lat').value = pos.coords.latitude.toFixed(4);
      $('in-lng').value = pos.coords.longitude.toFixed(4);
      $('set-lat').value = $('in-lat').value;
      $('set-lng').value = $('in-lng').value;
      $('locate-status').textContent = 'Got it: ' + pos.coords.latitude.toFixed(3) + ', ' + pos.coords.longitude.toFixed(3);
      readSetupInputs();
    }, function (err) {
      $('locate-status').textContent = 'Could not get a fix (' + err.message + '). Type the coordinates instead.';
    }, { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 });
  }

  function bindPosePad() {
    var pad = $('pose-pad');

    function setHeld(group) {
      state.held = group;
      if (state.session) state.session.setHeld(group);
    }

    pad.addEventListener('pointerdown', function (e) {
      var btn = e.target.closest('.pose-btn');
      if (!btn) return;
      e.preventDefault();
      btn.setPointerCapture(e.pointerId);
      setHeld(btn.dataset.group);
    });

    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (type) {
      pad.addEventListener(type, function (e) {
        var btn = e.target.closest('.pose-btn');
        if (!btn) return;
        if (state.held === btn.dataset.group) setHeld(null);
      });
    });

    // Keyboard equivalents, so the browser build is testable without a finger.
    var keys = { '1': 'stand', '2': 'bow', '3': 'down', '4': 'sit' };
    document.addEventListener('keydown', function (e) {
      if (keys[e.key] && state.session) setHeld(keys[e.key]);
    });
    document.addEventListener('keyup', function (e) {
      if (keys[e.key] && state.held === keys[e.key]) setHeld(null);
    });
  }

  function drawBrandMark() {
    var canvas = $('brand-canvas');
    if (!canvas) return;
    var mark = new Stickman(canvas);
    mark.setPose('sujud', true);
    var loop = function (t) {
      mark.draw(t, { bg: '#0d3227' });
      if (state.screen === 'screen-setup') requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  function arm() {
    readSetupInputs();
    if (!configured()) {
      toast('Set your location first.');
      return;
    }
    state.settings.armed = true;
    save();
    Native.setArmed(true)
      .then(refreshStatus)
      .then(pushSchedule)
      .then(function () {
        show('screen-home');
        renderHome();
        tickHome();
        var missing = PERMISSIONS.filter(function (p) { return !state.status[p.key]; });
        if (Native.available && missing.length) {
          toast('Armed — but ' + missing.length + ' permission' + (missing.length > 1 ? 's are' : ' is') + ' still missing.');
        }
      });
  }

  function disarm() {
    state.settings.armed = false;
    save();
    Native.setArmed(false).then(function () {
      closeSheets();
      show('screen-setup');
      toast('Disarmed. Nothing is blocked.');
    });
  }

  function bind() {
    fillMethods($('in-method'));
    fillMethods($('set-method'));

    $('btn-locate').addEventListener('click', locate);
    $('btn-arm').addEventListener('click', arm);
    $('btn-test').addEventListener('click', function () {
      var due = outstandingPrayer(new Date());
      if (due) {
        triggerLock(due);
        return;
      }
      // A dry run of the real thing, borrowing the next prayer's shape. It is
      // flagged so finishing it does not tick that prayer off for you.
      var next = nextPrayer(new Date());
      if (!next) return;
      triggerLock({
        key: next.key, name: next.name, arabic: next.arabic,
        rakahs: next.rakahs, at: new Date(), until: new Date(Date.now() + 3600000),
        test: true
      });
    });

    $('btn-settings').addEventListener('click', function () {
      $('set-method').value = state.settings.method;
      $('set-madhab').value = state.settings.madhab;
      $('set-pace').value = String(state.settings.pace);
      $('set-lat').value = state.settings.latitude;
      $('set-lng').value = state.settings.longitude;
      renderPermissions($('set-perm-list'));
      openSheet('sheet-settings');
    });
    $('btn-close-settings').addEventListener('click', function () {
      state.settings.method = $('set-method').value;
      state.settings.madhab = $('set-madhab').value;
      state.settings.pace = parseFloat($('set-pace').value) || 1;
      var lat = parseFloat($('set-lat').value), lng = parseFloat($('set-lng').value);
      if (isFinite(lat) && isFinite(lng)) {
        state.settings.latitude = lat;
        state.settings.longitude = lng;
      }
      save();
      pushSchedule();
      closeSheets();
      renderHome();
    });
    $('btn-disarm').addEventListener('click', disarm);
    $('sheet-scrim').addEventListener('click', closeSheets);

    $('btn-start-salah').addEventListener('click', function () {
      startSalah(state.locked || outstandingPrayer(new Date()) || nextPrayer(new Date()));
    });
    $('btn-excuse').addEventListener('click', function () { openSheet('sheet-excuse'); });
    $('btn-hush').addEventListener('click', stopAdhan);
    $('btn-cancel-excuse').addEventListener('click', closeSheets);
    Array.prototype.forEach.call(document.querySelectorAll('[data-excuse]'), function (btn) {
      btn.addEventListener('click', function () { excuse(btn.dataset.excuse); });
    });

    $('btn-unlock').addEventListener('click', function () {
      releaseLock().then(function () {
        show('screen-home');
        renderHome();
        tickHome();
      });
    });

    bindPosePad();
  }

  /* ------------------------------------------------------------------ boot */

  function handleNativeEvent(event) {
    if (!event || !event.type) return;
    if (event.type === 'adhan' || event.type === 'blocked') {
      var due = outstandingPrayer(new Date()) || nextPrayer(new Date());
      // The notification channel is already reciting in both these cases, so
      // the WebView keeps quiet.
      if (due && state.screen !== 'screen-salah') enterLock(due, { sound: false });
      if (event.type === 'blocked' && event.payload && event.payload.blocked) {
        toast('Not until you have prayed.');
      }
    }
    if (event.type === 'resume') {
      refreshStatus().then(function (status) {
        if (status.locked && state.screen !== 'screen-salah' && state.screen !== 'screen-done') {
          var due = outstandingPrayer(new Date());
          // Coming back to a lock already in progress: no second adhan.
          if (due) enterLock(due, { sound: false });
        }
      });
    }
  }

  function start() {
    load();
    bind();
    Native.init();
    Native.on(handleNativeEvent);

    $('in-method').value = state.settings.method;
    $('in-madhab').value = state.settings.madhab;
    if (configured()) {
      $('in-lat').value = state.settings.latitude;
      $('in-lng').value = state.settings.longitude;
    }

    refreshStatus().then(function (status) {
      if (!configured() || !state.settings.armed) {
        show('screen-setup');
        drawBrandMark();
        return;
      }
      pushSchedule();
      var due = outstandingPrayer(new Date());
      if (status.locked && due) {
        // Re-opening into a lock that was already called: no second adhan.
        enterLock(due, { sound: false });
      } else {
        if (status.locked) Native.unlock();
        show('screen-home');
      }
      renderHome();
      tickHome();
    });

    clearInterval(state.timer);
    state.timer = setInterval(function () {
      if (state.screen === 'screen-home') tickHome();
      if (state.screen === 'screen-locked' && state.locked) {
        $('lock-elapsed').textContent = 'Locked for ' + stopwatch(Date.now() - state.locked.at.getTime()) +
          ' · since ' + clock(state.locked.at);
      }
    }, 1000);

    setInterval(function () {
      if (state.settings.armed && configured()) pushSchedule();
    }, 30 * 60 * 1000);
  }

  if (window.cordova) {
    document.addEventListener('deviceready', start, false);
  } else {
    document.addEventListener('DOMContentLoaded', start, false);
  }
})();
