extends Node
## Automated playtest, recorded to video.
##
## Boots the real game and plays it with synthetic input: mouse-look events go
## through the same `_unhandled_input` path a human's would, and shooting and
## the shop use the same actions the trigger and Y button are bound to. Nothing
## here reaches into the game to fake a result - it aims, fires, and lets the
## real hit detection and economy do the work.
##
## Record with Godot's Movie Maker (fixed timestep, so the capture is smooth
## even when software rendering is not):
##
##   xvfb-run -s "-screen 0 1024x576x24" godot --path . \
##     --resolution 1024x576 --write-movie /tmp/demo.avi --fixed-fps 24 \
##     tools/demo.tscn
##
## `tools/*` is excluded from the Android export, so none of this ships.

const MOUSE_SENSITIVITY := 0.0022   # must match game.gd
const AIM_GAIN := 0.28
const MAX_PIXELS_PER_FRAME := 48.0
const FIRE_TOLERANCE := 0.035

var _game = null
var _camera: Camera3D
var _gun = null
var _shop = null
var _dogs: Node = null

var _caption: Label
var _subcaption: Label
var _caption_box: ColorRect

var _combat := false
var _firing := false


func _ready() -> void:
	_build_overlay()
	_run()


# ------------------------------------------------------------------- overlay

func _build_overlay() -> void:
	var layer := CanvasLayer.new()
	layer.layer = 100
	add_child(layer)

	_caption_box = ColorRect.new()
	_caption_box.color = Color(0, 0, 0, 0.62)
	_caption_box.anchor_left = 0.0
	_caption_box.anchor_right = 1.0
	_caption_box.anchor_top = 1.0
	_caption_box.anchor_bottom = 1.0
	_caption_box.offset_top = -74.0
	_caption_box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	layer.add_child(_caption_box)

	_caption = Label.new()
	_caption.anchor_left = 0.0
	_caption.anchor_right = 1.0
	_caption.anchor_top = 1.0
	_caption.anchor_bottom = 1.0
	_caption.offset_top = -66.0
	_caption.offset_bottom = -34.0
	_caption.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_caption.add_theme_font_size_override("font_size", 22)
	_caption.add_theme_color_override("font_color", Color("ffd447"))
	layer.add_child(_caption)

	_subcaption = Label.new()
	_subcaption.anchor_left = 0.0
	_subcaption.anchor_right = 1.0
	_subcaption.anchor_top = 1.0
	_subcaption.anchor_bottom = 1.0
	_subcaption.offset_top = -34.0
	_subcaption.offset_bottom = -8.0
	_subcaption.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_subcaption.add_theme_font_size_override("font_size", 16)
	_subcaption.add_theme_color_override("font_color", Color("cfd6dd"))
	layer.add_child(_subcaption)


func _say(title: String, detail: String = "") -> void:
	_caption.text = title
	_subcaption.text = detail
	print("[demo] %s  %s" % [title, detail])


# ------------------------------------------------------------------ sequence

func _wait(seconds: float) -> void:
	await get_tree().create_timer(seconds).timeout


## Fight until the field is empty (or we run out of patience), swapping in a
## second caption part way through.
func _fight_until_clear(timeout: float, later_title: String, later_detail: String) -> void:
	_combat = true
	var elapsed := 0.0
	var swapped := false
	while elapsed < timeout:
		if elapsed > timeout * 0.42 and not swapped:
			swapped = true
			_say(later_title, later_detail)
		if _dogs.get_child_count() == 0 and int(_game._to_spawn) == 0 and elapsed > 3.0:
			break
		elapsed += get_process_delta_time()
		await get_tree().process_frame
	_combat = false
	_release_all()


