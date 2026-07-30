# gmfy 3.3.0 — 60-minute cinema cut

The presentation master, split into 24 parts because GitHub rejects any single
file over 100 MB. The parts are stream copies: joining them reproduces the
master's video stream byte for byte.

## The master

| | |
|---|---|
| Duration | `01:00:00.00` |
| Video | H.264 High, 1920x1080, 24 fps, 1349 kb/s |
| Audio | none — the file has no audio stream at all |
| Size | 608,302,631 bytes (580.1 MiB) |
| SHA-256 | `5cbc81bd9c1eda39708bcbf0d53cdfe6c27f682b59aa54b53835f43d62b2e316` |
| Video stream MD5 | `cd02883342b7e71ed39b7dcc251f0eac` |

## Rejoining

```sh
printf "file '%s'\n" cinema_p*.mp4 > list.txt
ffmpeg -f concat -safe 0 -i list.txt -c copy -an gmfy_3.3.0_cinema_60min.mp4
```

No re-encoding happens, so this is lossless. To confirm the result:

```sh
ffmpeg -v error -i gmfy_3.3.0_cinema_60min.mp4 -c copy -f streamhash -hash md5 -
# expect: 0,v,MD5=cd02883342b7e71ed39b7dcc251f0eac
```

The rejoined file will not be byte-identical to the original master — the MP4
container is remuxed, so headers differ — but every video packet is the same,
which is what the stream hash above checks.

Note the parts were produced with ffmpeg's `segment` muxer, which cuts only on
keyframes. Their individual durations therefore vary slightly around 150
seconds; together they cover the hour exactly once, with no overlap and no gap.

## Contents

19 chapters, 110 slides, 3600 seconds exactly.

| Ch | Topic |
|---|---|
| 01 | Opening |
| 02 | What gmfy is |
| 03 | The editor |
| 04 | The pieces — all 17 kinds |
| 05 | Sculpting *(new in 3.3.0)* |
| 06 | Weather *(new in 3.3.0)* |
| 07 | Day and night *(new in 3.3.0)* |
| 08 | Ghost racing *(new in 3.3.0)* |
| 09 | Photo mode *(new in 3.3.0)* |
| 10 | Blocks — the palette |
| 11 | Real control flow |
| 12 | Playing it |
| 13 | Accounts |
| 14 | Sharing |
| 15 | The classroom |
| 16 | Plans |
| 17 | Exporting |
| 18 | Putting it together |
| 19 | Everything in 3.3.0 |

Built for silent projection: no audio track, every element revealed only when
it is needed, and no two pieces of text ever on screen in the same place.
