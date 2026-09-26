extends Node
## Plays the running game with simulated input and takes screenshots (see probe.gd).

const SHOT_FRAMES := [75, 170, 265]
const END_FRAME := 280
var frame := 0
var out_dir := ""
var actions: Array[StringName] = []
var held: Array[StringName] = []
var rng := RandomNumberGenerator.new()

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	out_dir = OS.get_environment("NEXORA_PROBE_OUT")
	rng.seed = 7

func _collect_actions() -> void:
	for a in InputMap.get_actions():
		var s := String(a)
		if s.begins_with("ui_") and not s in ["ui_accept", "ui_left", "ui_right", "ui_up", "ui_down"]:
			continue
		if s.begins_with("spatial_editor") or s.begins_with("editor"):
			continue
		actions.append(a)

func _send(action: StringName, pressed: bool) -> void:
	var ev := InputEventAction.new()
	ev.action = action
	ev.pressed = pressed
	ev.strength = 1.0 if pressed else 0.0
	Input.parse_input_event(ev)
	if pressed:
		Input.action_press(action)
	else:
		Input.action_release(action)

func _process(_delta: float) -> void:
	frame += 1
	if frame == 10:
		_collect_actions()
		print("NEXORA_PROBE_ACTIONS ", actions)
	# Every 18 frames: release what is held, then hold one or two random actions.
	if frame > 12 and frame % 18 == 0 and not actions.is_empty():
		for a in held:
			_send(a, false)
		held.clear()
		for i in range(1 + rng.randi() % 2):
			var a: StringName = actions[rng.randi() % actions.size()]
			if not held.has(a):
				held.append(a)
				_send(a, true)
	if frame in SHOT_FRAMES:
		_shot()
	if frame >= END_FRAME:
		print("NEXORA_PROBE_DONE frames=%d fps=%.1f nodes=%d" % [frame, Engine.get_frames_per_second(), get_tree().get_node_count()])
		get_tree().quit(0)

func _shot() -> void:
	if out_dir == "" or DisplayServer.get_name() == "headless":
		return
	var tex := get_viewport().get_texture()
	if tex == null:
		return
	var img := tex.get_image()
	if img == null or img.is_empty():
		return
	if img.get_width() > 960:
		img.resize(960, int(img.get_height() * 960.0 / img.get_width()), Image.INTERPOLATE_BILINEAR)
	var path := out_dir.path_join("shot_%03d.png" % frame)
	var err := img.save_png(path)
	print("NEXORA_PROBE_SHOT ", path, " err=", err)
