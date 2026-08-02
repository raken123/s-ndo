extends Node3D
## Dog Blaster VR - main game loop.
##
## Boots OpenXR when a headset is present (Quest 3 / Quest 2 / Quest Pro) and
## falls back to a flat-screen mouse+keyboard build otherwise, so the exact
## same project can be tested on a desktop.

const ARENA_RADIUS := 17.0
const MAX_ALIVE := 11
const PLAYER_MAX_HEALTH := 100.0
const HEALTH_REGEN := 5.0
const REGEN_DELAY := 4.0
const MOVE_SPEED := 3.1
const SNAP_TURN_DEGREES := 30.0
const DESKTOP_EYE_HEIGHT := 1.65
const INTERMISSION := 8.0

var vr_mode := false

var _origin: Node3D
var _camera: Camera3D
var _left_controller: XRController3D
var _right_controller: XRController3D
var _gun: KibbleBlaster
var _hud: WristHud
var _shop: KibbleShop
var _companion: Companion
var _announcement: Label3D
var _damage_flash: MeshInstance3D
var _dog_root: Node3D

var _health := PLAYER_MAX_HEALTH
var _time_since_damage := 99.0
var _downed := false

var _wave := 0
var _to_spawn := 0
var _alive := 0
var _kills := 0
var _spawn_timer := 0.0
var _intermission_timer := 0.0
var _wave_running := false

var _snap_turn_ready := true
var _shop_button_was_down := false
var _trigger_was_down := false
var _mouse_captured := false
var _announcement_tween: Tween
var _flash_tween: Tween


func _ready() -> void:
	randomize()
	_setup_input_map()
	_setup_xr()
	_build_environment()
	_build_arena()
	_build_player()
	Sfx.attach(self)
	_build_ui()

	_dog_root = Node3D.new()
	_dog_root.name = "Dogs"
	add_child(_dog_root)

	_companion = Companion.new()
	add_child(_companion)
	_companion.global_position = Vector3(1.2, 0, -1.0)
	_companion.setup(self)

	_hud.set_food(SaveGame.food)
	_hud.set_health(_health, PLAYER_MAX_HEALTH)
	_hud.set_kills(_kills)

	_announce("DOG BLASTER", Color("ffd447"), 3.5)
	await get_tree().create_timer(3.0).timeout
	if is_inside_tree():
		_announce(_controls_hint(), Color("9ef7ff"), 5.0)
		await get_tree().create_timer(5.0).timeout
	if is_inside_tree():
		_begin_wave(1)


## Desktop fallback bindings, registered at runtime so the project file stays
## free of hand-written InputEvent serialisation.
func _setup_input_map() -> void:
	var bindings := {
		"fire": [MOUSE_BUTTON_LEFT],
		"reload": [KEY_R],
		"shop": [KEY_TAB],
		"move_forward": [KEY_W, KEY_UP],
		"move_back": [KEY_S, KEY_DOWN],
		"move_left": [KEY_A, KEY_LEFT],
		"move_right": [KEY_D, KEY_RIGHT],
	}
	for action in bindings:
		if not InputMap.has_action(action):
			InputMap.add_action(action)
		for code in bindings[action]:
			if action == "fire":
				var click := InputEventMouseButton.new()
				click.button_index = code
				InputMap.action_add_event(action, click)
			else:
				var key := InputEventKey.new()
				key.physical_keycode = code
				InputMap.action_add_event(action, key)


func _controls_hint() -> String:
	if vr_mode:
		return "Trigger: shoot   Y: shop   Sticks: move + turn"
	return "Click: shoot   Tab: shop   WASD: move   R: reload"


# ------------------------------------------------------------------------ XR

func _setup_xr() -> void:
	var interface := XRServer.find_interface("OpenXR")
	if interface != null and interface.is_initialized():
		vr_mode = true
		get_viewport().use_xr = true
		# The XR compositor paces frames; let it, and never block on vsync.
		DisplayServer.window_set_vsync_mode(DisplayServer.VSYNC_DISABLED)
		Engine.max_fps = 0
		print("[DogBlaster] OpenXR active - running in VR")
	else:
		vr_mode = false
		print("[DogBlaster] No XR runtime - running the desktop fallback")


