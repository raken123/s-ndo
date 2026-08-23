# Digital Islam — VR / MR / XR

An immersive Islamic companion for headsets. The Qur'an is a **real book** you
hold, tilt and turn page by page on a rihal. The prayer mat is a **real mat**
you lay on your own floor, already facing the Qibla. Everything else — times,
tasbih, the ninety-nine names, the Kaaba, the calendar — is built around those
two objects.

Runs in the headset browser with no install: open the page, press **Enter VR**
or **Enter Mixed Reality**. There is also a desktop preview so you can see the
whole app without a headset.

**Live:** `/digital-islam/` on this repository's GitHub Pages site.

---

## Features

**The Qur'an as an object**

1. **A bound mushaf** — leather covers, gold medallion, paper pages, a ribbon
   marker and a wooden rihal stand. Grip to pick it up and carry it.
2. **Real page turns** — a sheet lifts and falls across the spine, right to
   left, with the paper sound. Tap the outer edge of either page, or the arrows.
3. **Mushaf-style typesetting** — Arabic set right-to-left with a drawn gold
   rosette after every ayah, surah and juz' running heads, page numbers.
4. **Meaning and transliteration** under each ayah, in eight languages, or
   Arabic alone.
5. **Verse-by-verse recitation** from six reciters, with the ayah being recited
   lit up and the page turning itself to keep up.
6. **Offline Qur'an** — a built-in set of the surahs used daily in prayer works
   with no network at all; any other surah downloads once and is then kept on
   the headset. One tap downloads all of Juz' Amma.
7. **Bookmarks and last-read memory** — the book reopens where you left it.
8. **Hifz (memorisation) mode** — ayahs you have marked as memorised are
   blanked out; select one to reveal it and check yourself.
9. **Library** — all 114 surahs, the 30 juz', your bookmarks, reciter and
   translation choice, and Arabic size, all in one place.

**Prayer**

10. **The prayer mat** — a real-size 110 × 70 cm sajjada with a mihrab arch,
    fringe, and head and hand marks. In mixed reality it lands on your actual
    floor via surface hit-testing.
11. **It always faces the Qibla** — as does the mihrab of the room you are in.
12. **Guided prayer** — every posture of every rak'ah, what is recited at each,
    Arabic with transliteration and meaning, a translucent figure showing the
    position, and spoken cues.
13. **Rak'ah counter from real movement** — the headset already knows when your
    head goes down to the mat and comes back up. Two prostrations, one rak'ah.
14. **Prayer times** for your location — ten calculation conventions, both Asr
    schools, high-latitude rules, Islamic midnight and the last third of the
    night.
15. **Prayer-time alert** with a countdown, and a prayer log you tick off.
16. **Qibla** — exact great-circle bearing and distance to the Kaaba, a compass
    ring on the floor, and a beam of light through your walls towards Makkah.
17. **Wudu walkthrough** — every step, in order, with what is said.

**Dhikr, learning and life**

18. **Tasbih** — a hanging bead string you flick; beads move as they are
    counted, with haptics, presets (33 / 100), and the full after-salah set.
19. **The ninety-nine names** — three rings of illuminated cards around you,
    each one readable, with meaning, an auto-tour, and one-tap dhikr counting.
20. **The Kaaba** — Al-Masjid al-Haram as a table model or at life size, with
    pilgrims circling; walk around it and your seven circuits of tawaf are
    counted.
21. **Hijri calendar** — a month grid with today marked, Gregorian dates, the
    events of the Islamic year, Fridays and the white fasting days.
22. **Ramadan mode** — live countdown to suhoor and iftar, day-of-month
    progress, a fasting log, and the last ten nights called out.
23. **Du'a collection** — twenty-five supplications in seven categories, with
    favourites and read-aloud.
24. **Zakat calculator** — cash, savings, business stock, debts, gold and
    silver against both nisab thresholds, at 2.5%.
25. **Knowledge quiz** — thirty-two questions, ten per round, with a personal
    best.
26. **Progress dashboard** — prayer streak, four-week chart, dhikr counted,
    ayahs recited, and a copy-out of all your data.

**The room and the rig**

27. **Five environments** — a mosque interior with dome, columns, lamps and
    minbar; an open courtyard with a fountain and palms; a desert night; a plain
    focus room; and passthrough, your own room in MR.
