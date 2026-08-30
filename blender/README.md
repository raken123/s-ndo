# Caine — singing / lip-sync animation

Builds a bone-driven singing performance on the `Caine_rig` armature for the
line **"I'LL MAAAKE YOUUU SAAAY NA NA NA NA"** and renders it to MP4.

## Run it

```bash
# build the action and render the MP4 (background, no GUI)
blender Caine_new_rig_Malik_Radwan_V2_1.blend -b -P blender/caine_sing.py -- --render

# build only, then inspect it yourself in the GUI
blender Caine_new_rig_Malik_Radwan_V2_1.blend -P blender/caine_sing.py

# print a rig report and change nothing
blender Caine_new_rig_Malik_Radwan_V2_1.blend -b -P blender/caine_sing.py -- --inspect
```

Flags go after the bare `--`:

| flag | meaning |
| --- | --- |
| `--render` | render the animation to MP4 |
| `--inspect` | print a rig report and exit without touching the file |
| `--audio PATH` | load an audio file into the sequencer so it is muxed into the MP4 |
| `--out PATH` | output path (default `//caine_sing.mp4`, i.e. next to the .blend) |
| `--engine NAME` | `BLENDER_EEVEE_NEXT` (default), `CYCLES`, `BLENDER_WORKBENCH` |

Output is 1920×1920, 24 fps, H.264 in MP4, frames 1–180 (7.5 s).

**Run `--inspect` first.** It prints which of the bones the script drives are
actually present, and their rotation modes. If anything reports `MISSING`,
send me that report and I'll re-map those channels.

## There is no audio in the .blend

The uploaded file contains **no song**, verified five independent ways:

- 0 `bSound` datablocks (a VSE sound strip cannot exist without one)
- 0 Speaker objects
- no packed-file audio
- no `OggS` / `ID3` / `RIFF..WAVE` / `fLaC` / `ftypM4A` signature anywhere in
  the 179 MB of decompressed file data
- 0 audio filepath strings

So the timing in `LIPSYNC` is a musical phrasing of the line at 24 fps, not a
sync to a waveform. Pass `--audio yoursong.mp3` to mux a track into the render,
and nudge the frame numbers in `LIPSYNC` to line up with it.

## What the rig actually is

Read directly out of the file (Blender 5.0, zstd-compressed, 179 MB
decompressed, 605,129 data blocks):

- Scene: 24 fps, frames 1–250, 1920×1920
- 362 objects — 343 meshes, 4 armatures, 1 camera, 3 lights, 2 lattices, 9 empties
- Hero rig: object `Caine_rig` → armature `rig.003`, **602 bones** (Rigify body
  plus a custom face). Two other Caine rigs (`rig`, `rig.002`) and a `metarig`
  are also in the file.
- 22 existing actions (`Caine_rigAction`, `CameraAction`, `HatAction`, …)

### The mouth is not shape keys

There are 5 shape-key datablocks but they are generically named — `Basis`,
`Key 1` … `Key 4`. **No visemes, no phoneme targets.** The mouth is posed
entirely with bones.

### `MouthSlider` is a mode switch, not a mouth-open amount

Sliders travel on **local X**, pinned in Y and Z by a Limit Location constraint
(all six limit bits set). Most run `[0.0, 0.165]`; the four Crease sliders run
`[0.0, 0.02]`. `MouthSlider` is one of the 0.165 ones and drives:

```
pose.bones["GumTopCtrl"].constraints["Stretch To"].influence = var*1/0.165
pose.bones["GumBotCtrl"].constraints["Stretch To"].influence = var*1/0.165
pose.bones["GumTopCtrl.001"].hide                            = 1-var*1/0.165
pose.bones["GumBotCtrl.001"].hide                            = 1-var*1/0.165
```

The script leaves it alone so whichever mouth mode you saved is preserved. Set
`MOUTH_SLIDER` at the top of the script to `0.165` or `0.0` to force it.

The other sliders are visibility / material toggles on the same travel:
`TongueSlider` (tongue bone visibility), `EyesSlider` (eye material
`diffuse_color` + a Mix Shader factor), `BatonSlider`, `SuitSlider`,
`JeffreySlider`, `ErrorSlider`, `CatchlightSlider`, and the Brow/Crease sliders
(`collections_all[...].is_visible`).

### Bones the lip sync drives

| control | role |
| --- | --- |
| `GumTopCtrl` / `GumBotCtrl` | the lip arcs — main open/close |
| `TeethTopMidCtrl` / `TeethBotMidCtrl` | centre of the bite |
| `TeethTopCtrl.{L,R}.001–003` | upper corners / width, falling off toward the back |
| `TeethBotCtrl.{L,R}.001–003` | lower corners / width |
| `tongue.01`–`tongue.04` | tongue tip for N / L / D |
| `head`, `torso`, `chest` | bob and sway on stressed syllables |
| `BrowCtrl.L` / `BrowCtrl.R` | brow accents on held vowels |
| `EyesCtrl` | gaze flicks on the na-na-nas |
| `BatonCtrl` | baton flourish |

Geometry: the face points along **−Y**, up is **+Z**, and the mouth spans about
Z 2.4 → 4.0, so a full-open vowel moves the bottom arc ~0.34 units. The script
converts armature-space offsets into each bone's local space at runtime
(`to_local`), so bone roll does not have to be hardcoded.

## Tuning

Everything lives in two tables at the top of `caine_sing.py`:

- `VISEMES` — per-mouth-shape `open` / `width` / `tongue` values
- `LIPSYNC` — the `(frame, viseme)` timing sheet

`ACCENTS` lists the stressed frames that the head bob, brows and sway hook onto.

## `blend_inspect.py`

A standalone Blender-5.0 `.blend` reader that needs **no Blender** — it
decompresses the zstd container via `libzstd` and walks the SDNA directly. This
is what produced the facts above.

```bash
python3 blender/blend_inspect.py Caine_new_rig_Malik_Radwan_V2_1.blend
```

Reports datablock counts, scene settings, armatures and bone counts, shape-key
names, actions, slider Limit-Location ranges, driver targets, and an audio scan.