# --------------------------------------------------------------------- world

func _build_environment() -> void:
	var sky_material := ProceduralSkyMaterial.new()
	sky_material.sky_top_color = Color("2f6fd0")
	sky_material.sky_horizon_color = Color("bcd8ee")
	sky_material.ground_bottom_color = Color("4a6b3c")
	sky_material.ground_horizon_color = Color("9fb98c")
	sky_material.sun_angle_max = 18.0

	var sky := Sky.new()
	sky.sky_material = sky_material

	var environment := Environment.new()
	environment.background_mode = Environment.BG_SKY
	environment.sky = sky
	environment.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	environment.ambient_light_energy = 1.0
	environment.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	environment.ssao_enabled = false
	environment.glow_enabled = false

	var world_environment := WorldEnvironment.new()
	world_environment.environment = environment
	add_child(world_environment)

	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-48, -35, 0)
	sun.light_energy = 1.15
	sun.light_color = Color("fff2df")
	sun.shadow_enabled = true
	sun.directional_shadow_max_distance = 32.0
	sun.directional_shadow_mode = DirectionalLight3D.SHADOW_ORTHOGONAL
	sun.shadow_bias = 0.04
	add_child(sun)


func _build_arena() -> void:
	var ground := MeshInstance3D.new()
	var plane := PlaneMesh.new()
	plane.size = Vector2(70, 70)
	ground.mesh = plane
	var grass := StandardMaterial3D.new()
	grass.albedo_color = Color.WHITE
	grass.albedo_texture = _grass_texture()
	grass.uv1_scale = Vector3(24, 24, 1)
	grass.roughness = 0.95
	ground.material_override = grass
	add_child(ground)

	var floor_body := StaticBody3D.new()
	floor_body.collision_layer = 1
	floor_body.collision_mask = 0
	var floor_shape := CollisionShape3D.new()
	var floor_box := BoxShape3D.new()
	floor_box.size = Vector3(70, 1, 70)
	floor_shape.shape = floor_box
	floor_shape.position = Vector3(0, -0.5, 0)
	floor_body.add_child(floor_shape)
	add_child(floor_body)

	_build_scenery()


func _grass_texture() -> ImageTexture:
	var size := 64
	var image := Image.create(size, size, false, Image.FORMAT_RGB8)
	var rng := RandomNumberGenerator.new()
	rng.seed = 424242
	for y in range(size):
		for x in range(size):
			var checker: bool = ((x / 8) + (y / 8)) % 2 == 0
			var base := Color("6fa04a") if checker else Color("659447")
			var noise := rng.randf_range(-0.045, 0.045)
			image.set_pixel(x, y, Color(base.r + noise, base.g + noise, base.b + noise))
	return ImageTexture.create_from_image(image)


