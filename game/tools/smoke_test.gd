extends SceneTree

## Headless checks for every level. Run with:
##   godot --headless --path game --script res://tools/smoke_test.gd
##
## Verifies the grids are well formed, the required entities exist, guard
## waypoints sit on walkable tiles, and — the part that actually matters — that
## each level is winnable: a keycard is reachable before any door is opened,
## and every keycard plus the exit is reachable once doors are open.

const FRAMES_PER_LEVEL := 90

var _failures: Array[String] = []

func _initialize() -> void:
	var main: Node3D = load("res://src/main.tscn").instantiate()
	root.add_child(main)
	# Let _ready() finish before driving the node directly.
	await process_frame

	for i in Levels.DATA.size():
		await _check_level(main, i)

	await _check_win_flow(main)

	if _failures.is_empty():
		print("SMOKE TEST PASSED — %d levels verified" % Levels.DATA.size())
	else:
		printerr("SMOKE TEST FAILED")
		for f in _failures:
			printerr("  - " + f)
	quit(0 if _failures.is_empty() else 1)

func _check_level(main: Node3D, index: int) -> void:
	var name: String = Levels.DATA[index]["name"]
	main.load_level(index)

	var grid: PackedStringArray = main._grid
	var width: int = grid[0].length()
	for row_i in grid.size():
		if grid[row_i].length() != width:
			_fail(name, "row %d is %d wide, expected %d"
				% [row_i, grid[row_i].length(), width])

	if main.player == null:
		_fail(name, "no player start 'P' in grid")
		return
	if main.keycards_total <= 0:
		_fail(name, "no keycards")
	if main._exit_pos == Vector3.ZERO:
		_fail(name, "no exit 'E' in grid")
	if main._guards.is_empty():
		_fail(name, "no guards")

	# Guards cannot open doors, so a patrol route has to be walkable with every
	# door still locked — otherwise the guard strands itself against a wall.
	for g_i in main._guards.size():
		var guard: Guard = main._guards[g_i]
		for wp in guard.route:
			if main._is_wall_at(wp):
				_fail(name, "guard %d has a waypoint inside a wall at %s" % [g_i, wp])
		for w_i in range(1, guard.route.size()):
			if main.find_path(guard.route[w_i - 1], guard.route[w_i]).is_empty():
				_fail(name, "guard %d cannot walk from waypoint %d to %d without a door"
					% [g_i, w_i - 1, w_i])

	# Reachability with doors still locked: at least one keycard must be gettable.
	var start: Vector3 = main.player.global_position
	var reachable_card := false
	for card in main._keycards:
		if main.find_path(start, card.global_position).size() > 0:
			reachable_card = true
			break
	if not reachable_card:
		_fail(name, "no keycard is reachable before opening a door — unwinnable")

	# With every door open, all keycards and the exit must be reachable.
	for door in main._doors:
		main._astar.set_point_solid(door["cell"], false)
	for card in main._keycards:
		if main.find_path(start, card.global_position).is_empty():
			_fail(name, "keycard at %s unreachable even with doors open"
				% card.global_position)
	if main.find_path(start, main._exit_pos).is_empty():
		_fail(name, "exit unreachable even with doors open")

	# Re-lock and let the level actually run so guard AI executes.
	main.load_level(index)
	for i in FRAMES_PER_LEVEL:
		await process_frame

	print("  %s: %d guards, %d keycards, %dx%d — ok"
		% [name, main._guards.size(), main.keycards_total, width, grid.size()])

## Walks level 1 through the full pickup → door → exit chain by teleporting the
## player, to prove the win condition actually fires.
func _check_win_flow(main: Node3D) -> void:
	main.load_level(0)
	await process_frame
	main.phase = main.Phase.PLAYING
	main._hud.hide_overlay()

	var card_pos: Vector3 = main._keycards[0].global_position
	main.player.global_position = card_pos
	await process_frame
	await process_frame
	if main.player.keycards != 1:
		_fail("win flow", "standing on a keycard did not pick it up")
		return

	var door_body: StaticBody3D = main._doors[0]["body"]
	# Stand on the floor one tile in front of the door, not inside it.
	var at_door := door_body.global_position + Vector3(0, 0, -main.TILE)
	main.player.global_position = Vector3(at_door.x, 0.0, at_door.z)
	await process_frame
	await process_frame
	if not main._doors[0]["open"]:
		_fail("win flow", "door did not open while holding a keycard")
		return

	main.player.global_position = main._exit_pos
	await process_frame
	await process_frame
	if main.phase != main.Phase.CLEARED:
		_fail("win flow", "reaching the exit with every keycard did not clear the level")
		return
	print("  win flow: keycard -> door -> exit clears the level — ok")

func _fail(level_name: String, message: String) -> void:
	_failures.append("[%s] %s" % [level_name, message])
