# InfoDoc firmware

`infodoc_mcu/infodoc_mcu.ino` reads the three Modulino nodes and reports them
over one newline-delimited serial protocol. `uno_q_bridge/` relays that protocol
to a WebSocket for boards whose `Serial` the host cannot open directly.

## What you need

| Part | Notes |
|---|---|
| Arduino UNO Q (4 GB or larger) | or an UNO R4, Nano ESP32, MKR, Nano 33 |
| Modulino Thermo | forehead temperature, contact sensor (HS3003) |
| Modulino Joystick | reflex test, two axes plus a button |
| Modulino Movement | hand steadiness, 6-axis IMU (LSM6DSOX) |
| 3 Qwiic cables | the nodes ship with them |

## Wiring

All three nodes chain onto the same Qwiic/I²C bus, in any order — each node has
two connectors, so go board → node → node → node. No jumpers, no soldering,
nothing else. Each node has a different I²C address, so order does not matter.

A missing node is not an error: the sketch reports which ones answered and the
app greys out the checks it cannot run.

## Uploading

1. In the Arduino IDE, Library Manager → install **Modulino**.
2. Open `infodoc_mcu/infodoc_mcu.ino`, pick your board, upload.
3. Open the Serial Monitor at **115200 baud**. You should see:

```
STAT T=1 J=1 M=1
HELLO infodoc 1 1.0.0 TJM
# infodoc ready
```

Type `ID?` and it answers. Type `T1` and temperature lines start arriving; `T0`
stops them. That is the whole protocol, and it is all the app does.

For the UNO Q, build the sketch for the MCU side through Arduino App Lab and
run `uno_q_bridge/bridge.py` on the Linux side — see that folder's README.

## If something is wrong

**`STAT T=0 J=0 M=0`** — nothing on the bus. Check the Qwiic cable is in the
board's I²C connector and not a node-to-node one. Some cores put the connector
on `Wire` rather than `Wire1`; uncomment `#define MODULINO_BUS Wire` near the
top of the sketch.

**One node missing** — swap its cable, then swap its position in the chain. If
it only fails in one position, the cable before it is at fault.

**`ModulinoJoystick` does not compile** — your Modulino library predates the
Joystick node. Update it, or set `#define JOY_SOURCE 0` and wire a plain analog
thumbstick to A0/A1 with its button on D2.

**The cursor in the app moves the wrong way** — set `JOY_INVERT_X` or
`JOY_INVERT_Y` to 1. The app expects +X right and +Y up.

## Protocol

Newline-terminated ASCII, 115200 8N1.

Host → board:

| Command | Meaning |
|---|---|
| `ID?` | identify: `HELLO` then `STAT` |
| `SCAN` | re-probe the I²C bus, answer `STAT` |
| `PING` | answer `PONG <millis>` |
| `T1` / `T0` | start / stop the thermo stream |
| `J1` / `J0` | start / stop the joystick stream |
| `M1` / `M0` | start / stop the movement stream |
| `RATE T\|J\|M <hz>` | set a stream rate, 1–200 Hz |

Board → host:

| Line | Meaning |
|---|---|
| `HELLO infodoc 1 <fw> <caps>` | `caps` is letters from `TJM`, or `-` |
| `STAT T=0\|1 J=0\|1 M=0\|1` | which nodes answered |
| `T <ms> <tempC> <rh>` | temperature °C, relative humidity % |
| `J <ms> <x> <y> <btn>` | x and y in −127…127, button 0 or 1 |
| `M <ms> <ax> <ay> <az> <gx> <gy> <gz>` | acceleration in g, rotation in °/s |
| `PONG <ms>` | reply to `PING` |
| `ERR <text>` | a refused command or a missing node |
| `# <text>` | a log line; ignore it |

`<ms>` is the board's `millis()` at the moment the sensor was read. The app
pairs it with `PING`/`PONG` to estimate the offset between the board's clock and
its own, so USB scheduling jitter stays out of the reaction times. Do not batch
or reorder these lines.