## All the static props are merged into one mesh with three surfaces so the
## whole park costs three draw calls.
func _build_scenery() -> void:
	var wood := SurfaceTool.new()
	var leaf := SurfaceTool.new()
	var accent := SurfaceTool.new()
	for surface in [wood, leaf, accent]:
		surface.begin(Mesh.PRIMITIVE_TRIANGLES)

	var cylinder := CylinderMesh.new()
	cylinder.top_radius = 0.5
	cylinder.bottom_radius = 0.5
	cylinder.height = 1.0
	cylinder.radial_segments = 8
	cylinder.rings = 1
	var cone := CylinderMesh.new()
	cone.top_radius = 0.0
	cone.bottom_radius = 0.5
	cone.height = 1.0
	cone.radial_segments = 8
	cone.rings = 1
	var sphere := SphereMesh.new()
	sphere.radius = 0.5
	sphere.height = 1.0
	sphere.radial_segments = 10
	sphere.rings = 5
	var box := BoxMesh.new()
	box.size = Vector3.ONE

	var rng := RandomNumberGenerator.new()
	rng.seed = 90210

	# Perimeter fence.
	var posts := 56
	var fence_bodies := StaticBody3D.new()
	fence_bodies.collision_layer = 1
	fence_bodies.collision_mask = 0
	add_child(fence_bodies)
	for i in range(posts):
		var angle := TAU * float(i) / float(posts)
		var pos := Vector3(sin(angle), 0, cos(angle)) * (ARENA_RADIUS + 1.0)
		_stamp(wood, box, pos + Vector3(0, 0.7, 0), Vector3(0, rad_to_deg(-angle), 0), Vector3(0.11, 1.4, 0.11))
		# Rails between posts.
		var next := TAU * float(i + 1) / float(posts)
		var next_pos := Vector3(sin(next), 0, cos(next)) * (ARENA_RADIUS + 1.0)
		var mid := (pos + next_pos) * 0.5
		var length := pos.distance_to(next_pos) * 1.08
		# A box's long axis is +Z, so yaw by the mid-angle plus 90 degrees to lay
		# it along the circle's tangent instead of pointing it at the centre.
		var rail_yaw := rad_to_deg((angle + next) * 0.5) + 90.0
		for height in [0.55, 1.05]:
			_stamp(wood, box, mid + Vector3(0, height, 0), Vector3(0, rail_yaw, 0),
				Vector3(0.06, 0.12, length))
		if i % 4 == 0:
			var shape := CollisionShape3D.new()
			var collider := BoxShape3D.new()
			collider.size = Vector3(2.2, 2.0, 0.4)
			shape.shape = collider
			shape.position = pos + Vector3(0, 1.0, 0)
			shape.rotation = Vector3(0, -angle, 0)
			fence_bodies.add_child(shape)

	# Trees.
	for i in range(22):
		var angle := rng.randf() * TAU
		var radius := rng.randf_range(6.0, ARENA_RADIUS - 1.2)
		var base := Vector3(sin(angle), 0, cos(angle)) * radius
		var height := rng.randf_range(2.2, 3.6)
		_stamp(wood, cylinder, base + Vector3(0, height * 0.5, 0), Vector3.ZERO, Vector3(0.34, height, 0.34))
		for blob in range(3):
			var blob_y := height + 0.35 + blob * 0.55
			var blob_scale: float = 2.4 - blob * 0.55
			_stamp(leaf, sphere, base + Vector3(rng.randf_range(-0.25, 0.25), blob_y, rng.randf_range(-0.25, 0.25)),
				Vector3.ZERO, Vector3(blob_scale, blob_scale * 0.8, blob_scale))

	# Dog houses.
	for i in range(5):
		var angle := TAU * float(i) / 5.0 + 0.4
		var base := Vector3(sin(angle), 0, cos(angle)) * rng.randf_range(9.0, 14.0)
		_stamp(wood, box, base + Vector3(0, 0.55, 0), Vector3(0, rng.randf() * 360.0, 0), Vector3(1.5, 1.1, 1.6))
		_stamp(accent, cone, base + Vector3(0, 1.45, 0), Vector3(0, 45, 0), Vector3(1.9, 0.9, 1.9))

	# Fire hydrants and scattered bones.
	for i in range(7):
		var angle := rng.randf() * TAU
		var base := Vector3(sin(angle), 0, cos(angle)) * rng.randf_range(4.0, ARENA_RADIUS - 2.0)
		_stamp(accent, cylinder, base + Vector3(0, 0.3, 0), Vector3.ZERO, Vector3(0.26, 0.6, 0.26))
		_stamp(accent, sphere, base + Vector3(0, 0.62, 0), Vector3.ZERO, Vector3(0.28, 0.28, 0.28))
		_stamp(accent, cylinder, base + Vector3(0, 0.42, 0), Vector3(0, 0, 90), Vector3(0.09, 0.62, 0.09))

	var mesh := ArrayMesh.new()
	wood.commit(mesh)
	leaf.commit(mesh)
	accent.commit(mesh)

	var instance := MeshInstance3D.new()
	instance.mesh = mesh
	instance.set_surface_override_material(0, _simple_material(Color("6b4a2a"), 0.9))
	instance.set_surface_override_material(1, _simple_material(Color("3f7f39"), 0.95))
	instance.set_surface_override_material(2, _simple_material(Color("c1443c"), 0.7))
	add_child(instance)


