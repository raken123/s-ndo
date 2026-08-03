class_name Guard
extends CharacterBody3D

## A patrolling guard with a vision cone rendered on the floor.
##
## States:
##   PATROL  — walks its route, cone is pale yellow
##   SUSPECT — heads for the last place it saw you, cone is orange
##   CHASE   — has you, cone is red and wide
##
## Being seen fills `awareness`; the level is lost at 1.0, which takes about a
## second of unbroken line of sight — long enough to duck back behind a wall.

signal spotted_player
signal awareness_changed(value: float)

enum State { PATROL, SUSPECT, CHASE }

const RADIUS := 0.45
const HEIGHT := 1.6
const PATROL_SPEED := 2.8
const CHASE_SPEED := 5.4
const SIGHT_RANGE := 9.5
const CONE_HALF_ANGLE := deg_to_rad(38.0)
const CHASE_HALF_ANGLE := deg_to_rad(60.0)
const TURN_RATE := 5.0
const CATCH_DISTANCE := 0.85
const GRAVITY := 22.0

## Time to go from unaware to caught while fully visible.
const AWARE_GAIN := 1.15
const AWARE_DECAY := 0.45

const CONE_RAYS := 24
## Height the cone mesh floats at, and the height sight rays are cast from.
const CONE_Y := 0.05
const EYE_HEIGHT := 1.15

var route: PackedVector3Array = PackedVector3Array()
var awareness := 0.0
var state: State = State.PATROL

var _heading := 0.0
var _route_index := 0
var _path: PackedVector3Array = PackedVector3Array()
var _path_index := 0
var _wait := 0.0
var _last_seen := Vector3.ZERO
var _level: Node = null

var _body: Node3D = null
var _torso_mat: StandardMaterial3D = null
var _cone: MeshInstance3D = null
var _cone_mesh: ImmediateMesh = null
var _cone_mat: StandardMaterial3D = null

func setup(level: Node, waypoints: PackedVector3Array) -> void:
	_level = level
	route = waypoints
	if route.size() > 0:
		global_position = route[0]
		_route_index = 1 % maxi(route.size(), 1)

func _ready() -> void:
	collision_layer = 0b100
	collision_mask = 0b001

	var shape := CollisionShape3D.new()
	var capsule := CapsuleShape3D.new()
	capsule.radius = RADIUS
	capsule.height = HEIGHT
	shape.shape = capsule
	shape.position = Vector3(0, HEIGHT * 0.5, 0)
	add_child(shape)

	_body = Node3D.new()
	add_child(_body)
	_build_look()
	_build_cone()

func _build_look() -> void:
	var torso := MeshInstance3D.new()
	var capsule := CapsuleMesh.new()
	capsule.radius = RADIUS
	capsule.height = HEIGHT
	torso.mesh = capsule
	torso.position = Vector3(0, HEIGHT * 0.5, 0)
	_torso_mat = StandardMaterial3D.new()
	_torso_mat.albedo_color = Color(0.20, 0.31, 0.52)
	_torso_mat.roughness = 0.7
	torso.material_override = _torso_mat
	_body.add_child(torso)

	var head := MeshInstance3D.new()
	var sphere := SphereMesh.new()
	sphere.radius = 0.28
	sphere.height = 0.56
	head.mesh = sphere
	head.position = Vector3(0, HEIGHT + 0.18, 0)
	head.material_override = _simple_mat(Color(0.93, 0.78, 0.62))
	_body.add_child(head)

	# Peaked cap — the brim shows which way the guard is looking from above.
	var cap := MeshInstance3D.new()
	var cyl := CylinderMesh.new()
	cyl.top_radius = 0.30
	cyl.bottom_radius = 0.30
	cyl.height = 0.16
	cap.mesh = cyl
	cap.position = Vector3(0, HEIGHT + 0.42, 0)
	cap.material_override = _simple_mat(Color(0.11, 0.16, 0.27))
	_body.add_child(cap)

	var brim := MeshInstance3D.new()
	var brim_box := BoxMesh.new()
	brim_box.size = Vector3(0.46, 0.05, 0.30)
	brim.mesh = brim_box
	brim.position = Vector3(0, HEIGHT + 0.36, -0.28)
	brim.material_override = _simple_mat(Color(0.09, 0.13, 0.22))
	_body.add_child(brim)

