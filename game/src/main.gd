extends Node3D

## Prison Break — 3D top-down stealth escape.
##
## Levels are built at runtime from the character grids in `levels.gd`. The grid
## drives three things at once: the wall meshes, one StaticBody3D holding every
## wall collider, and an AStarGrid2D (on the X/Z plane) that the guards navigate
## on. A new level is a block of text plus patrol waypoints.

enum Phase { BRIEFING, PLAYING, CAUGHT, CLEARED, WON }

## World units per grid cell.
const TILE := 2.0
const WALL_HEIGHT := 2.6
const WALL := "#"
const SHADOW := "~"
const DOOR := "D"

var player: Node3D = null
var phase: Phase = Phase.BRIEFING
var level_index := 0
var keycards_total := 0

var _grid: PackedStringArray = PackedStringArray()
var _cols := 0
var _rows := 0
var _astar := AStarGrid2D.new()
var _guards: Array[Guard] = []
var _keycards: Array[Node3D] = []
var _doors: Array[Dictionary] = []
var _exit_pos := Vector3.ZERO
var _world: Node3D = null
var _hud: CanvasLayer = null
var _camera: Camera3D = null
var _phase_timer := 0.0
var _alarm := 0.0

## Fixed camera orientation — the stick always maps to the same world direction,
## which matters a lot more on a phone than a rotating chase cam.
const CAM_OFFSET := Vector3(0.0, 21.0, 14.0)
const CAM_LAG := 5.0

func _ready() -> void:
	_build_environment()
	_camera = Camera3D.new()
	_camera.fov = 52.0
	_camera.far = 200.0
	add_child(_camera)
	_camera.make_current()
	_hud = preload("res://src/hud.gd").new()
	add_child(_hud)
	load_level(0)

func _build_environment() -> void:
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0.043, 0.051, 0.071)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.32, 0.38, 0.52)
	env.ambient_light_energy = 0.55
	env.fog_enabled = true
	env.fog_light_color = Color(0.05, 0.07, 0.11)
	env.fog_density = 0.012
	var we := WorldEnvironment.new()
	we.environment = env
	add_child(we)

	# Moonlight: low, cool and angled so the walls cast readable shadows.
	var moon := DirectionalLight3D.new()
	moon.light_color = Color(0.78, 0.85, 1.0)
	moon.light_energy = 0.85
	moon.shadow_enabled = true
	moon.rotation_degrees = Vector3(-58.0, -42.0, 0.0)
	add_child(moon)

# ---------------------------------------------------------------- level build

func load_level(index: int) -> void:
	level_index = clampi(index, 0, Levels.DATA.size() - 1)
	_clear_world()

	var data: Dictionary = Levels.DATA[level_index]
	_grid = PackedStringArray(data["grid"])
	_rows = _grid.size()
	_cols = _grid[0].length()
	for row in _grid:
		assert(row.length() == _cols, "Level %d has a ragged grid row" % level_index)

	_world = Node3D.new()
	add_child(_world)

	_build_astar()
	_build_floor()
	_build_walls()
	_build_doors()
	_spawn_entities(data)
	_snap_camera()

	phase = Phase.BRIEFING
	_phase_timer = 2.4
	_alarm = 0.0
	_hud.show_briefing(data["name"], data["hint"], level_index + 1, Levels.DATA.size())

func _clear_world() -> void:
	if _world != null and is_instance_valid(_world):
		_world.queue_free()
	_world = null
	_guards.clear()
	_keycards.clear()
	_doors.clear()
	player = null

func _build_astar() -> void:
	_astar.region = Rect2i(0, 0, _cols, _rows)
	_astar.cell_size = Vector2(TILE, TILE)
	_astar.offset = Vector2(TILE, TILE) * 0.5
	_astar.diagonal_mode = AStarGrid2D.DIAGONAL_MODE_ONLY_IF_NO_OBSTACLES
	_astar.update()
	for y in _rows:
		for x in _cols:
			var c := _cell(x, y)
			_astar.set_point_solid(Vector2i(x, y), c == WALL or c == DOOR)