func _stamp(surface: SurfaceTool, source: Mesh, at: Vector3, rot_degrees: Vector3, size: Vector3) -> void:
	# Scale first, then rotate. Basis.scaled() would scale along the *world*
	# axes, which laid the fence rails across the radius instead of the tangent.
	var basis := Basis.from_euler(Vector3(
		deg_to_rad(rot_degrees.x), deg_to_rad(rot_degrees.y), deg_to_rad(rot_degrees.z))) \
		* Basis.from_scale(size)
	surface.append_from(source, 0, Transform3D(basis, at))


func _simple_material(color: Color, roughness: float) -> StandardMaterial3D:
	var mat := StandardMaterial3D.new()
	mat.albedo_color = color
	mat.roughness = roughness
	return mat


# -------------------------------------------------------------------- player

func _build_player() -> void:
	if vr_mode:
		var origin := XROrigin3D.new()
		origin.name = "XROrigin"
		add_child(origin)
		_origin = origin

		var camera := XRCamera3D.new()
		camera.name = "XRCamera"
		camera.near = 0.05
		camera.far = 120.0
		origin.add_child(camera)
		_camera = camera

		_left_controller = XRController3D.new()
		_left_controller.tracker = &"left_hand"
		_left_controller.pose = &"grip"
		origin.add_child(_left_controller)

		_right_controller = XRController3D.new()
		_right_controller.tracker = &"right_hand"
		_right_controller.pose = &"aim"
		origin.add_child(_right_controller)

		_add_hand_mesh(_left_controller)
	else:
		_origin = Node3D.new()
		_origin.name = "Origin"
		add_child(_origin)

		var camera := Camera3D.new()
		camera.name = "Camera"
		camera.position = Vector3(0, DESKTOP_EYE_HEIGHT, 0)
		camera.near = 0.05
		camera.far = 120.0
		camera.current = true
		_origin.add_child(camera)
		_camera = camera

		_set_mouse_captured(true)

	_origin.position = Vector3(0, 0, 0)

	_gun = KibbleBlaster.new()
	if vr_mode:
		_right_controller.add_child(_gun)
		_gun.position = Vector3(0, 0, 0)
	else:
		_camera.add_child(_gun)
		_gun.position = Vector3(0.20, -0.20, -0.34)
	_gun.set_accent(Skins.get_skin(SaveGame.equipped)["secondary"])

	_damage_flash = MeshInstance3D.new()
	var quad := QuadMesh.new()
	quad.size = Vector2(4, 4)
	_damage_flash.mesh = quad
	var flash_material := StandardMaterial3D.new()
	flash_material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	flash_material.albedo_color = Color(1, 0.1, 0.1, 0.0)
	# A vignette rather than a full-screen wash: tinting the whole view red is
	# both unreadable and uncomfortable in a headset.
	flash_material.albedo_texture = _vignette_texture()
	flash_material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	flash_material.no_depth_test = true
	flash_material.render_priority = 10
	flash_material.cull_mode = BaseMaterial3D.CULL_DISABLED
	_damage_flash.material_override = flash_material
	_damage_flash.position = Vector3(0, 0, -1.0)
	_damage_flash.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_camera.add_child(_damage_flash)


## Transparent in the middle, solid at the edges.
func _vignette_texture() -> ImageTexture:
	var size := 96
	var image := Image.create(size, size, false, Image.FORMAT_RGBA8)
	var centre := (size - 1) * 0.5
	for y in range(size):
		for x in range(size):
			var distance := Vector2(x - centre, y - centre).length() / centre
			var alpha := clampf((distance - 0.42) / 0.58, 0.0, 1.0)
			image.set_pixel(x, y, Color(1, 1, 1, pow(alpha, 1.4)))
	return ImageTexture.create_from_image(image)


func _add_hand_mesh(controller: Node3D) -> void:
	var instance := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = Vector3(0.055, 0.09, 0.12)
	instance.mesh = mesh
	instance.material_override = _simple_material(Color("39404f"), 0.5)
	instance.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	controller.add_child(instance)


