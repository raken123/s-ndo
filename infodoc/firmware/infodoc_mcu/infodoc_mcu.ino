/*
 * InfoDoc firmware — Modulino Thermo + Joystick + Movement over one serial line.
 *
 * Boards
 *   Arduino UNO Q      the sketch runs on the STM32U585; Serial reaches the host
 *                      through the Qualcomm side (see ../uno_q_bridge/), or
 *                      directly if a USB CDC gadget is configured there.
 *   UNO R4 / Nano ESP32 / MKR / Nano 33
 *                      Serial *is* the USB CDC endpoint, so the desktop app can
 *                      open it straight away with Web Serial.
 *
 * Wiring: all three Modulino nodes chain onto the same Qwiic/I2C bus in any
 * order. Nothing else is needed. Missing nodes are simply reported absent.
 *
 * Protocol — newline terminated ASCII, 115200 8N1.
 *
 *   host -> board
 *     ID?              identify
 *     SCAN             re-probe the I2C bus
 *     PING             answer with PONG <millis>
 *     T1 T0            start / stop the thermo stream
 *     J1 J0            start / stop the joystick stream
 *     M1 M0            start / stop the movement stream
 *     RATE T|J|M <hz>  set a stream rate, 1..200 Hz
 *
 *   board -> host
 *     HELLO infodoc 1 <fw> <caps>
 *     STAT T=0|1 J=0|1 M=0|1
 *     T <ms> <tempC> <rh>
 *     J <ms> <x> <y> <btn>                 x,y -127..127, btn 0|1
 *     M <ms> <ax> <ay> <az> <gx> <gy> <gz> accel in g, gyro in dps
 *     PONG <ms>
 *     ERR <text>
 *     # <text>                             log line, ignorable
 *
 * The timestamp on every sample is this board's millis() taken at the moment the
 * sensor was read. The app pairs it with PING/PONG to take USB scheduling jitter
 * out of the reaction times, so do not reorder or batch these lines.
 */

#include <Modulino.h>

#define FW_VERSION "1.0.0"
#define PROTO 1

/* ── configuration ─────────────────────────────────────────────────────────
 * JOY_SOURCE  1 = Modulino Joystick over I2C (the default)
 *             0 = a plain analog thumbstick, for a library too old to have
 *                 ModulinoJoystick, or a board without the node
 * Set JOY_INVERT_* if the cursor in the app moves opposite to the stick — the
 * app expects +X right and +Y up.
 */
#define JOY_SOURCE      1
#define JOY_INVERT_X    0
#define JOY_INVERT_Y    0

#if !JOY_SOURCE
  #define JOY_PIN_X   A0
  #define JOY_PIN_Y   A1
  #define JOY_PIN_BTN 2
  #define JOY_ADC_MAX 1023
#endif

/* Some cores put the Qwiic connector on Wire1 and some on Wire; the library
 * picks a sane default per board. Uncomment to force it. */
// #define MODULINO_BUS Wire

/* ── modules ───────────────────────────────────────────────────────────── */
ModulinoThermo   thermo;
ModulinoMovement movement;
#if JOY_SOURCE
ModulinoJoystick joystick;
#endif

bool haveT = false, haveJ = false, haveM = false;

/* ── stream state ──────────────────────────────────────────────────────── */
struct Stream {
  bool     on;
  uint32_t periodUs;
  uint32_t nextUs;
};

Stream sT = { false, 200000UL, 0 };    //   5 Hz
Stream sJ = { false,  10000UL, 0 };    // 100 Hz
Stream sM = { false,  10000UL, 0 };    // 100 Hz

char    cmd[32];
uint8_t cmdLen = 0;

/* ── helpers ───────────────────────────────────────────────────────────── */
static void hello() {
  Serial.print(F("HELLO infodoc "));
  Serial.print(PROTO);
  Serial.print(' ');
  Serial.print(F(FW_VERSION));
  Serial.print(' ');
  if (haveT) Serial.print('T');
  if (haveJ) Serial.print('J');
  if (haveM) Serial.print('M');
  if (!haveT && !haveJ && !haveM) Serial.print('-');
  Serial.println();
}

static void stat() {
  Serial.print(F("STAT T="));
  Serial.print(haveT ? 1 : 0);
  Serial.print(F(" J="));
  Serial.print(haveJ ? 1 : 0);
  Serial.print(F(" M="));
  Serial.println(haveM ? 1 : 0);
}

static void scan() {
  haveT = thermo.begin();
  haveM = movement.begin();
#if JOY_SOURCE
  haveJ = joystick.begin();
  if (haveJ) joystick.setDeadZone(0);   // the app applies its own dead zone
#else
  pinMode(JOY_PIN_BTN, INPUT_PULLUP);
  haveJ = true;
#endif
  if (!haveT) sT.on = false;
  if (!haveJ) sJ.on = false;
  if (!haveM) sM.on = false;
  stat();
}

/* clamp a rate into something the I2C bus can actually keep up with */
static uint32_t periodFor(long hz) {
  if (hz < 1) hz = 1;
  if (hz > 200) hz = 200;
  return (uint32_t)(1000000UL / (uint32_t)hz);
}

static void setRate(char which, long hz) {
  uint32_t p = periodFor(hz);
  if (which == 'T') sT.periodUs = p;
  else if (which == 'J') sJ.periodUs = p;
  else if (which == 'M') sM.periodUs = p;
  else { Serial.println(F("ERR bad stream for RATE")); return; }
  Serial.print(F("# rate "));
  Serial.print(which);
  Serial.print(' ');
  Serial.println(1000000UL / p);
}