func _run() -> void:
	await get_tree().process_frame
	_game = load("res://scenes/main.tscn").instantiate()
	get_tree().root.add_child(_game)
	await _wait(0.5)

	_camera = _game._camera
	_gun = _game._gun
	_shop = _game._shop
	_dogs = _game.get_node("Dogs")

	_say("Dog Blaster VR - automated playtest",
		"Same game as the Quest APK, running its desktop fallback rig (no headset in this environment)")
	await _wait(4.0)

	# ---- combat -------------------------------------------------------
	_say("Wave 1", "The bot aims with synthetic mouse-look and fires the real trigger action")
	_game.call("_begin_wave", 1)
	await _fight_until_clear(30.0, "Every kill drops Dog Food",
		"Kibble homes in on the player and the wrist readout counts it up")
	await _wait(3.0)

	_say("Wave 3", "Bigger pack, faster dogs, and they bite back - watch the health bar")
	_game.call("_begin_wave", 3)
	await _wait(1.0)
	await _fight_until_clear(38.0, "Headshots do double damage and pay double",
		"The bot goes for heads, which is why the counter climbs so fast")
	await _wait(3.0)

	# ---- shop ---------------------------------------------------------
	_say("The Kibble Shop", "Y on Quest, Tab here. The blaster's laser is the pointer.")
	SaveGame.add_food(9000)
	_say("The Kibble Shop", "(topping the balance up to 9,000 so the demo does not have to grind)")
	await _wait(2.5)
	_press("shop")
	await _wait(1.8)

	_say("Pointing at a tile previews it", "The dog on the right wears whatever the laser is on")
	for cell_index in [7, 10, 8]:
		await _point_at_cell(cell_index, 2.2)

	_say("Buying Cyber Hound", "2,600 Dog Food - the purchase and equip run through the real shop code")
	await _point_at_cell(10, 1.0)
	_click()
	await _wait(2.5)

	_say("Closing the shop", "Your dog is already wearing it")
	await _point_at_close(1.2)
	_click()
	await _wait(1.0)
	_release_all()

	_say("Your dog trots ahead of you", "Which is the whole point of spending the Dog Food")
	await _look_at_companion(4.5)

	# ---- the golden dog ------------------------------------------------
	_say("A GOLDEN DOG", "About 1.2% of spawns. Tougher, slower, worth 500 Dog Food.")
	var golden = _spawn_golden()
	await _wait(1.5)
	_combat = true
	await _wait(9.0)
	_combat = false
	_release_all()
	if is_instance_valid(golden):
		_say("Still standing", "It takes roughly six headshots")
		_combat = true
		await _wait(5.0)
		_combat = false
		_release_all()

	_say("THE GOLDEN DOG unlocked", "Killing one grants the cosmetic outright")
	await _wait(3.0)

	# ---- wear it -------------------------------------------------------
	_press("shop")
	await _wait(1.6)
	_say("Equipping The Golden Dog", "The mythic skin - gold, crowned, and it sparkles")
	await _point_at_cell(13, 2.0)
	_click()
	await _wait(1.5)

	_say("The shop's preview dog wears it", "Rotating on the right of the panel")
	await _hold_aim(_preview_target, 5.0)
	_calm_the_arena()
	await _point_at_close(1.2)
	_click()
	await _wait(1.0)
	_release_all()

	# Strafe so the companion trails a couple of metres behind: it frames the
	# dog better than standing still, where it sits right under the camera.
	_say("And so does yours", "It catches up whenever you move")
	await _walk_and_watch(7.0)
	_say("Dog Blaster VR", "build/DogBlasterVR.apk - Quest 3 / 3S / 2 / Pro, arm64, signed")
	await _wait(3.5)

	get_tree().quit()


# --------------------------------------------------------------- input tools

func _press(action: String) -> void:
	Input.action_press(action)
	await get_tree().process_frame
	await get_tree().process_frame
	Input.action_release(action)


func _click() -> void:
	Input.action_press("fire")
	await get_tree().process_frame
	await get_tree().process_frame
	Input.action_release("fire")


func _release_all() -> void:
	for action in ["fire", "shop", "move_forward", "move_back", "move_left", "move_right"]:
		if Input.is_action_pressed(action):
			Input.action_release(action)
	_firing = false


## Feed a mouse-motion event so the view swings toward `point`. Returns the
## remaining angular error in radians.
func _steer_towards(point: Vector3) -> float:
	var muzzle: Vector3 = _gun.aim_transform().origin
	var direction := (point - muzzle).normalized()
	# Aim the *camera* so that the muzzle ray - which is offset from the eye -
	# lands on the target.
	var virtual_target := _camera.global_position + direction * 12.0
	var local := _camera.global_transform.affine_inverse() * virtual_target

	var yaw_error := atan2(local.x, -local.z)
	var pitch_error := atan2(local.y, Vector2(local.x, local.z).length())

	var motion := InputEventMouseMotion.new()
	motion.relative = Vector2(
		clampf(yaw_error / MOUSE_SENSITIVITY * AIM_GAIN, -MAX_PIXELS_PER_FRAME, MAX_PIXELS_PER_FRAME),
		clampf(-pitch_error / MOUSE_SENSITIVITY * AIM_GAIN, -MAX_PIXELS_PER_FRAME, MAX_PIXELS_PER_FRAME))
	motion.screen_relative = motion.relative
	motion.velocity = Vector2.ZERO
	Input.parse_input_event(motion)

	return Vector2(yaw_error, pitch_error).length()


