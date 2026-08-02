# Kinger on Claude — a 3D testimonial scene

A short animated piece built in Blender from the supplied `Kinger_new_rig` file:
Kinger stands on a softly lit set and gives a testimonial about Claude.

| | |
|---|---|
| Output | `out/kinger_on_claude.mp4` — 1280×720, 24 fps, 16.5 s |
| Scene | `kinger_testimonial.blend` — full set, lighting, camera and animation |
| Engine | Cycles, CPU, 24 samples + OpenImageDenoise |

## The performance problem

Kinger has **no mouth** — the rig drives brows, eyelids, eye shape, pupils, gaze
and two floating gloved hands, and nothing else. So there is no lip sync to do,
and the "talking" has to be carried by everything except a mouth:

- **Head** — a 3.55 Hz bob layered over the pose track, gated to the beats where
  he is actually speaking, so the rhythm reads as speech rather than fidgeting.
- **Brows** — raise and angle per beat, plus a small lift on stressed syllables.
- **Eyes** — pupil dilation for surprise, a squash/stretch squint for warmth,
  gaze drifting away as he recalls and snapping back on the punchline.
- **Blinks** — the lid meshes are a *binary* visibility switch, not a smooth
  morph, so blinks are keyed with `CONSTANT` interpolation over 2 frames.
- **Hands** — the gesture track, doing most of the emotional lifting.

## Notes on the rig

Things worth knowing before animating this character again:

- **The rest pose has the eyes shut.** `LidTop/LidBot.{L,R}` local **Y** drives a
  `hide_render` boolean: `0.0` shows the lid meshes (closed), `0.38` hides them
  (open). It flips at the midpoint, so it can only ever snap.
- **Brows and creases work the same way**, driven by the `BrowSlider*`,
  `BrowCreaseSlider*` and `EyeCreaseSlider*` bones' local **X**. They are visible
  at `0.0` and hidden at `0.03` — the opposite of what the names suggest.
- **Pupil size** is a shape key driven by `Pupil.{L,R}` *scale*, and iris size by
  `Iris.{L,R}` scale. Past roughly `1.3` the pupil swallows the blue iris and the
  eye reads as blank, so the dilation track stays under that.
- **There are no arm bones.** `DEF-upper_arm.*` and `DEF-forearm.*` appear in the
  `Hands` vertex groups and in several drivers, but no such bones exist — those
  drivers are dead. The gloves are moved by setting `hand_ik.{L,R}` `pb.matrix`
  directly, and because nothing connects them to the body they can go anywhere.
- **Glove orientation matters a lot.** The mitt is a flat, palm-down shape lying
  in the XY plane. Pitching it about −90° turns the palm to the lens and it reads
  as a hand; yawing it toward the lens instead foreshortens it into a blob.
- His eyes sit at different heights by design; that is not a rigging error.

## Rebuilding

`bl/` is a symlink to a virtualenv holding the `bpy` 5.0.1 wheel — the source
file is a Blender 5.0 file, so 4.x cannot open it.

```sh
./bl/bin/python build_scene.py          # writes kinger_testimonial.blend
./bl/bin/python render.py preview       # a few key frames, for checking
./bl/bin/python render.py frames        # the full sequence (resumable)
./bl/bin/python compose.py              # captions + encode to mp4
```

Two environment quirks are worth keeping in mind:

- `import numpy` **must** come before `import bpy`, or the wheel aborts with a
  glog "InitGoogleLogging() twice" failure.
- The `bpy` wheel is built without FFMPEG, so Blender cannot encode video here.
  `compose.py` draws the captions with Pillow and pipes frames to `ffmpeg`.

Rendering takes about 28 s/frame on 4 CPU cores, so roughly 3 hours for the full
396 frames. EEVEE is available but falls back to software GL in this container
and is ~2× *slower* than Cycles, so Cycles CPU it is.

## Credit

The character model and rig are the supplied `Kinger_new_rig_Malik_Radwan.blend`.
Everything in `build_scene.py` — set, lighting, camera, animation — is new.