func _build_floor() -> void:
	var size := Vector2(_cols, _rows) * TILE
	var floor_mesh := MeshInstance3D.new()
	var box := BoxMesh.new()
	box.size = Vector3(size.x, 0.4, size.y)
	floor_mesh.mesh = box
	floor_mesh.position = Vector3(size.x * 0.5, -0.2, size.y * 0.5)
	floor_mesh.material_override = _make_material(Color(0.118, 0.133, 0.169), 0.95)
	_world.add_child(floor_mesh)

	var ground := StaticBody3D.new()
	ground.collision_layer = 0b001
	ground.collision_mask = 0
	var ground_shape := CollisionShape3D.new()
	var ground_box := BoxShape3D.new()
	ground_box.size = Vector3(size.x, 0.4, size.y)
	ground_shape.shape = ground_box
	ground_shape.position = Vector3(size.x * 0.5, -0.2, size.y * 0.5)
	ground.add_child(ground_shape)
	_world.add_child(ground)

	# Shadow patches are drawn as slightly raised dark quads.
	var shadows := MultiMeshInstance3D.new()
	var cells: Array[Vector2i] = []
	for y in _rows:
		for x in _cols:
			if _cell(x, y) == SHADOW:
				cells.append(Vector2i(x, y))
	if cells.is_empty():
		return
	var quad := BoxMesh.new()
	quad.size = Vector3(TILE, 0.02, TILE)
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.mesh = quad
	mm.instance_count = cells.size()
	for i in cells.size():
		var c := cells[i]
		mm.set_instance_transform(i, Transform3D(Basis(), _cell_centre(c.x, c.y, 0.01)))
	shadows.multimesh = mm
	shadows.material_override = _make_material(Color(0.02, 0.03, 0.055), 1.0)
	_world.add_child(shadows)

func _build_walls() -> void:
	var cells: Array[Vector2i] = []
	for y in _rows:
		for x in _cols:
			if _cell(x, y) == WALL:
				cells.append(Vector2i(x, y))
	if cells.is_empty():
		return

	# One MultiMesh for every wall block — hundreds of draw calls become one.
	var block := BoxMesh.new()
	block.size = Vector3(TILE, WALL_HEIGHT, TILE)
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.mesh = block
	mm.instance_count = cells.size()

	var body := StaticBody3D.new()
	body.collision_layer = 0b001
	body.collision_mask = 0
	_world.add_child(body)

	for i in cells.size():
		var c := cells[i]
		var centre := _cell_centre(c.x, c.y, WALL_HEIGHT * 0.5)
		mm.set_instance_transform(i, Transform3D(Basis(), centre))
		var shape := CollisionShape3D.new()
		var box := BoxShape3D.new()
		box.size = Vector3(TILE, WALL_HEIGHT, TILE)
		shape.shape = box
		shape.position = centre
		body.add_child(shape)

	var walls := MultiMeshInstance3D.new()
	walls.multimesh = mm
	walls.material_override = _make_material(Color(0.353, 0.388, 0.463), 0.85)
	_world.add_child(walls)

func _build_doors() -> void:
	for y in _rows:
		for x in _cols:
			if _cell(x, y) != DOOR:
				continue
			var body := StaticBody3D.new()
			body.collision_layer = 0b001
			body.collision_mask = 0
			body.position = _cell_centre(x, y, WALL_HEIGHT * 0.5)
			var shape := CollisionShape3D.new()
			var box := BoxShape3D.new()
			box.size = Vector3(TILE, WALL_HEIGHT, TILE)
			shape.shape = box
			body.add_child(shape)

			var mesh := MeshInstance3D.new()
			var bar_mesh := BoxMesh.new()
			bar_mesh.size = Vector3(TILE * 0.96, WALL_HEIGHT * 0.94, TILE * 0.4)
			mesh.mesh = bar_mesh
			var mat := _make_material(Color(0.62, 0.52, 0.22), 0.4)
			mat.metallic = 0.7
			mat.emission_enabled = true
			mat.emission = Color(0.35, 0.26, 0.05)
			mat.emission_energy_multiplier = 0.35
			mesh.material_override = mat
			body.add_child(mesh)

			_world.add_child(body)
			_doors.append({"body": body, "cell": Vector2i(x, y), "open": false,
				"mesh": mesh})

