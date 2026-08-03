extends Node2D

## Prison Break — top-down stealth escape.
##
## Levels are built at runtime from the character grids in `levels.gd`: walls
## become one StaticBody2D with many shapes, doors get their own bodies so they
## can be opened individually, and the same grid feeds an AStarGrid2D that the
## guards navigate on.

enum Phase { BRIEFING, PLAYING, CAUGHT, CLEARED, WON }

const TILE := Levels.TILE
const WALL := "#"
const SHADOW := "~"
const DOOR := "D"

var player: Player = null
var phase: Phase = Phase.BRIEFING
var level_index := 0
var keycards_total := 0

var _grid: PackedStringArray = PackedStringArray()
var _cols := 0
var _rows := 0
var _astar := AStarGrid2D.new()
var _guards: Array[Guard] = []
var _keycards: Array[Node2D] = []
var _doors: Array[Dictionary] = []
var _exit_pos := Vector2.ZERO
var _world: Node2D = null
var _hud: CanvasLayer = null
var _camera: Camera2D = null
var _phase_timer := 0.0
var _alarm := 0.0

func _ready() -> void:
	RenderingServer.set_default_clear_color(Color(0.043, 0.051, 0.071))
	_camera = Camera2D.new()
	add_child(_camera)
	_camera.make_current()
	_hud = preload("res://src/hud.gd").new()
	add_child(_hud)
	load_level(0)

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

	_world = Node2D.new()
	add_child(_world)

	_build_astar()
	_build_view()
	_build_bodies()
	_spawn_entities(data)
	_frame_camera()

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

func _build_view() -> void:
	var view := Node2D.new()
	view.set_script(preload("res://src/level_view.gd"))
	view.set("grid", _grid)
	_world.add_child(view)

func _build_bodies() -> void:
	var walls := StaticBody2D.new()
	walls.collision_layer = 0b001
	walls.collision_mask = 0
	_world.add_child(walls)
	for y in _rows:
		for x in _cols:
			if _cell(x, y) != WALL:
				continue
			var shape := CollisionShape2D.new()
			var rect := RectangleShape2D.new()
			rect.size = Vector2(TILE, TILE)
			shape.shape = rect
			shape.position = _tile_center(x, y)
			walls.add_child(shape)

	for y in _rows:
		for x in _cols:
			if _cell(x, y) != DOOR:
				continue
			var body := StaticBody2D.new()
			body.collision_layer = 0b001
			body.collision_mask = 0
			body.position = _tile_center(x, y)
			var shape := CollisionShape2D.new()
			var rect := RectangleShape2D.new()
			rect.size = Vector2(TILE, TILE)
			shape.shape = rect
			body.add_child(shape)
			var vis := Node2D.new()
			vis.set_script(preload("res://src/door_view.gd"))
			body.add_child(vis)
			_world.add_child(body)
			_doors.append({"body": body, "cell": Vector2i(x, y), "open": false, "view": vis})

func _spawn_entities(data: Dictionary) -> void:
	keycards_total = 0
	for y in _rows:
		for x in _cols:
			match _cell(x, y):
				"P":
					player = Player.new()
					player.global_position = _tile_center(x, y)
					_world.add_child(player)
				"K":
					var card := Node2D.new()
					card.set_script(preload("res://src/keycard_view.gd"))
					card.position = _tile_center(x, y)
					_world.add_child(card)
					_keycards.append(card)
					keycards_total += 1
				"E":
					_exit_pos = _tile_center(x, y)
					var gate := Node2D.new()
					gate.set_script(preload("res://src/exit_view.gd"))
					gate.position = _exit_pos
					_world.add_child(gate)

	for waypoints in data["guards"]:
		var route := PackedVector2Array()
		for wp in waypoints:
			route.append(_snap_to_open(Vector2i(wp[0], wp[1])))
		var guard := Guard.new()
		_world.add_child(guard)
		guard.setup(self, route)
		_guards.append(guard)

