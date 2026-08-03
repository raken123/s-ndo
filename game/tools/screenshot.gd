extends SceneTree

## Renders each level to a PNG so the visuals can be checked without a device.
##   xvfb-run godot --path game --script res://tools/screenshot.gd

const OUT_DIR := "user://shots"
const SETTLE_FRAMES := 30

func _initialize() -> void:
	DirAccess.make_dir_recursive_absolute(OUT_DIR)
	var main: Node2D = load("res://src/main.tscn").instantiate()
	root.add_child(main)
	await process_frame

	for i in Levels.DATA.size():
		main.load_level(i)
		# Dismiss the briefing overlay so the level itself is visible.
		main.phase = main.Phase.PLAYING
		main._hud.hide_overlay()
		main._hud.update_status(0, main.keycards_total, 0.35, false,
			Levels.DATA[i]["name"])
		for f in SETTLE_FRAMES:
			await process_frame
		var img := get_root().get_texture().get_image()
		var path := "%s/level_%d.png" % [OUT_DIR, i + 1]
		img.save_png(path)
		print("wrote ", ProjectSettings.globalize_path(path))

	quit(0)