func _spawn_entities(data: Dictionary) -> void:
	keycards_total = 0
	for y in _rows:
		for x in _cols:
			match _cell(x, y):
				"P":
					player = Player.new()
					_world.add_child(player)
					player.global_position = _cell_centre(x, y, 0.0)
				"K":
					var card := Node3D.new()
					card.set_script(preload("res://src/keycard.gd"))
					_world.add_child(card)
					card.global_position = _cell_centre(x, y, 0.55)
					_keycards.append(card)
					keycards_total += 1
				"E":
					_exit_pos = _cell_centre(x, y, 0.0)
					var gate := Node3D.new()
					gate.set_script(preload("res://src/exit_gate.gd"))
					_world.add_child(gate)
					gate.global_position = _exit_pos

	for waypoints in data["guards"]:
		var route := PackedVector3Array()
		for wp in waypoints:
			route.append(_snap_to_open(Vector2i(wp[0], wp[1])))
		var guard := Guard.new()
		_world.add_child(guard)
		guard.setup(self, route)
		_guards.append(guard)

## Keeps a hand-authored waypoint usable even if it lands on a wall.
func _snap_to_open(cell: Vector2i) -> Vector3:
	if _is_open_cell(cell.x, cell.y):
		return _cell_centre(cell.x, cell.y, 0.0)
	for radius in range(1, 5):
		for dy in range(-radius, radius + 1):
			for dx in range(-radius, radius + 1):
				var nx := cell.x + dx
				var ny := cell.y + dy
				if _is_open_cell(nx, ny):
					push_warning("Waypoint %s was inside a wall; snapped to %d,%d"
						% [cell, nx, ny])
					return _cell_centre(nx, ny, 0.0)
	return _cell_centre(cell.x, cell.y, 0.0)

func _is_open_cell(x: int, y: int) -> bool:
	if x < 0 or y < 0 or x >= _cols or y >= _rows:
		return false
	var c := _cell(x, y)
	return c != WALL and c != DOOR

func _make_material(albedo: Color, roughness: float) -> StandardMaterial3D:
	var mat := StandardMaterial3D.new()
	mat.albedo_color = albedo
	mat.roughness = roughness
	mat.metallic = 0.0
	return mat

# --------------------------------------------------------------- game loop

func _process(delta: float) -> void:
	match phase:
		Phase.BRIEFING:
			_phase_timer -= delta
			if _phase_timer <= 0.0 or Input.is_action_just_pressed("ui_confirm"):
				phase = Phase.PLAYING
				_hud.hide_overlay()
		Phase.PLAYING:
			_tick_playing(delta)
		Phase.CAUGHT, Phase.CLEARED, Phase.WON:
			_phase_timer -= delta
			if _phase_timer <= 0.0 and (Input.is_action_just_pressed("ui_confirm")
					or Input.is_action_just_pressed("restart") or _hud.take_tap()):
				_advance()

	_follow_camera(delta)

	if Input.is_action_just_pressed("restart") and phase == Phase.PLAYING:
		load_level(level_index)

func _tick_playing(delta: float) -> void:
	if player == null or not is_instance_valid(player):
		return
	player.stick = _hud.joystick_vector()
	player.touch_sneak = _hud.sneak_held()

	_open_doors_near_player()
	_collect_keycards()

	_alarm = 0.0
	for guard in _guards:
		_alarm = maxf(_alarm, guard.awareness)
		if guard.awareness >= 1.0 or guard.caught_player(player):
			_on_caught()
			return

	if player.keycards >= keycards_total \
			and _flat(player.global_position).distance_to(_flat(_exit_pos)) < TILE * 0.7:
		_on_cleared()

	_hud.update_status(player.keycards, keycards_total, _alarm, player.sneaking,
		Levels.DATA[level_index]["name"])

## Keeps the camera looking at the player, but never so far past the edge of the
## level that the view fills up with empty space.
const CAM_MARGIN_X := 17.0
const CAM_MARGIN_Z := 9.5

func _camera_focus() -> Vector3:
	var world_size := Vector2(_cols, _rows) * TILE
	var p := player.global_position
	var mx: float = minf(CAM_MARGIN_X, world_size.x * 0.5)
	var mz: float = minf(CAM_MARGIN_Z, world_size.y * 0.5)
	return Vector3(
		clampf(p.x, mx, world_size.x - mx),
		0.0,
		clampf(p.z, mz, world_size.y - mz))

func _follow_camera(delta: float) -> void:
	if player == null or not is_instance_valid(player):
		return
	var focus := _camera_focus()
	_camera.global_position = _camera.global_position.lerp(focus + CAM_OFFSET,
		clampf(CAM_LAG * delta, 0.0, 1.0))
	_camera.look_at(focus + Vector3.UP * 0.6, Vector3.UP)