func _build_cone() -> void:
	# Headless runs have no renderer, so skip the cone entirely rather than
	# rebuilding a mesh nobody will ever see on every physics tick.
	if DisplayServer.get_name() == "headless":
		return
	_cone_mesh = ImmediateMesh.new()
	_cone = MeshInstance3D.new()
	_cone.mesh = _cone_mesh
	# The cone is a world-space overlay: it must not inherit the body's yaw.
	_cone.top_level = true
	_cone.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_cone_mat = StandardMaterial3D.new()
	_cone_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_cone_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	_cone_mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	_cone_mat.no_depth_test = false
	# Additive, so the cone reads as thrown light on a very dark floor rather
	# than as a flat grey decal.
	_cone_mat.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	_cone_mat.albedo_color = Color(1.0, 0.94, 0.55, 0.16)
	_cone.material_override = _cone_mat
	add_child(_cone)

func _simple_mat(albedo: Color) -> StandardMaterial3D:
	var mat := StandardMaterial3D.new()
	mat.albedo_color = albedo
	mat.roughness = 0.75
	return mat

func _physics_process(delta: float) -> void:
	var player: Player = _level.player if _level else null
	if player == null or not is_instance_valid(player):
		return

	var seen := _can_see(player)
	if seen:
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

	if not is_on_floor():
		velocity.y -= GRAVITY * delta
	else:
		velocity.y = 0.0
	move_and_slide()

	_body.rotation.y = _yaw_from_heading()
	_update_cone()
	_update_colour()

## Heading is an angle on the X/Z plane; a node's forward is -Z.
func _yaw_from_heading() -> float:
	return atan2(-cos(_heading), -sin(_heading))

func _heading_dir() -> Vector3:
	return Vector3(cos(_heading), 0.0, sin(_heading))

func _do_patrol(delta: float) -> void:
	if route.size() < 2:
		_slow(delta)
		return
	if _wait > 0.0:
		_wait -= delta
		_slow(delta)
		return
	var target := route[_route_index]
	if _flat_distance(global_position, target) < 0.55:
		_route_index = (_route_index + 1) % route.size()
		_wait = 0.6
		_path.clear()
		return
	_move_towards(target, PATROL_SPEED, delta)

func _do_investigate(delta: float) -> void:
	if _flat_distance(global_position, _last_seen) < 0.7:
		# Nothing here. Sweep around, then give up.
		_slow(delta)
		_heading += delta * 1.6
		awareness = maxf(awareness - AWARE_DECAY * delta, 0.0)
		return
	_move_towards(_last_seen, PATROL_SPEED * 1.45, delta)

## Follows an A* path to `target`, repathing when the goal drifts.
func _move_towards(target: Vector3, speed: float, delta: float) -> void:
	if _path.is_empty() or _path_index >= _path.size() \
			or _flat_distance(_path[_path.size() - 1], target) > 2.5:
		_path = _level.find_path(global_position, target)
		_path_index = 0
	if _path_index < _path.size():
		var step := _path[_path_index]
		if _flat_distance(global_position, step) < 0.45:
			_path_index += 1
		else:
			_step_towards(step, speed, delta)
			return
	# Path exhausted — close the last bit directly.
	if _flat_distance(global_position, target) > 0.15:
		_step_towards(target, speed, delta)
	else:
		_slow(delta)

func _step_towards(point: Vector3, speed: float, delta: float) -> void:
	var dir := point - global_position
	dir.y = 0.0
	if dir.length() < 0.001:
		_slow(delta)
		return
	dir = dir.normalized()
	var flat := Vector3(velocity.x, 0.0, velocity.z).move_toward(dir * speed, 26.0 * delta)
	velocity.x = flat.x
	velocity.z = flat.z
	_heading = lerp_angle(_heading, atan2(dir.z, dir.x), TURN_RATE * delta)