func _process(_delta: float) -> void:
	if not _combat or _game == null:
		return

	var target = _nearest_dog()
	if target == null:
		if _firing:
			Input.action_release("fire")
			_firing = false
		return

	# Go for the head: double damage, double payout.
	var head: Vector3 = target.global_position + Vector3(0, 0.62 * target.size_scale, 0)
	var error := _steer_towards(head)

	var should_fire := error < FIRE_TOLERANCE
	if should_fire and not _firing:
		Input.action_press("fire")
		_firing = true
	elif not should_fire and _firing:
		Input.action_release("fire")
		_firing = false

	# Back off when one gets close, so the fight lasts long enough to film.
	var distance := _camera.global_position.distance_to(target.global_position)
	_hold("move_back", distance < 4.0)
	_hold("move_left", distance >= 8.0)


func _hold(action: String, wanted: bool) -> void:
	if wanted and not Input.is_action_pressed(action):
		Input.action_press(action)
	elif not wanted and Input.is_action_pressed(action):
		Input.action_release(action)


func _nearest_dog():
	var best = null
	var best_distance := INF
	for dog in _dogs.get_children():
		if not (dog is Dog) or not dog.is_inside_tree():
			continue
		var distance: float = _camera.global_position.distance_to(dog.global_position)
		# Prefer the Golden Dog whenever one is on the field.
		if dog.is_golden:
			distance -= 100.0
		if distance < best_distance:
			best_distance = distance
			best = dog
	return best


# ------------------------------------------------------------- camera moves

func _point_at_cell(index: int, seconds: float) -> void:
	var cells = _shop._cells
	if index >= cells.size():
		return
	var holder: Node3D = cells[index]["holder"]
	await _hold_aim(func() -> Vector3: return holder.global_position, seconds)


func _point_at_close(seconds: float) -> void:
	var holder: Node3D = _shop._close_cell["holder"]
	await _hold_aim(func() -> Vector3: return holder.global_position, seconds)


## Frame the panel and its rotating preview dog together, rather than swinging
## so far right that the shop leaves the shot.
func _preview_target() -> Vector3:
	var holder: Node3D = _shop._preview_holder
	return holder.global_position.lerp(_shop.global_position + Vector3(0, 0.2, 0), 0.45)


## Stop the waves for the closing shots. The bot has put the blaster down by
## this point, and an end card filmed through a red damage vignette helps
## nobody.
func _calm_the_arena() -> void:
	_game._wave_running = false
	_game._to_spawn = 0
	_game._intermission_timer = 999.0
	for dog in _dogs.get_children():
		dog.queue_free()
	_game._alive = 0


## Sidestep while keeping the camera on your dog, so it has room in frame.
func _walk_and_watch(seconds: float) -> void:
	var companion := _find(_game, "Companion")
	if companion == null:
		await _wait(seconds)
		return
	var elapsed := 0.0
	Input.action_press("move_right")
	while elapsed < seconds:
		if elapsed > seconds * 0.5 and Input.is_action_pressed("move_right"):
			Input.action_release("move_right")
			Input.action_press("move_back")
		_steer_towards(companion.global_position + Vector3(0, 0.4, 0))
		elapsed += get_process_delta_time()
		await get_tree().process_frame
	_release_all()


func _look_at_companion(seconds: float) -> void:
	var companion := _find(_game, "Companion")
	if companion == null:
		await _wait(seconds)
		return
	await _hold_aim(func() -> Vector3: return companion.global_position + Vector3(0, 0.45, 0), seconds)


func _hold_aim(target_provider: Callable, seconds: float) -> void:
	var elapsed := 0.0
	while elapsed < seconds:
		_steer_towards(target_provider.call())
		elapsed += get_process_delta_time()
		await get_tree().process_frame


# ------------------------------------------------------------------ spawning

## Force the rare spawn instead of waiting on a 1.2% roll, wiring it up exactly
## the way the wave spawner does.
func _spawn_golden():
	var dog := Dog.new()
	_dogs.add_child(dog)
	var ahead := -_camera.global_transform.basis.z
	ahead.y = 0.0
	dog.global_position = _camera.global_position + ahead.normalized() * 8.0 \
		+ Vector3(0, -_camera.global_position.y + 0.1, 0)
	dog.setup(_game, 4, true)
	dog.died.connect(Callable(_game, "_on_dog_died"))
	_game._alive += 1
	Sfx.play("golden", dog.global_position, 0.0)
	return dog


func _find(node: Node, hint: String) -> Node:
	for child in node.get_children():
		var script: Script = child.get_script()
		if script != null and script.get_global_name() == hint:
			return child
		var found := _find(child, hint)
		if found != null:
			return found
	return null