func _build_ui() -> void:
	_hud = WristHud.new()
	if vr_mode:
		_left_controller.add_child(_hud)
		_hud.position = Vector3(0, 0.055, 0.02)
		_hud.rotation_degrees = Vector3(-42, 0, 0)
	else:
		_camera.add_child(_hud)
		_hud.position = Vector3(-0.40, -0.25, -0.78)
		_hud.scale = Vector3.ONE * 1.9
	_hud.set_hint("Y / Tab: shop")
	SaveGame.food_changed.connect(_hud.set_food)

	_shop = KibbleShop.new()
	add_child(_shop)
	_shop.loadout_changed.connect(_on_loadout_changed)

	_announcement = Label3D.new()
	_announcement.font_size = 110
	_announcement.pixel_size = 0.0021
	_announcement.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	_announcement.outline_size = 20
	_announcement.outline_modulate = Color(0, 0, 0, 0.9)
	_announcement.no_depth_test = true
	_announcement.render_priority = 5
	_announcement.outline_render_priority = 4
	_announcement.shaded = false
	_announcement.modulate = Color(1, 1, 1, 0)
	add_child(_announcement)


func _on_loadout_changed() -> void:
	_companion.set_skin(SaveGame.equipped)
	_gun.set_accent(Skins.get_skin(SaveGame.equipped)["secondary"])


# --------------------------------------------------------------------- input

func _unhandled_input(event: InputEvent) -> void:
	if vr_mode:
		return
	var motion := event as InputEventMouseMotion
	if motion != null:
		if _mouse_captured:
			_origin.rotate_y(-motion.relative.x * 0.0022)
			_camera.rotation.x = clampf(_camera.rotation.x - motion.relative.y * 0.0022, -1.4, 1.4)
		return

	var key := event as InputEventKey
	if key != null and key.pressed and key.keycode == KEY_ESCAPE:
		_set_mouse_captured(not _mouse_captured)
		return

	var click := event as InputEventMouseButton
	if click != null and click.pressed and not _mouse_captured:
		_set_mouse_captured(true)


func _set_mouse_captured(captured: bool) -> void:
	if DisplayServer.get_name() == "headless":
		return
	_mouse_captured = captured
	Input.set_mouse_mode(Input.MOUSE_MODE_CAPTURED if captured else Input.MOUSE_MODE_VISIBLE)


func _process(delta: float) -> void:
	# The shop has its own status line; a floating banner across it just
	# obscures the prices.
	_announcement.visible = not _shop.is_open
	_update_movement(delta)
	_update_health(delta)
	_update_waves(delta)
	_update_actions()


func _update_actions() -> void:
	var trigger_down := false
	var shop_down := false
	var reload_down := false

	if vr_mode:
		trigger_down = _right_controller.is_button_pressed("trigger_click") \
			or _right_controller.get_float("trigger") > 0.65
		shop_down = _left_controller.is_button_pressed("by_button") \
			or _left_controller.is_button_pressed("menu_button") \
			or _right_controller.is_button_pressed("by_button")
		reload_down = _left_controller.is_button_pressed("ax_button")
	else:
		trigger_down = Input.is_action_pressed("fire")
		shop_down = Input.is_action_pressed("shop")
		reload_down = Input.is_action_pressed("reload")

	var trigger_pressed := trigger_down and not _trigger_was_down
	_trigger_was_down = trigger_down

	if shop_down and not _shop_button_was_down:
		_shop.toggle(_camera)
	_shop_button_was_down = shop_down

	if reload_down:
		_gun.start_reload()

	if _shop.is_open:
		var aim := _gun.aim_transform()
		_shop.update_pointer(aim.origin, -aim.basis.z, trigger_pressed)
		return

	if _downed:
		return

	if trigger_down and _gun.can_fire():
		if _gun.fire():
			_pulse_haptic(0.35, 0.07)


func _pulse_haptic(amplitude: float, duration: float) -> void:
	if vr_mode and _right_controller != null:
		_right_controller.trigger_haptic_pulse("haptic", 0.0, amplitude, duration, 0.0)


