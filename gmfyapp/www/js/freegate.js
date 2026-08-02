/* gmfy — the Free plan's restrictions, and rewarded-ad unlocks.
 *
 * The Free plan is deliberately hemmed in by 28 restrictions (below). Some are
 * always-on nags (watermark, banner ads); the rest are locks. A "rewardable"
 * lock can be lifted for the current session by watching a rewarded video ad,
 * or permanently by moving to a paid plan.
 *
 * Session unlocks live in sessionStorage so they clear when the app restarts —
 * that's what keeps a rewarded ad "rewarded" rather than a one-time bypass.
 */
(function (global) {
  'use strict';

  // 28 free-tier restrictions. r:true means a rewarded ad can lift it.
  var LIMITS = [
    { id: 'games2',      label: 'Only 2 games at once',                 r: false },
    { id: 'share1',      label: 'Only 1 shared game at a time',         r: false },
    { id: 'watermark',   label: '"made with gmfy" watermark',           r: true  },
    { id: 'playad',      label: 'A video ad before every Play',         r: false },
    { id: 'bannerads',   label: 'Rotating banner ads',                  r: true  },
    { id: 'export_apk',  label: 'Cordova APK export locked',            r: true  },
    { id: 'export_desktop', label: 'Electron desktop export locked',    r: true  },
    { id: 'custom_icon', label: 'Custom app icon locked',               r: true  },
    { id: 'photo',       label: 'Photo mode locked',                    r: true  },
    { id: 'ghost',       label: 'Ghost racing locked',                  r: true  },
    { id: 'biomes',      label: 'Only 3 of the biomes',                 r: true  },
    { id: 'kinds',       label: 'Only 8 object kinds',                  r: true  },
    { id: 'brush',       label: 'Sculpt brush size capped',             r: true  },
    { id: 'weather',     label: 'Weather locked to clear skies',        r: true  },
    { id: 'daynight',    label: 'Time of day locked to noon',           r: true  },
    { id: 'wind',        label: 'Wind locked off',                      r: true  },
    { id: 'blocks20',    label: 'Only 20 of the 57 code blocks',        r: true  },
    { id: 'soundblocks', label: 'Sound blocks locked',                  r: true  },
    { id: 'objcap',      label: 'Max 30 objects per world',             r: true  },
    { id: 'nobackup',    label: 'No world backup / restore',            r: true  },
    { id: 'makeclass',   label: 'Cannot create a class',               r: false },
    { id: 'joinclass',   label: 'Join only 1 class',                    r: false },
    { id: 'invites',     label: '0 invite codes to give',              r: false },
    { id: 'rename',      label: 'Rename game locked',                   r: true  },
    { id: 'duplicate',   label: 'Duplicate game locked',               r: true  },
    { id: 'undo5',       label: 'Undo limited to 5 steps',              r: true  },
    { id: 'relief',      label: 'Terrain relief (hills) capped',        r: true  },
    { id: 'exportbrand', label: 'Exports carry a gmfy splash',          r: true  }
  ];

  var K_UNLOCK = 'gmfy.freeunlock.v1';

  function isFree() {
    return !global.GmfyPlans || global.GmfyPlans.current().id === 'free';
  }

  function unlocked() {
    try { return JSON.parse(sessionStorage.getItem(K_UNLOCK) || '{}') || {}; }
    catch (e) { return {}; }
  }

  // A restriction is active when: on free, and not unlocked this session.
  function locked(id) {
    if (!isFree()) return false;
    return !unlocked()[id];
  }

  function unlock(id) {
    var u = unlocked(); u[id] = Date.now();
    try { sessionStorage.setItem(K_UNLOCK, JSON.stringify(u)); } catch (e) {}
  }

  function stats() {
    var total = LIMITS.length;
    var active = isFree() ? LIMITS.filter(function (l) { return locked(l.id); }).length : 0;
    return { total: total, active: active,
             lifted: isFree() ? total - active : total };
  }

  global.GmfyFree = {
    LIMITS: LIMITS, locked: locked, unlock: unlock, stats: stats,
    isFree: isFree, get: function (id) {
      for (var i = 0; i < LIMITS.length; i++) if (LIMITS[i].id === id) return LIMITS[i];
      return null;
    }
  };
})(window);
