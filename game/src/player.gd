class_name Player
extends CharacterBody3D

## The escapee. The stick maps straight to world directions (the camera never
## rotates), which is the only scheme that stays readable one-thumbed.
##
## Sneaking is half speed but roughly halves how far a guard can notice you
## from — that trade is the whole game.

const RADIUS := 0.42
const HEIGHT := 1.5
const WALK_SPEED := 6.6
const SNEAK_SPEED := 3.2
const ACCEL := 45.0
const FRICTION := 55.0
const GRAVITY := 22.0
const TURN_RATE := 12.0

## Fed by the HUD joystick each frame; keyboard input overrides it.
var stick := Vector2.ZERO
## Set by the HUD's sneak toggle. OR-ed with the keyboard sneak key.
var touch_sneak := false
var sneaking := false
var keycards := 0

var _body: Node3D = null
var _bob := 0.0

func _ready() -> void:
	collision_layer = 0b010
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

func _build_look() -> void:
	# Torso in prison orange, with the stripes that read at a glance from above.
	var torso := MeshInstance3D.new()
	var capsule := CapsuleMesh.new()
	capsule.radius = RADIUS
	capsule.height = HEIGHT
	torso.mesh = capsule
	torso.position = Vector3(0, HEIGHT * 0.5, 0)
	torso.material_override = _mat(Color(0.94, 0.53, 0.16), 0.7)
	_body.add_child(torso)

	for i in 2:
		var stripe := MeshInstance3D.new()
		var band := CylinderMesh.new()
		band.top_radius = RADIUS + 0.03
		band.bottom_radius = RADIUS + 0.03
		band.height = 0.11
		stripe.mesh = band
		stripe.position = Vector3(0, 0.62 + i * 0.26, 0)
		stripe.material_override = _mat(Color(0.99, 0.88, 0.74), 0.8)
		_body.add_child(stripe)

	var head := MeshInstance3D.new()
	var sphere := SphereMesh.new()
	sphere.radius = 0.27
	sphere.height = 0.54
	head.mesh = sphere
	head.position = Vector3(0, HEIGHT + 0.16, 0)
	head.material_override = _mat(Color(0.99, 0.82, 0.65), 0.75)
	_body.add_child(head)

	# Small nose-cone so which way you're facing is unambiguous from above.
	var nose := MeshInstance3D.new()
	var cone := CylinderMesh.new()
	cone.top_radius = 0.0
	cone.bottom_radius = 0.13
	cone.height = 0.26
	nose.mesh = cone
	nose.position = Vector3(0, HEIGHT + 0.16, -0.26)
	nose.rotation_degrees = Vector3(-90, 0, 0)
	nose.material_override = _mat(Color(0.22, 0.27, 0.4), 0.6)
	_body.add_child(nose)

func _mat(albedo: Color, roughness: float) -> StandardMaterial3D:
	var mat := StandardMaterial3D.new()
	mat.albedo_color = albedo
	mat.roughness = roughness
	return mat

func _physics_process(delta: float) -> void:
	var dir := stick
	var keys := Input.get_vector("move_left", "move_right", "move_up", "move_down")
	if keys.length() > 0.01:
		dir = keys
	if dir.length() > 1.0:
		dir = dir.normalized()

	sneaking = touch_sneak or Input.is_action_pressed("sneak")
	var speed := SNEAK_SPEED if sneaking else WALK_SPEED

	# Screen-space stick maps directly to the world's X/Z plane.
	var wish := Vector3(dir.x, 0.0, dir.y) * speed
	var flat := Vector3(velocity.x, 0.0, velocity.z)
	if dir.length() > 0.05:
		flat = flat.move_toward(wish, ACCEL * delta)
		_face(Vector3(dir.x, 0.0, dir.y), delta)
		_bob += delta * (7.0 if sneaking else 14.0)
	else:
		flat = flat.move_toward(Vector3.ZERO, FRICTION * delta)

	velocity.x = flat.x
	velocity.z = flat.z
	if not is_on_floor():
		velocity.y -= GRAVITY * delta
	else:
		velocity.y = 0.0

	move_and_slide()

	# Crouch and bob, purely so the state is visible without reading the HUD.
	var crouch := 0.68 if sneaking else 1.0
	var bob := sin(_bob) * (0.02 if sneaking else 0.05)
	_body.scale = _body.scale.lerp(Vector3(1.0, crouch, 1.0), clampf(10.0 * delta, 0.0, 1.0))
	_body.position.y = bob

func _face(dir: Vector3, delta: float) -> void:
	# A node's forward is -Z, so a heading of `dir` is atan2(-x, -z).
	var target := atan2(-dir.x, -dir.z)
	_body.rotation.y = lerp_angle(_body.rotation.y, target, TURN_RATE * delta)

## How visible the player is right now, as a multiplier on guard sight range.
func visibility_scale(in_shadow: bool) -> float:
	var v := 0.55 if sneaking else 1.0
	if in_shadow:
		v *= 0.5
	return v
