class_name Player
extends CharacterBody2D

## The escapee. Moves on an analog vector supplied by keyboard or the on-screen
## joystick. Sneaking is slower but roughly halves how far a guard can notice
## you from, which is the core trade the levels are built around.

const RADIUS := 16.0
const WALK_SPEED := 215.0
const SNEAK_SPEED := 105.0
const ACCEL := 2200.0
const FRICTION := 2600.0

## Fed by the HUD joystick each frame; keyboard input is added on top.
var stick := Vector2.ZERO
## Set by the HUD's sneak toggle. OR-ed with the keyboard sneak key.
var touch_sneak := false
var sneaking := false
var keycards := 0

var _facing := Vector2.RIGHT
var _bob := 0.0

func _ready() -> void:
	collision_layer = 0b010
	collision_mask = 0b001
	var shape := CollisionShape2D.new()
	var circle := CircleShape2D.new()
	circle.radius = RADIUS
	shape.shape = circle
	add_child(shape)
	z_index = 10

func _physics_process(delta: float) -> void:
	var dir := stick
	var keys := Input.get_vector("move_left", "move_right", "move_up", "move_down")
	if keys.length() > 0.01:
		dir = keys
	if dir.length() > 1.0:
		dir = dir.normalized()

	sneaking = touch_sneak or Input.is_action_pressed("sneak")
	var speed := SNEAK_SPEED if sneaking else WALK_SPEED

	if dir.length() > 0.05:
		velocity = velocity.move_toward(dir * speed, ACCEL * delta)
		_facing = dir.normalized()
		_bob += delta * (6.0 if sneaking else 12.0)
	else:
		velocity = velocity.move_toward(Vector2.ZERO, FRICTION * delta)

	move_and_slide()
	queue_redraw()

## How visible the player is right now, as a multiplier on guard sight range.
func visibility_scale(in_shadow: bool) -> float:
	var v := 0.55 if sneaking else 1.0
	if in_shadow:
		v *= 0.5
	return v

func _draw() -> void:
	var wobble := sin(_bob) * 1.5
	# Drop shadow.
	draw_circle(Vector2(0, 5), RADIUS * 0.95, Color(0, 0, 0, 0.35))
	# Prison jumpsuit: body then two stripes.
	draw_circle(Vector2(0, wobble), RADIUS, Color(0.95, 0.55, 0.18))
	draw_rect(Rect2(-RADIUS, -5.0 + wobble, RADIUS * 2.0, 3.0), Color(0.99, 0.85, 0.7))
	draw_rect(Rect2(-RADIUS, 3.0 + wobble, RADIUS * 2.0, 3.0), Color(0.99, 0.85, 0.7))
	draw_circle(Vector2(0, wobble), RADIUS, Color(1, 1, 1, 0.9), false, 2.0)
	# Head / facing nub.
	draw_circle(_facing * 9.0 + Vector2(0, wobble), 6.0, Color(0.99, 0.82, 0.65))
	if sneaking:
		draw_arc(Vector2(0, wobble), RADIUS + 6.0, 0, TAU, 24, Color(0.4, 0.9, 1.0, 0.5), 2.0)