28. **The sun tracks the real sun** for your location and time of day.
29. **Controllers, tracked hands and mouse** all drive the same pointer; grip or
    pinch picks objects up.
30. **Comfort** — teleport or smooth movement, snap turning, a vignette, seated
    mode, eye-height adjustment and handedness.
31. **A wrist watch** on your off hand showing the next prayer and its
    countdown, without opening anything.
32. **Procedural ambience** — desert wind, rain or a distant hall, synthesised
    rather than streamed.

Everything is stored on the headset in `localStorage`. There is no account, no
server and nothing is uploaded.

---

## Controls

| | VR / MR | Desktop preview |
|---|---|---|
| Point | Controller ray or pinch | Mouse |
| Select | Trigger / pinch | Left click |
| Pick up | Grip | — |
| Menu | Look at your wrist, or the watch | `M`, or the ☰ button |
| Move | Left stick (teleport or glide) | `W A S D`, drag to look |
| Turn | Right stick (snap or smooth) | Drag |
| Shortcuts | — | `B` book · `Q` qibla · `T` times · `Esc` menu |

---

## Accuracy, and what the app does not claim

- **Prayer times** are computed from solar position (NOAA/USNO almanac formulae
  and the standard hour-angle solutions). They agree with the mainstream
  implementations to well under a minute at moderate latitudes. Communities
  legitimately differ on convention and on the minute — check against your local
  mosque, and change the method in Settings if it disagrees.
- **Qibla** is an exact great-circle bearing. Placing that bearing in your room
  is the hard part: WebXR gives no compass, so the app starts by assuming you
  set up facing north and offers either a one-tap device-compass lock (where the
  hardware has one) or manual alignment. Until you calibrate, treat the beam as
  a relative direction, not an absolute one.
- **Hijri dates** use the browser's Umm al-Qura calendar, falling back to the
  tabular calendar. Both are calculated. A local moon sighting can differ by a
  day, and Settings has a ±1 day adjustment.
- **Qur'an text** is fetched from the [Al-Quran Cloud](https://alquran.cloud)
  API (Uthmani script), which is the authoritative source used here; the small
  built-in set exists so the app works offline. The English lines are plain
  renderings of the meaning, not a translation of the Qur'an in the technical
  sense — the Arabic alone is the Qur'an.
- **Prayer guidance** follows the most widely taught form. Wording and details
  differ between the schools of law; the app says so where it matters. It is a
  learning aid, not a ruling.
- **Zakat** is arithmetic, not a fatwa. Pensions, shares and mixed debts need a
  scholar.
- **No adhan recording is bundled** — an adhan is somebody's voice, and choosing
  one for everybody would be presumptuous. The alert is a chime; Settings takes
  the URL of any recording you would rather hear.

## Attributions

- Recitation audio streams from [EveryAyah](https://everyayah.com).
- Text and translations from the [Al-Quran Cloud](https://alquran.cloud) API.
- [three.js](https://threejs.org) r170, MIT, vendored in `vendor/`.
- Everything else — textures, models, sounds — is generated at runtime by this
  code. There are no image or audio assets to download.

## Running it locally

```sh
python3 -m http.server 8080
# then open http://localhost:8080/digital-islam/
```

WebXR needs a secure context: `localhost` is fine, anything else needs HTTPS.
GitHub Pages serves this over HTTPS, so the deployed copy works on a headset
as-is.

## Layout

```
digital-islam/
├── index.html              entry point and importmap
├── css/app.css             the launch screen and 2D chrome
├── vendor/                 three.js (MIT)
└── js/
    ├── main.js             app shell: shared state, feature registry
    ├── core/
    │   ├── engine.js       renderer, XR sessions, frame loop, desktop controls
    │   ├── interaction.js  controllers, hands, mouse, grabbing
    │   ├── locomotion.js   teleport, snap turn, comfort vignette
    │   ├── panel.js        canvas-textured 3D UI and widgets
    │   ├── panel-feature.js base class for panel-shaped features
    │   ├── patterns.js     procedural textures (star tiling, mat, leather, sky)
    │   ├── prayer-times.js solar calculations
    │   ├── geo.js          Qibla bearing, distance, location
    │   ├── hijri.js        Islamic calendar
    │   ├── audio.js        recitation, ambience, chimes, speech
    │   └── store.js        local persistence
    ├── data/               surah index, offline text, names, du'as, quiz…
    └── features/           one file per feature
```