func _update_movement(delta: float) -> void:
	if _downed:
		return

	var input := Vector2.ZERO
	if vr_mode:
		input = _left_controller.get_vector2("primary")
		if input.length() < 0.15:
			input = Vector2.ZERO

		var turn := _right_controller.get_vector2("primary").x
		if absf(turn) > 0.7 and _snap_turn_ready:
			_snap_turn_ready = false
			_snap_turn(deg_to_rad(-signf(turn) * SNAP_TURN_DEGREES))
		elif absf(turn) < 0.35:
			_snap_turn_ready = true
	else:
		input = Vector2(
			Input.get_action_strength("move_right") - Input.get_action_strength("move_left"),
			Input.get_action_strength("move_forward") - Input.get_action_strength("move_back"))

	if input == Vector2.ZERO:
		return

	var basis := _camera.global_transform.basis
	var forward := -basis.z
	forward.y = 0.0
	var right := basis.x
	right.y = 0.0
	if forward.length() < 0.01 or right.length() < 0.01:
		return
	var motion := (forward.normalized() * input.y + right.normalized() * input.x) * MOVE_SPEED * delta

	_origin.global_position += motion
	# Keep the player inside the fence.
	var head := get_player_position()
	var flat := Vector3(head.x, 0, head.z)
	if flat.length() > ARENA_RADIUS:
		var correction := flat.normalized() * ARENA_RADIUS - flat
		_origin.global_position += correction


func _snap_turn(angle: float) -> void:
	var pivot := _camera.global_position
	var transform := _origin.global_transform
	var rotation_basis := Basis(Vector3.UP, angle)
	transform.origin = pivot + rotation_basis * (transform.origin - pivot)
	transform.basis = rotation_basis * transform.basis
	_origin.global_transform = transform


# -------------------------------------------------------------- player state

func get_player_position() -> Vector3:
	if _camera == null:
		return Vector3.ZERO
	return _camera.global_position


func get_player_forward() -> Vector3:
	if _camera == null:
		return Vector3.FORWARD
	return -_camera.global_transform.basis.z


func damage_player(amount: float, _source: Vector3) -> void:
	if _downed:
		return
	_health = maxf(0.0, _health - amount)
	_time_since_damage = 0.0
	_hud.set_health(_health, PLAYER_MAX_HEALTH)
	Sfx.play("hurt", get_player_position(), -6.0)
	_pulse_haptic(0.8, 0.16)

	var material: StandardMaterial3D = _damage_flash.material_override
	material.albedo_color.a = minf(material.albedo_color.a + 0.34, 0.62)
	if _flash_tween != null and _flash_tween.is_valid():
		_flash_tween.kill()
	_flash_tween = create_tween()
	_flash_tween.tween_property(material, "albedo_color:a", 0.0, 0.5)

	if _health <= 0.0:
		_down_player()


func _update_health(delta: float) -> void:
	_time_since_damage += delta
	if _downed or _health >= PLAYER_MAX_HEALTH or _time_since_damage < REGEN_DELAY:
		return
	_health = minf(PLAYER_MAX_HEALTH, _health + HEALTH_REGEN * delta)
	_hud.set_health(_health, PLAYER_MAX_HEALTH)


func _down_player() -> void:
	_downed = true
	_announce("DOWNED! The pack got you.", Color("ff6b6b"), 3.5)
	for dog in _dog_root.get_children():
		dog.queue_free()
	_alive = 0
	_wave_running = false
	get_tree().create_timer(3.5).timeout.connect(func() -> void:
		if not is_inside_tree():
			return
		_downed = false
		_health = PLAYER_MAX_HEALTH
		_hud.set_health(_health, PLAYER_MAX_HEALTH)
		_begin_wave(maxi(1, _wave - 1)))


# ---------------------------------------------------------------------- waves

func _begin_wave(wave: int) -> void:
	_wave = wave
	_to_spawn = mini(4 + wave * 2, 26)
	_alive = 0
	_spawn_timer = 0.6
	_wave_running = true
	_hud.set_wave(_wave)
	Sfx.play("wave", get_player_position(), -4.0)
	_announce("WAVE %d" % _wave, Color("9ef7ff"), 2.2)


func _update_waves(delta: float) -> void:
	if _downed:
		return

	if not _wave_running:
		if _intermission_timer > 0.0:
			_intermission_timer -= delta
			if _intermission_timer <= 0.0:
				_begin_wave(_wave + 1)
		return

	if _to_spawn > 0:
		_spawn_timer -= delta
		if _spawn_timer <= 0.0 and _alive < MAX_ALIVE:
			_spawn_timer = maxf(0.35, 1.05 - _wave * 0.04)
			_spawn_dog()
	elif _alive <= 0:
		_finish_wave()