func _slow(delta: float) -> void:
	var flat := Vector3(velocity.x, 0.0, velocity.z).move_toward(Vector3.ZERO, 22.0 * delta)
	velocity.x = flat.x
	velocity.z = flat.z

func _cone_half_angle() -> float:
	return CHASE_HALF_ANGLE if state == State.CHASE else CONE_HALF_ANGLE

## Rebuilds the floor fan, casting one ray per edge so it stops at walls.
## Purely cosmetic — detection is decided in `_can_see` — so it is skipped when
## there is no renderer, which also keeps headless test output clean.
func _update_cone() -> void:
	if _cone_mesh == null:
		return
	var space := get_world_3d().direct_space_state
	var half := _cone_half_angle()
	var origin := global_position
	var eye := origin + Vector3.UP * EYE_HEIGHT

	var pts := PackedVector3Array()
	for i in range(CONE_RAYS + 1):
		var a := _heading - half + (2.0 * half) * (float(i) / float(CONE_RAYS))
		var dir := Vector3(cos(a), 0.0, sin(a))
		var query := PhysicsRayQueryParameters3D.create(eye, eye + dir * SIGHT_RANGE, 0b001)
		var hit := space.intersect_ray(query)
		var reach: float = SIGHT_RANGE if hit.is_empty() \
			else minf(eye.distance_to(hit["position"]) - 0.05, SIGHT_RANGE)
		pts.append(origin + dir * maxf(reach, 0.0) + Vector3.UP * CONE_Y)

	_cone.global_position = Vector3.ZERO
	_cone_mesh.clear_surfaces()
	_cone_mesh.surface_begin(Mesh.PRIMITIVE_TRIANGLES)
	var centre := origin + Vector3.UP * CONE_Y
	for i in range(CONE_RAYS):
		_cone_mesh.surface_add_vertex(centre)
		_cone_mesh.surface_add_vertex(pts[i])
		_cone_mesh.surface_add_vertex(pts[i + 1])
	_cone_mesh.surface_end()

func _update_colour() -> void:
	match state:
		State.CHASE:
			_cone_mat.albedo_color = Color(1.0, 0.25, 0.25, 0.26)
			_torso_mat.albedo_color = Color(0.70, 0.21, 0.23)
		State.SUSPECT:
			_cone_mat.albedo_color = Color(1.0, 0.62, 0.15, 0.22)
			_torso_mat.albedo_color = Color(0.56, 0.40, 0.17)
		_:
			_cone_mat.albedo_color = Color(1.0, 0.94, 0.55, 0.16)
			_torso_mat.albedo_color = Color(0.20, 0.31, 0.52)

## 1.0 when the player is right in front, tapering towards the edge of range.
func _sight_strength(player: Player) -> float:
	var d := _flat_distance(global_position, player.global_position)
	var reach := SIGHT_RANGE * player.visibility_scale(_level.is_shadow(player.global_position))
	if reach <= 0.0:
		return 0.0
	return clampf(1.0 - (d / reach) * 0.6, 0.35, 1.0)

func _can_see(player: Player) -> bool:
	var to_player := player.global_position - global_position
	to_player.y = 0.0
	var dist := to_player.length()
	var reach := SIGHT_RANGE * player.visibility_scale(_level.is_shadow(player.global_position))
	# Guards always notice someone standing on top of them.
	if dist < CATCH_DISTANCE * 1.6:
		return true
	if dist > reach:
		return false
	if absf(angle_difference(_heading, atan2(to_player.z, to_player.x))) > _cone_half_angle():
		return false
	return not _level.is_wall_between(global_position, player.global_position)

func caught_player(player: Player) -> bool:
	return _flat_distance(global_position, player.global_position) < CATCH_DISTANCE

static func _flat_distance(a: Vector3, b: Vector3) -> float:
	return Vector2(a.x, a.z).distance_to(Vector2(b.x, b.z))
