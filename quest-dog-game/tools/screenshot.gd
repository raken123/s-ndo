extends Node
## Boots the real game, poses the camera at a few interesting angles and writes
## PNGs so the visuals can be reviewed without a headset.
##
##   xvfb-run -s "-screen 0 1600x900x24" godot --path . tools/screenshot.tscn
##
## Shots land in user:// (~/.local/share/godot/app_userdata/Dog Blaster VR/).

var _game = null


func _ready() -> void:
	_run()


func _wait(seconds: float) -> void:
	await get_tree().create_timer(seconds).timeout


func _run() -> void:
	await get_tree().process_frame
	_game = load("res://scenes/main.tscn").instantiate()
	get_tree().root.add_child(_game)
	await _wait(1.0)

	var camera: Camera3D = _game._camera
	var origin: Node3D = _game._origin

	# 1. The arena, mid-wave, with a pack closing in.
	_game.call("_begin_wave", 4)
	await _wait(6.0)
	origin.global_position = Vector3(0, 0, 6)
	origin.rotation = Vector3(0, PI, 0)
	camera.rotation.x = -0.12
	await _wait(2.5)
	await _shoot("01_arena")

	# 2. Close-up on the pack.
	camera.rotation.x = -0.05
	await _wait(3.0)
	await _shoot("02_pack")

	# 3. The shop, stocked and affordable.
	SaveGame.add_food(40000)
	SaveGame.grant("golden")
	_game._shop.call("open", camera)
	await _wait(1.2)
	await _shoot("03_shop")

	# 4. Your dog wearing The Golden Dog.
	SaveGame.equip("golden")
	_game.call("_on_loadout_changed")
	_game._shop.call("close")
	await _wait(0.6)
	camera.rotation.x = -0.30
	await get_tree().process_frame
	var companion: Node3D = _find(_game, "Companion")
	if companion != null:
		companion.set_process(false)
		var ahead := -camera.global_transform.basis.z
		ahead.y = 0.0
		companion.global_position = camera.global_position + ahead.normalized() * 2.6 \
			+ Vector3(0, -camera.global_position.y, 0)
		companion.rotation.y = atan2(-ahead.x, -ahead.z)
	await _wait(1.5)
	await _shoot("04_golden_dog")

	get_tree().quit()


func _shoot(name: String) -> void:
	await RenderingServer.frame_post_draw
	var image := get_viewport().get_texture().get_image()
	var path := "user://%s.png" % name
	image.save_png(path)
	print("wrote ", ProjectSettings.globalize_path(path))


func _find(node: Node, hint: String) -> Node:
	for child in node.get_children():
		var script: Script = child.get_script()
		if script != null and script.get_global_name() == hint:
			return child
		var found := _find(child, hint)
		if found != null:
			return found
	return null