func _finish_wave() -> void:
	_wave_running = false
	_intermission_timer = INTERMISSION
	var bonus := 25 + _wave * 15
	SaveGame.add_food(bonus)
	_announce("Wave %d cleared!  +%d Dog Food" % [_wave, bonus], Color("7dff9b"), 3.5)
	Sfx.play("buy", get_player_position(), -4.0)
	_hud.set_hint("Shop open: %s" % ("Y button" if vr_mode else "Tab"))


func _spawn_dog() -> void:
	_to_spawn -= 1
	var angle := randf() * TAU
	var radius := randf_range(ARENA_RADIUS * 0.7, ARENA_RADIUS - 0.5)
	var spawn_at := Vector3(sin(angle), 0.1, cos(angle)) * radius
	# Never drop a dog straight into the player's lap.
	var player := get_player_position()
	if Vector2(spawn_at.x - player.x, spawn_at.z - player.z).length() < 6.0:
		spawn_at = -spawn_at

	var golden: bool = _wave >= 2 and randf() < Skins.GOLDEN_SPAWN_CHANCE

	var dog := Dog.new()
	_dog_root.add_child(dog)
	dog.global_position = spawn_at
	dog.setup(self, _wave, golden)
	dog.died.connect(_on_dog_died)
	_alive += 1

	if golden:
		_announce("A GOLDEN DOG APPEARED!", Color("ffd447"), 3.0)
		Sfx.play("golden", spawn_at, 0.0)


func _on_dog_died(dog: Node3D, reward: int, was_golden: bool) -> void:
	_alive = maxi(0, _alive - 1)
	_kills += 1
	SaveGame.record_kill(_wave)
	_hud.set_kills(_kills)
	_pulse_haptic(0.5, 0.1)

	var drop_position: Vector3 = dog.global_position + Vector3(0, 0.4, 0)
	var pieces: int = 6 if was_golden else randi_range(1, 3)
	var per_piece: int = maxi(1, int(round(float(reward) / float(pieces))))
	for i in range(pieces):
		var kibble := Kibble.create(self, drop_position, per_piece, was_golden)
		add_child(kibble)
		kibble.global_position = drop_position

	if was_golden:
		_unlock_golden("You took down a Golden Dog!")
	elif not SaveGame.owns(Skins.GOLDEN_ID) and randi() % Skins.GOLDEN_DROP_ONE_IN == 0:
		_unlock_golden("ULTRA RARE DROP!")


func _unlock_golden(reason: String) -> void:
	if SaveGame.owns(Skins.GOLDEN_ID):
		_announce("Golden Dog bonus!", Color("ffd447"), 2.5)
		return
	SaveGame.grant(Skins.GOLDEN_ID)
	_shop.refresh()
	_announce("%s\nTHE GOLDEN DOG unlocked!" % reason, Color("ffd447"), 6.0)
	Sfx.play("golden", get_player_position(), 4.0)


func collect_food(value: int, golden: bool) -> void:
	SaveGame.add_food(value)
	if golden:
		_pulse_haptic(0.25, 0.05)


# -------------------------------------------------------------- announcements

func _announce(text: String, color: Color, duration: float) -> void:
	if _announcement == null or _camera == null:
		return
	_announcement.text = text
	_announcement.modulate = Color(color.r, color.g, color.b, 1.0)
	var forward := -_camera.global_transform.basis.z
	forward.y = 0.0
	if forward.length() < 0.01:
		forward = Vector3.FORWARD
	_announcement.global_position = _camera.global_position + forward.normalized() * 3.4 + Vector3(0, 0.75, 0)

	if _announcement_tween != null and _announcement_tween.is_valid():
		_announcement_tween.kill()
	_announcement_tween = create_tween()
	_announcement_tween.tween_interval(duration * 0.65)
	_announcement_tween.tween_property(_announcement, "modulate:a", 0.0, duration * 0.35)
