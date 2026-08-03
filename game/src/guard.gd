class_name Guard
extends CharacterBody2D

## A patrolling guard with a vision cone.
##
## States:
##   PATROL  — walks its route, cone is pale yellow
##   SUSPECT — saw something, walks to the last known spot, cone is orange
##   CHASE   — has the player, cone is red and the alarm meter fills fast
##
## Seeing the player fills `awareness`. The level is lost when awareness hits
## 1.0, which takes about a second of unbroken line of sight — long enough to
## duck back behind a wall if you react.

signal spotted_player
signal awareness_changed(value: float)

enum State { PATROL, SUSPECT, CHASE }

const RADIUS := 17.0
const PATROL_SPEED := 90.0
const CHASE_SPEED := 175.0
const SIGHT_RANGE := 300.0
const CONE_HALF_ANGLE := deg_to_rad(38.0)
const TURN_RATE := 5.0
const CATCH_DISTANCE := 26.0

## Time to go from unaware to caught while fully visible.
const AWARE_GAIN := 1.15
const AWARE_DECAY := 0.45

var route: PackedVector2Array = PackedVector2Array()
var awareness := 0.0
var state: State = State.PATROL

var _facing := 0.0
var _route_index := 0
var _path: PackedVector2Array = PackedVector2Array()
var _path_index := 0
var _wait := 0.0
var _last_seen := Vector2.ZERO
var _level: Node = null
## Per-ray cone lengths, recomputed in the physics step so the drawn cone stops
## at walls instead of shining through them.
var _cone_lengths := PackedFloat32Array()

const CONE_RAYS := 20

func setup(level: Node, waypoints: PackedVector2Array) -> void:
	_level = level
	route = waypoints
	if route.size() > 0:
		global_position = route[0]
		_route_index = 1 % maxi(route.size(), 1)

func _ready() -> void:
	collision_layer = 0b100
	collision_mask = 0b001
	var shape := CollisionShape2D.new()
	var circle := CircleShape2D.new()
	circle.radius = RADIUS
	shape.shape = circle
	add_child(shape)
	z_index = 9

func _physics_process(delta: float) -> void:
	var player: Player = _level.player if _level else null
	if player == null or not is_instance_valid(player):
		return

	var visible_now := _can_see(player)
	if visible_now:
		_last_seen = player.global_position
		awareness = minf(awareness + AWARE_GAIN * delta * _sight_strength(player), 1.0)
		if state != State.CHASE:
			state = State.CHASE
			spotted_player.emit()
	else:
		awareness = maxf(awareness - AWARE_DECAY * delta, 0.0)
		if state == State.CHASE and awareness < 0.55:
			state = State.SUSPECT
		elif state == State.SUSPECT and awareness <= 0.01:
			state = State.PATROL
			_path.clear()

	awareness_changed.emit(awareness)

	match state:
		State.PATROL:
			_do_patrol(delta)
		State.SUSPECT:
			_do_investigate(delta)
		State.CHASE:
			_move_towards(player.global_position, CHASE_SPEED, delta)

	move_and_slide()
	_update_cone_shape()
	queue_redraw()

## Casts one ray per cone edge so the fan can be clipped against walls.
func _update_cone_shape() -> void:
	var space := get_world_2d().direct_space_state
	var cone := _cone_half_angle()
	_cone_lengths.resize(CONE_RAYS + 1)
	for i in range(CONE_RAYS + 1):
		var a := _facing - cone + (2.0 * cone) * (float(i) / float(CONE_RAYS))
		var to := global_position + Vector2(cos(a), sin(a)) * SIGHT_RANGE
		var query := PhysicsRayQueryParameters2D.create(global_position, to, 0b001)
		var hit := space.intersect_ray(query)
		_cone_lengths[i] = SIGHT_RANGE if hit.is_empty() \
			else global_position.distance_to(hit["position"])

func _cone_half_angle() -> float:
	return deg_to_rad(60.0) if state == State.CHASE else CONE_HALF_ANGLE

func _do_patrol(delta: float) -> void:
	if route.size() < 2:
		return
	if _wait > 0.0:
		_wait -= delta
		velocity = velocity.move_toward(Vector2.ZERO, 900.0 * delta)
		return
	var target := route[_route_index]
	if global_position.distance_to(target) < 24.0:
		_route_index = (_route_index + 1) % route.size()
		_wait = 0.6
		_path.clear()
		return
	_move_towards(target, PATROL_SPEED, delta)

