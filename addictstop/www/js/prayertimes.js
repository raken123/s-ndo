/*
 * prayertimes.js -- solar prayer time calculation, no network required.
 *
 * Implements the standard almanac approach: compute the sun's declination and
 * the equation of time for the day, derive solar noon (dhuhr), then solve the
 * hour angle for each prayer's sun altitude.
 */
(function (global) {
  'use strict';

  var DEG = Math.PI / 180;

  function dsin(d) { return Math.sin(d * DEG); }
  function dcos(d) { return Math.cos(d * DEG); }
  function dtan(d) { return Math.tan(d * DEG); }
  function dasin(x) { return Math.asin(x) / DEG; }
  function dacos(x) { return Math.acos(x) / DEG; }
  function datan2(y, x) { return Math.atan2(y, x) / DEG; }
  function dacot(x) { return Math.atan2(1, x) / DEG; }

  function fixAngle(a) { return fix(a, 360); }
  function fixHour(a) { return fix(a, 24); }
  function fix(a, n) {
    a = a - n * Math.floor(a / n);
    return a < 0 ? a + n : a;
  }

  /* Julian day for a calendar date (UT midnight). */
  function julian(year, month, day) {
    if (month <= 2) {
      year -= 1;
      month += 12;
    }
    var A = Math.floor(year / 100);
    var B = 2 - A + Math.floor(A / 4);
    return Math.floor(365.25 * (year + 4716)) +
      Math.floor(30.6001 * (month + 1)) + day + B - 1524.5;
  }

  /* Sun declination and equation of time for a Julian day. */
  function sunPosition(jd) {
    var D = jd - 2451545.0;
    var g = fixAngle(357.529 + 0.98560028 * D);        // mean anomaly
    var q = fixAngle(280.459 + 0.98564736 * D);        // mean longitude
    var L = fixAngle(q + 1.915 * dsin(g) + 0.020 * dsin(2 * g)); // apparent longitude
    var e = 23.439 - 0.00000036 * D;                   // obliquity of the ecliptic

    var RA = fix(datan2(dcos(e) * dsin(L), dcos(L)) / 15, 24);
    return {
      declination: dasin(dsin(e) * dsin(L)),
      equation: q / 15 - RA
    };
  }

  /*
   * Hours from solar noon to the moment the sun sits at altitude `angle`
   * (negative = below the horizon). Returns NaN at high latitudes where the
   * sun never reaches that altitude.
   */
  function hourAngle(angle, latitude, declination) {
    var t = (-dsin(angle) - dsin(declination) * dsin(latitude)) /
      (dcos(declination) * dcos(latitude));
    if (t > 1 || t < -1) return NaN;
    return dacos(t) / 15;
  }

  /* Asr: the sun altitude where an object's shadow equals `factor` x its own
   * length plus the noon shadow. factor 1 = Shafi/Maliki/Hanbali, 2 = Hanafi. */
  function asrAngle(factor, latitude, declination) {
    return dacot(factor + dtan(Math.abs(latitude - declination)));
  }

  var METHODS = {
    MWL:     { name: 'Muslim World League',        fajr: 18,   isha: 17 },
    ISNA:    { name: 'Islamic Society of N.A.',    fajr: 15,   isha: 15 },
    Egypt:   { name: 'Egyptian General Authority', fajr: 19.5, isha: 17.5 },
    Makkah:  { name: 'Umm al-Qura, Makkah',        fajr: 18.5, ishaMinutes: 90 },
    Karachi: { name: 'Univ. of Islamic Sciences',  fajr: 18,   isha: 18 },
    Turkey:  { name: 'Diyanet, Turkey',            fajr: 18,   isha: 17 },
    Dubai:   { name: 'Gulf / Dubai',               fajr: 18.2, isha: 18.2 }
  };

  var ORDER = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];
  var LABELS = {
    fajr: 'Fajr', sunrise: 'Sunrise', dhuhr: 'Dhuhr',
    asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha'
  };
  var ARABIC = {
    fajr: 'الفجر', sunrise: 'الشروق', dhuhr: 'الظهر',
    asr: 'العصر', maghrib: 'المغرب', isha: 'العشاء'
  };
  /* Rak'ahs of the fard prayer. Sunrise is not a prayer -- it only closes Fajr. */
  var RAKAHS = { fajr: 2, dhuhr: 4, asr: 4, maghrib: 3, isha: 4 };

  /*
   * settings: { latitude, longitude, elevation, method, madhab ('standard'|'hanafi'),
   *             highLatitude ('angle'|'night'|'none'), adjustments: {fajr: min, ...} }
   * date: a JS Date (local time on the device).
   *
   * Returns { fajr: Date, sunrise: Date, ... } in device local time.
   */
  function compute(date, settings) {
    var method = METHODS[settings.method] || METHODS.MWL;
    var lat = settings.latitude;
    var lng = settings.longitude;
    var elev = settings.elevation || 0;
    var factor = settings.madhab === 'hanafi' ? 2 : 1;

    // Device UTC offset in hours for this date (handles DST for us).
    var tz = -date.getTimezoneOffset() / 60;
    var jd = julian(date.getFullYear(), date.getMonth() + 1, date.getDate()) - lng / 15 / 24;

    /*
     * Inside the polar circles the sun may never cross the horizon at all, so
     * sunrise and sunset simply do not exist and every angle-based rule breaks
     * down. Fall back to the "nearest latitude" convention: keep the local
     * clock but read the day's times off the 48th parallel.
     */
    var polar = false;
    var noonDecl = sunPosition(jd + 0.5).declination;
    if (isNaN(hourAngle(0.833, lat, noonDecl))) {
      polar = true;
      lat = (lat < 0 ? -1 : 1) * 48;
    }

    // Portion of a day, refined twice so each time uses its own sun position.
    var times = {
      fajr: 5 / 24, sunrise: 6 / 24, dhuhr: 12 / 24,
      asr: 13 / 24, sunset: 18 / 24, maghrib: 18 / 24, isha: 18 / 24
    };

    function at(portion) { return sunPosition(jd + portion); }

    for (var pass = 0; pass < 3; pass++) {
      var noonSun = at(times.dhuhr);
      var noon = 12 - noonSun.equation;                  // solar noon, UTC hours + lng/15
      var horizon = 0.833 + 0.0347 * Math.sqrt(Math.max(0, elev));

      function symmetric(key, angle, sign) {
        var sun = at(times[key]);
        var ha = hourAngle(angle, lat, sun.declination);
        var n = 12 - sun.equation;
        times[key] = (isNaN(ha) ? NaN : n + sign * ha) / 24;
      }

      times.dhuhr = noon / 24;
      symmetric('sunrise', horizon, -1);
      symmetric('sunset', horizon, 1);
      times.maghrib = times.sunset;
      symmetric('fajr', method.fajr, -1);

      if (method.ishaMinutes) {
        times.isha = times.sunset + method.ishaMinutes / 60 / 24;
      } else {
        symmetric('isha', method.isha, 1);
      }

      var asrSun = at(times.asr);
      // Asr's angle is an altitude above the horizon, so it enters the hour
      // angle solver negated (the solver takes depression angles).
      var ha = hourAngle(-asrAngle(factor, lat, asrSun.declination), lat, asrSun.declination);
      times.asr = (isNaN(ha) ? NaN : (12 - asrSun.equation) + ha) / 24;
    }

    // Back to local clock hours.
    var out = {};
    ORDER.concat(['sunset']).forEach(function (key) {
      out[key] = times[key] * 24 + tz - lng / 15;
    });

    adjustHighLatitude(out, method, settings.highLatitude || 'angle');

    var adj = settings.adjustments || {};
    var result = {};
    ORDER.forEach(function (key) {
      var hours = out[key] + (adj[key] || 0) / 60;
      result[key] = toDate(date, hours);
    });
    result.sunset = toDate(date, out.sunset);
    result.polarFallback = polar;
    return result;
  }

  /*
   * Above ~48 degrees the sun may never reach the fajr/isha angle in summer, so
   * those times come back NaN. Fall back to a fraction of the night measured
   * from the twilight angle (the "angle based" rule) or a plain seventh.
   */
  function adjustHighLatitude(t, method, mode) {
    if (mode === 'none') return;
    var night = t.sunrise + 24 - t.sunset;
    if (!isFinite(night)) return;

    var fajrPortion = mode === 'angle' ? (night / 60) * method.fajr : night / 7;
    var ishaAngle = method.isha || 18;
    var ishaPortion = mode === 'angle' ? (night / 60) * ishaAngle : night / 7;

    if (!isFinite(t.fajr) || t.sunrise - t.fajr > fajrPortion) {
      t.fajr = t.sunrise - fajrPortion;
    }
    if (!method.ishaMinutes && (!isFinite(t.isha) || t.isha - t.sunset > ishaPortion)) {
      t.isha = t.sunset + ishaPortion;
    }
    if (!isFinite(t.asr)) t.asr = t.dhuhr + (t.sunset - t.dhuhr) * 0.7;
  }

  function toDate(base, hours) {
    if (!isFinite(hours)) return null;
    var d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
    d.setTime(d.getTime() + Math.round(hours * 3600000));
    return d;
  }

  /*
   * The prayer we are currently "in" and the one coming next, looking across
   * yesterday / today / tomorrow so it stays correct around midnight.
   */
  function schedule(now, settings, days, daysBack) {
    var list = [];
    var first = -(daysBack === undefined ? 1 : daysBack);
    for (var offset = first; offset <= (days === undefined ? 2 : days); offset++) {
      var day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
      var times = compute(day, settings);
      Object.keys(RAKAHS).forEach(function (key) {
        if (!times[key]) return;
        list.push({
          key: key,
          name: LABELS[key],
          arabic: ARABIC[key],
          rakahs: RAKAHS[key],
          at: times[key],
          // Fajr's window closes at sunrise; every other prayer runs until the
          // next one is called. Filled in below for the non-Fajr prayers.
          until: key === 'fajr' ? times.sunrise : null
        });
      });
    }
    list.sort(function (a, b) { return a.at - b.at; });
    for (var i = 0; i < list.length; i++) {
      if (list[i].until) continue;
      list[i].until = i + 1 < list.length
        ? list[i + 1].at
        : new Date(list[i].at.getTime() + 6 * 3600000);
    }
    return list;
  }

  function next(now, settings) {
    var list = schedule(now, settings);
    for (var i = 0; i < list.length; i++) {
      if (list[i].at > now) return list[i];
    }
    return null;
  }

  function current(now, settings) {
    var list = schedule(now, settings);
    var found = null;
    for (var i = 0; i < list.length; i++) {
      if (list[i].at <= now) found = list[i]; else break;
    }
    return found;
  }

  global.PrayerTimes = {
    METHODS: METHODS,
    ORDER: ORDER,
    LABELS: LABELS,
    ARABIC: ARABIC,
    RAKAHS: RAKAHS,
    compute: compute,
    schedule: schedule,
    next: next,
    current: current
  };
})(window);