## Keeps a hand-authored waypoint usable even if it lands on a wall.
func _snap_to_open(cell: Vector2i) -> Vector2:
	if _is_open_cell(cell.x, cell.y):
		return _tile_center(cell.x, cell.y)
	for radius in range(1, 5):
		for dy in range(-radius, radius + 1):
			for dx in range(-radius, radius + 1):
				var nx := cell.x + dx
				var ny := cell.y + dy
				if _is_open_cell(nx, ny):
					push_warning("Waypoint %s was inside a wall; snapped to %d,%d"
						% [cell, nx, ny])
					return _tile_center(nx, ny)
	return _tile_center(cell.x, cell.y)

func _is_open_cell(x: int, y: int) -> bool:
	if x < 0 or y < 0 or x >= _cols or y >= _rows:
		return false
	var c := _cell(x, y)
	return c != WALL and c != DOOR

## Fits the whole level on screen. Stealth reads much better when you can see
## every patrol at once, so the camera is static and framed to the level, with
## room left for the status bar on top and the touch controls underneath.
const TOP_MARGIN := 62.0
const BOTTOM_MARGIN := 150.0

func _frame_camera() -> void:
	var world_size := Vector2(_cols, _rows) * TILE
	var view_size := Vector2(get_viewport_rect().size)
	var avail := Vector2(view_size.x * 0.98,
		maxf(view_size.y - TOP_MARGIN - BOTTOM_MARGIN, 120.0))
	var fit: float = clampf(minf(avail.x / world_size.x, avail.y / world_size.y), 0.3, 1.2)
	_camera.zoom = Vector2.ONE * fit
	# Shift the camera so the level sits inside the free band, not dead centre.
	var band_centre := TOP_MARGIN + avail.y * 0.5
	var offset := band_centre - view_size.y * 0.5
	_camera.position = Vector2(world_size.x * 0.5, world_size.y * 0.5 - offset / fit)

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
			and player.global_position.distance_to(_exit_pos) < TILE * 0.7:
		_on_cleared()

	_hud.update_status(player.keycards, keycards_total, _alarm, player.sneaking,
		Levels.DATA[level_index]["name"])

func _open_doors_near_player() -> void:
	if player.keycards <= 0:
		return
	for door in _doors:
		if door["open"]:
			continue
		var body: StaticBody2D = door["body"]
		if player.global_position.distance_to(body.global_position) > TILE * 1.15:
			continue
		door["open"] = true
		body.get_child(0).set_deferred("disabled", true)
		door["view"].set("open", true)
		door["view"].queue_redraw()
		var cell: Vector2i = door["cell"]
		_astar.set_point_solid(cell, false)

func _collect_keycards() -> void:
	for i in range(_keycards.size() - 1, -1, -1):
		var card: Node2D = _keycards[i]
		if not is_instance_valid(card):
			_keycards.remove_at(i)
			continue
		if player.global_position.distance_to(card.global_position) < TILE * 0.6:
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

func find_path(from: Vector2, to: Vector2) -> PackedVector2Array:
	var a := _to_cell(from)
	var b := _to_cell(to)
	if not _astar.is_in_boundsv(a) or not _astar.is_in_boundsv(b):
		return PackedVector2Array()
	if _astar.is_point_solid(b):
		return PackedVector2Array()
	return _astar.get_point_path(a, b)

func is_wall_between(from: Vector2, to: Vector2) -> bool:
	var space := get_world_2d().direct_space_state
	var query := PhysicsRayQueryParameters2D.create(from, to, 0b001)
	return not space.intersect_ray(query).is_empty()

func _is_wall_at(world_pos: Vector2) -> bool:
	var cell := _to_cell(world_pos)
	if cell.x < 0 or cell.y < 0 or cell.x >= _cols or cell.y >= _rows:
		return true
	var c := _cell(cell.x, cell.y)
	return c == WALL or c == DOOR

func is_shadow(world_pos: Vector2) -> bool:
	var cell := _to_cell(world_pos)
	if cell.x < 0 or cell.y < 0 or cell.x >= _cols or cell.y >= _rows:
		return false
	return _cell(cell.x, cell.y) == SHADOW

# ------------------------------------------------------------------ helpers

func _cell(x: int, y: int) -> String:
	return _grid[y][x]

func _tile_center(x: int, y: int) -> Vector2:
	return Vector2(x + 0.5, y + 0.5) * TILE

func _to_cell(world_pos: Vector2) -> Vector2i:
	return Vector2i(floori(world_pos.x / TILE), floori(world_pos.y / TILE))
