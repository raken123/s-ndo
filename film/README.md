# The Clock in the Hollow

A low-poly 3D short film (about 3½ minutes) about Elin, a girl who finds a magic clock in the forest and turns its hands to travel through time.

Open `film/index.html` in any modern browser, or visit `/film/` on the deployed site. Press play; space pauses, ← → skip between scenes, `m` mutes, `f` goes fullscreen.

Everything is generated in code inside the single HTML file:

- A small WebGL2 renderer (flat-shaded meshes with vertex colours, directional shadow map, hemisphere light, fog, point lights, sky shader, additive particles). No external libraries or assets.
- Procedural low-poly scenery for four eras: the forest at dusk, a prehistoric valley with a sauropod and a volcano, a snowy medieval village, and a crystal future with floating islands.
- Rigged characters built from primitives (Elin, a villager, a sauropod, a deer, pterosaurs, birds, a drone) with walk, wave, reach, sit and gaze poses.
- A 13-shot timeline driving camera moves, staging, captions and transitions; every frame is a pure function of time, so seeking is instant.
- Procedural sound via the Web Audio API: era chords, clock ticks, the time-vortex whoosh, bells, a roar and birdsong.