func _snap_camera() -> void:
	if player == null:
		return
	var focus := _camera_focus()
	_camera.global_position = focus + CAM_OFFSET
	_camera.look_at(focus + Vector3.UP * 0.6, Vector3.UP)

func _open_doors_near_player() -> void:
	if player.keycards <= 0:
		return
	for door in _doors:
		if door["open"]:
			continue
		var body: StaticBody3D = door["body"]
		if _flat(player.global_position).distance_to(_flat(body.global_position)) > TILE * 1.15:
			continue
		door["open"] = true
		body.get_child(0).set_deferred("disabled", true)
		# Sink the door into the floor rather than popping it out of existence.
		var mesh: MeshInstance3D = door["mesh"]
		var tween := create_tween()
		tween.tween_property(mesh, "position:y", -WALL_HEIGHT, 0.45) \
			.set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_IN_OUT)
		_astar.set_point_solid(door["cell"], false)
		_hud.flash("DOOR OPEN")

func _collect_keycards() -> void:
	for i in range(_keycards.size() - 1, -1, -1):
		var card: Node3D = _keycards[i]
		if not is_instance_valid(card):
			_keycards.remove_at(i)
			continue
		if _flat(player.global_position).distance_to(_flat(card.global_position)) < TILE * 0.6:
			player.keycards += 1
			card.queue_free()
			_keycards.remove_at(i)
			_hud.flash("KEYCARD %d/%d" % [player.keycards, keycards_total])

func _on_caught() -> void:
	phase = Phase.CAUGHT
	_phase_timer = 0.7
	_hud.show_result("CAUGHT", "Back to your cell. Tap to try again.",
		Color(1.0, 0.36, 0.33))

func _on_cleared() -> void:
	if level_index + 1 >= Levels.DATA.size():
		phase = Phase.WON
		_phase_timer = 0.7
		_hud.show_result("YOU'RE OUT", "Every block cleared. Tap to play again.",
			Color(0.45, 0.95, 0.6))
	else:
		phase = Phase.CLEARED
		_phase_timer = 0.7
		_hud.show_result("BLOCK CLEAR", "Tap to continue.", Color(0.45, 0.95, 0.6))

func _advance() -> void:
	match phase:
		Phase.CAUGHT:
			load_level(level_index)
		Phase.CLEARED:
			load_level(level_index + 1)
		Phase.WON:
			load_level(0)

# ------------------------------------------------------- queries for guards

func find_path(from: Vector3, to: Vector3) -> PackedVector3Array:
	var a := _to_cell(from)
	var b := _to_cell(to)
	var out := PackedVector3Array()
	if not _astar.is_in_boundsv(a) or not _astar.is_in_boundsv(b):
		return out
	if _astar.is_point_solid(b):
		return out
	for p in _astar.get_point_path(a, b):
		out.append(Vector3(p.x, 0.0, p.y))
	return out

## Line of sight is tested at chest height so a guard cannot see over a wall.
func is_wall_between(from: Vector3, to: Vector3) -> bool:
	var space := get_world_3d().direct_space_state
	var up := Vector3.UP * 1.0
	var query := PhysicsRayQueryParameters3D.create(from + up, to + up, 0b001)
	return not space.intersect_ray(query).is_empty()

func is_shadow(world_pos: Vector3) -> bool:
	var cell := _to_cell(world_pos)
	if cell.x < 0 or cell.y < 0 or cell.x >= _cols or cell.y >= _rows:
		return false
	return _cell(cell.x, cell.y) == SHADOW

func _is_wall_at(world_pos: Vector3) -> bool:
	var cell := _to_cell(world_pos)
	if cell.x < 0 or cell.y < 0 or cell.x >= _cols or cell.y >= _rows:
		return true
	var c := _cell(cell.x, cell.y)
	return c == WALL or c == DOOR

# ------------------------------------------------------------------ helpers

func _cell(x: int, y: int) -> String:
	return _grid[y][x]

func _cell_centre(x: int, y: int, height: float) -> Vector3:
	return Vector3((x + 0.5) * TILE, height, (y + 0.5) * TILE)

func _to_cell(world_pos: Vector3) -> Vector2i:
	return Vector2i(floori(world_pos.x / TILE), floori(world_pos.z / TILE))

## Distance checks ignore height — everything of interest sits on the floor.
static func _flat(v: Vector3) -> Vector3:
	return Vector3(v.x, 0.0, v.z)
