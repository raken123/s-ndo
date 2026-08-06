# AddictStop

A Cordova app for Android. When the adhan is called, it locks you out of every
other app on the phone. To get back in you have to follow the stickman through
the prayer — pose by pose, at his pace — and only then does it tick the prayer
off and let you go back to doomscrolling until the next one.

```
  home (scroll freely) ──▶ adhan fires ──▶ LOCKED ──▶ follow the stickman
        ▲                                                    │
        └──────────────── unlocked, prayer ticked off ◀───────┘
```

## What it actually does

**Prayer times** are computed on the phone from your latitude and longitude —
sun declination and the equation of time, then the hour angle for each prayer's
sun altitude. No network calls, no API key, no data leaves the device. Seven
calculation methods (MWL, ISNA, Egypt, Umm al-Qura, Karachi, Diyanet, Gulf) and
both Asr conventions. Above the polar circles, where the sun may not rise or set
at all, it falls back to the 48th parallel — the usual "nearest latitude" rule.

**The lock** is an Android accessibility service. While the lock is on, any app
that comes to the foreground gets bounced: the service goes home and puts
AddictStop back in front. It reads only the package name of the window that
opened — never window content; `canRetrieveWindowContent` is `false` in the
service config.

**The adhan** is an exact alarm per prayer (`AlarmManager`), so it fires whether
or not the app is running. Alarms are re-armed after every firing, and after a
reboot, a clock change or an app update, from a schedule kept in preferences.
The alert is a high-priority notification in the alarm category with a
full-screen intent, so it can wake the screen and pass Do Not Disturb.

**The stickman** leads the whole prayer: takbir, qiyam, rukuʿ, iʿtidal, two
sujud with a jalsa between, tashahhud after every second rakʿah, and the two
salams at the end — the right number of rakʿahs for each prayer. He moves into a
pose and *waits*. You copy him by holding the matching pose button; only time
spent in the right pose counts down the step, a wrong pose drains it faster than
letting go. He never runs ahead of you and you cannot skip ahead of him.

## What it deliberately does not do

- **It does not trap you.** Settings, the launcher and the phone dialler stay
  reachable while locked, so the accessibility service can always be switched
  off and an emergency call can always be made. A lock you cannot escape is a
  broken phone, not discipline.
- **It does not hold a missed prayer over you.** Each prayer's window closes
  when the next one is called (Fajr's at sunrise). If the window passes, the
  lock lifts on its own. Whether you make it up is between you and God.
- **It does not judge an excuse.** "I can't pray right now" — menstruation,
  travel and combining, illness, already prayed, praying off the app — lifts the
  lock, and an excused prayer neither counts toward the streak nor breaks it.
- **It does not verify that you prayed.** It cannot, and it does not pretend to.
  Following the stickman is a ritual of attention, not proof of worship. The
  honest description is that it makes reaching for your feed cost you the length
  of a prayer.
- **It sends nothing anywhere.** There is no server, no account, no analytics.

## Build

Needs Node, a JDK (21 works) and the Android SDK with platform 36 and
build-tools 36.

```bash
npm install -g cordova
export ANDROID_HOME=$HOME/android-sdk

cordova platform add android       # also installs both plugins from package.json
cordova build android --debug      # -> platforms/android/.../app-debug.apk
```

`platforms/` and `plugins/` are generated and not checked in; `platform add`
rebuilds them from `config.xml`, `package.json` and `local-plugins/`.

Do **not** follow that with `cordova plugin add ./local-plugins/...` — both
plugins are already listed in `package.json`, and adding one a second time
leaves Cordova's manifest bookkeeping (`plugins/android.json`) empty, after
which each `prepare` quietly deletes a component from the manifest. If the
built APK ever comes up short, check for all three:

```bash
$ANDROID_HOME/build-tools/36.0.0/aapt2 dump xmltree \
    --file AndroidManifest.xml dist/AddictStop-1.0.0-debug.apk \
  | grep -oE '"com\.addictstop\.block\.[A-Za-z]+"' | sort -u
```

A prebuilt debug APK is checked in at `dist/AddictStop-1.0.0-debug.apk`.

For a release build, sign it with your own key:

```bash
keytool -genkey -v -keystore addictstop.keystore -alias addictstop \
        -keyalg RSA -keysize 2048 -validity 10000
cordova build android --release -- \
        --keystore=addictstop.keystore --alias=addictstop
```

Regenerate the launcher icons after editing the drawing code:

```bash
python3 tools/make_icons.py      # needs Pillow
```

`tools/poses.html` renders every pose on one page — open it in a browser to tune
the joint positions without walking through a whole prayer.

## Setting it up on the phone

Install the APK, then work down the checklist on the setup screen. Android hands
these out one switch at a time and the lock is only as good as the ones you
grant:

| Switch | Why |
| --- | --- |
| Accessibility service | The block itself. Without it nothing is held shut. |
| Notifications | So the adhan alert can reach you. |
| Alarms & reminders | A prayer time that drifts by 20 minutes is no use. |
| Display over other apps | Lets the lock screen open from the background. |
| Unrestricted battery | Otherwise Android may sit on the alarm in doze. |

Then set your location, pick a calculation method, and arm it. "Test the lock
right now" runs the whole thing as a dry run without ticking a prayer off.

## Layout

```
config.xml                    app id, name, icons, Android preferences
www/
  index.html                  every screen, one document
  css/app.css
  js/prayertimes.js           solar prayer time calculation
  js/stickman.js              the poses and the canvas renderer
  js/salah.js                 rakʿah sequence + the follow-the-pose engine
  js/native.js                plugin wrapper, with a browser stub for dev
  js/app.js                   screens, state, the clock that drives the lock
local-plugins/cordova-plugin-addictstop/
  src/android/AppBlockService.java      accessibility service: the bouncer
  src/android/PrayerAlarmReceiver.java  the adhan moment
  src/android/Scheduler.java            exact alarms
  src/android/LockState.java            shared lock state
  src/android/Notifier.java             the adhan notification
  src/android/AddictStopPlugin.java     the JS bridge
tools/make_icons.py           launcher icon generator
tools/poses.html              pose sheet for tuning the stickman
```

## Developing without a phone

`www/` runs in a plain browser — `python3 -m http.server` from the project root,
then open `/www/index.html`. The plugin is absent there, so `js/native.js` falls
back to an in-memory stub: every screen works and the permission switches
pretend to have been granted, but nothing is really blocked. Keys `1`–`4` stand
in for the four pose buttons.
