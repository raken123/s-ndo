# uno_q_bridge — serial to WebSocket

`bridge.py` relays the InfoDoc line protocol between a serial port and a
WebSocket. It parses nothing; it is a pipe.

## Why the UNO Q needs it

The UNO Q has two brains. Arduino sketches run on the STM32U585 MCU, while the
USB-C socket belongs to the Qualcomm Dragonwing MPU running Debian. So the
sketch's `Serial` is generally **not** a serial port the host computer can open
— the host sees the Linux side of the board, not the MCU.

Run this on the board's Linux side instead. It opens the tty the MCU is on and
serves the same lines over `ws://<board>:8787`, which InfoDoc's network
transport connects to.

On a board whose sketch `Serial` *is* the USB CDC endpoint — UNO R4, Nano ESP32,
MKR, Nano 33 — you do not need this at all. Use InfoDoc's USB serial transport.

## Running it

```sh
python3 bridge.py                     # autodetect the tty, listen on 8787
python3 bridge.py --list              # show candidate ttys and exit
python3 bridge.py --port /dev/ttyACM0 --baud 115200
python3 bridge.py --host 127.0.0.1    # localhost only
python3 bridge.py -v                  # log every line
```

No dependencies are required. `pyserial` is used when it is installed;
otherwise the port is configured with `stty` and opened as a plain file. The
WebSocket server is stdlib only.

Which tty the MCU is on depends on the board and the kernel, so check first:

```sh
python3 bridge.py --list
ls -l /dev/tty*
```

`--port` takes whatever you find. The autodetect order is `ttyMCU*`, `ttymxc*`,
`ttyRPMSG*`, `ttyACM*`, `ttyUSB*`, then the macOS `cu.usbmodem*` names — the
specific names first, so it does not grab a modem by mistake.

## Keeping it running

```ini
# /etc/systemd/system/infodoc-bridge.service
[Unit]
Description=InfoDoc serial bridge
After=network.target

[Service]
ExecStart=/usr/bin/python3 /opt/infodoc/bridge.py --host 0.0.0.0 --listen 8787
Restart=always
RestartSec=2
User=root

[Install]
WantedBy=multi-user.target
```

```sh
sudo systemctl enable --now infodoc-bridge
```

## Security

The bridge has no authentication and binds to every interface by default.
Anything that can reach port 8787 can read the sensor stream and send commands
to the MCU. There is no patient data on this link — only temperatures, stick
positions and accelerations — but on a clinic network either bind it to
`127.0.0.1` and tunnel, or firewall the port to the one machine running InfoDoc.

## Other uses

It is not UNO Q specific. It also works on a Raspberry Pi with an Arduino
plugged in, or on the InfoDoc machine itself if you would rather not give the
app direct serial access.