static void enable(Stream &s, bool on, bool present, char which) {
  if (on && !present) {
    Serial.print(F("ERR module "));
    Serial.print(which);
    Serial.println(F(" not present"));
    return;
  }
  s.on = on;
  s.nextUs = micros();
}

/* ── command handling ──────────────────────────────────────────────────── */
static void handleCmd() {
  if (cmdLen == 0) return;
  cmd[cmdLen] = 0;

  if (!strcmp(cmd, "ID?"))        { hello(); stat(); }
  else if (!strcmp(cmd, "SCAN"))  { scan(); }
  else if (!strcmp(cmd, "PING"))  { Serial.print(F("PONG ")); Serial.println(millis()); }
  else if (!strcmp(cmd, "T1"))    { enable(sT, true,  haveT, 'T'); }
  else if (!strcmp(cmd, "T0"))    { sT.on = false; }
  else if (!strcmp(cmd, "J1"))    { enable(sJ, true,  haveJ, 'J'); }
  else if (!strcmp(cmd, "J0"))    { sJ.on = false; }
  else if (!strcmp(cmd, "M1"))    { enable(sM, true,  haveM, 'M'); }
  else if (!strcmp(cmd, "M0"))    { sM.on = false; }
  else if (!strncmp(cmd, "RATE ", 5) && cmdLen >= 8) {
    setRate(cmd[5], atol(cmd + 7));
  } else {
    Serial.print(F("ERR unknown command "));
    Serial.println(cmd);
  }
  cmdLen = 0;
}

static void readSerial() {
  while (Serial.available()) {
    char c = (char)Serial.read();
    if (c == '\n' || c == '\r') {
      handleCmd();
    } else if (cmdLen < sizeof(cmd) - 1) {
      cmd[cmdLen++] = c;
    } else {
      cmdLen = 0;                      // overlong line: drop it rather than wrap
      Serial.println(F("ERR command too long"));
    }
  }
}

/* ── sampling ──────────────────────────────────────────────────────────── */
static void sampleThermo() {
  float t = thermo.getTemperature();
  float h = thermo.getHumidity();
  Serial.print(F("T "));
  Serial.print(millis());
  Serial.print(' ');
  Serial.print(t, 2);
  Serial.print(' ');
  Serial.println(h, 1);
}

static void sampleJoystick() {
  int x, y, btn;
#if JOY_SOURCE
  joystick.update();
  x = joystick.getX();
  y = joystick.getY();
  btn = joystick.isPressed() ? 1 : 0;
#else
  // centre the raw ADC and scale to the same -127..127 the node reports
  long rx = analogRead(JOY_PIN_X), ry = analogRead(JOY_PIN_Y);
  x = (int)((rx - JOY_ADC_MAX / 2) * 254L / JOY_ADC_MAX);
  y = (int)((ry - JOY_ADC_MAX / 2) * 254L / JOY_ADC_MAX);
  btn = digitalRead(JOY_PIN_BTN) == LOW ? 1 : 0;
#endif
#if JOY_INVERT_X
  x = -x;
#endif
#if JOY_INVERT_Y
  y = -y;
#endif
  if (x > 127) x = 127; else if (x < -127) x = -127;
  if (y > 127) y = 127; else if (y < -127) y = -127;

  Serial.print(F("J "));
  Serial.print(millis());
  Serial.print(' ');
  Serial.print(x);
  Serial.print(' ');
  Serial.print(y);
  Serial.print(' ');
  Serial.println(btn);
}

static void sampleMovement() {
  movement.update();
  Serial.print(F("M "));
  Serial.print(millis());
  Serial.print(' ');
  Serial.print(movement.getX(), 4);
  Serial.print(' ');
  Serial.print(movement.getY(), 4);
  Serial.print(' ');
  Serial.print(movement.getZ(), 4);
  Serial.print(' ');
  Serial.print(movement.getRoll(), 2);
  Serial.print(' ');
  Serial.print(movement.getPitch(), 2);
  Serial.print(' ');
  Serial.println(movement.getYaw(), 2);
}

/* micros() wraps every ~71 minutes; comparing the signed difference survives it */
static bool due(Stream &s, uint32_t now) {
  if (!s.on) return false;
  if ((int32_t)(now - s.nextUs) < 0) return false;
  s.nextUs += s.periodUs;
  // after a stall, resync rather than firing a burst of catch-up samples
  if ((int32_t)(now - s.nextUs) > (int32_t)s.periodUs) s.nextUs = now + s.periodUs;
  return true;
}

/* ── setup / loop ──────────────────────────────────────────────────────── */
void setup() {
  Serial.begin(115200);
  uint32_t t0 = millis();
  while (!Serial && millis() - t0 < 2000) { }    // native USB needs a moment

#ifdef MODULINO_BUS
  Modulino.begin(MODULINO_BUS);
#else
  Modulino.begin();
#endif

  scan();
  hello();
  Serial.println(F("# infodoc ready"));
}

void loop() {
  readSerial();

  uint32_t now = micros();
  if (due(sJ, now)) sampleJoystick();    // the timing-critical one goes first
  if (due(sM, now)) sampleMovement();
  if (due(sT, now)) sampleThermo();
}