func _do_investigate(delta: float) -> void:
	if global_position.distance_to(_last_seen) < 30.0:
		# Nothing here. Sweep around, then give up.
		velocity = velocity.move_toward(Vector2.ZERO, 900.0 * delta)
		_facing += delta * 1.6
		awareness = maxf(awareness - AWARE_DECAY * delta, 0.0)
		return
	_move_towards(_last_seen, PATROL_SPEED * 1.45, delta)

## Follows an A* path to `target`, repathing when the goal drifts.
func _move_towards(target: Vector2, speed: float, delta: float) -> void:
	if _path.is_empty() or _path_index >= _path.size() \
			or _path[_path.size() - 1].distance_to(target) > 80.0:
		_path = _level.find_path(global_position, target)
		_path_index = 0
	if _path_index < _path.size():
		var step := _path[_path_index]
		if global_position.distance_to(step) < 18.0:
			_path_index += 1
		else:
			var dir := (step - global_position).normalized()
			velocity = velocity.move_toward(dir * speed, 1400.0 * delta)
			_face(dir, delta)
			return
	# Path exhausted — close the last bit directly.
	var dir_direct := (target - global_position)
	if dir_direct.length() > 4.0:
		dir_direct = dir_direct.normalized()
		velocity = velocity.move_toward(dir_direct * speed, 1400.0 * delta)
		_face(dir_direct, delta)
	else:
		velocity = velocity.move_toward(Vector2.ZERO, 900.0 * delta)

func _face(dir: Vector2, delta: float) -> void:
	_facing = lerp_angle(_facing, dir.angle(), TURN_RATE * delta)

## 1.0 when the player is right in front, tapering to 0 at the edge of range.
func _sight_strength(player: Player) -> float:
	var d := global_position.distance_to(player.global_position)
	var reach := SIGHT_RANGE * player.visibility_scale(_level.is_shadow(player.global_position))
	if reach <= 0.0:
		return 0.0
	return clampf(1.0 - (d / reach) * 0.6, 0.35, 1.0)

func _can_see(player: Player) -> bool:
	var to_player := player.global_position - global_position
	var dist := to_player.length()
	var reach := SIGHT_RANGE * player.visibility_scale(_level.is_shadow(player.global_position))
	# Guards always notice someone standing on top of them.
	if dist < CATCH_DISTANCE * 1.6:
		return true
	if dist > reach:
		return false
	var cone := CONE_HALF_ANGLE
	if state == State.CHASE:
		cone = deg_to_rad(60.0)
	if absf(angle_difference(_facing, to_player.angle())) > cone:
		return false
	return not _level.is_wall_between(global_position, player.global_position)

func caught_player(player: Player) -> bool:
	return global_position.distance_to(player.global_position) < CATCH_DISTANCE

func _cone_color() -> Color:
	match state:
		State.CHASE:
			return Color(1.0, 0.25, 0.25, 0.22)
		State.SUSPECT:
			return Color(1.0, 0.62, 0.15, 0.19)
		_:
			return Color(1.0, 0.94, 0.55, 0.13)

func _draw() -> void:
	# Vision cone as a filled fan, clipped to the walls it falls on.
	if _cone_lengths.size() == CONE_RAYS + 1:
		var cone := _cone_half_angle()
		var pts := PackedVector2Array()
		pts.append(Vector2.ZERO)
		for i in range(CONE_RAYS + 1):
			var a := _facing - cone + (2.0 * cone) * (float(i) / float(CONE_RAYS))
			pts.append(Vector2(cos(a), sin(a)) * _cone_lengths[i])
		draw_colored_polygon(pts, _cone_color())

	draw_circle(Vector2(0, 5), RADIUS * 0.95, Color(0, 0, 0, 0.35))
	var body := Color(0.22, 0.34, 0.55)
	if state == State.CHASE:
		body = Color(0.72, 0.22, 0.24)
	elif state == State.SUSPECT:
		body = Color(0.58, 0.42, 0.18)
	draw_circle(Vector2.ZERO, RADIUS, body)
	draw_circle(Vector2.ZERO, RADIUS, Color(0.85, 0.9, 1.0, 0.85), false, 2.0)
	# Cap brim points where the guard is looking.
	var f := Vector2(cos(_facing), sin(_facing))
	draw_circle(f * 9.0, 6.5, Color(0.13, 0.18, 0.28))

	if state == State.SUSPECT:
		_draw_mark("?", Color(1.0, 0.72, 0.2))
	elif state == State.CHASE:
		_draw_mark("!", Color(1.0, 0.35, 0.3))

func _draw_mark(glyph: String, color: Color) -> void:
	var font := ThemeDB.fallback_font
	draw_string(font, Vector2(-6, -RADIUS - 12), glyph,
		HORIZONTAL_ALIGNMENT_CENTER, 12, 22, color)
