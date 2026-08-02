class_name Companion extends Node3D
## Your dog. Trots along behind you wearing whatever skin you have equipped,
## and is the whole reason to earn Dog Food in the first place.

const FOLLOW_DISTANCE := 1.5
const SPEED := 4.6

var _game: Node = null
var _model: Node3D
var _skin_id := ""
var _bob := 0.0
var _bark_timer := 5.0
var _speed_now := 0.0


func setup(game: Node) -> void:
	_game = game
	set_skin(SaveGame.equipped)


func set_skin(skin_id: String) -> void:
	if skin_id == _skin_id and _model != null:
		return
	_skin_id = skin_id
	if _model != null:
		_model.queue_free()
	_model = DogFactory.build_model(skin_id, 1.0)
	add_child(_model)
	# Little celebration hop whenever you change outfits.
	_model.scale = Vector3(1.25, 0.7, 1.25)
	var tween := create_tween()
	tween.tween_property(_model, "scale", Vector3.ONE, 0.35).set_trans(Tween.TRANS_ELASTIC).set_ease(Tween.EASE_OUT)


func _process(delta: float) -> void:
	if _game == null or _model == null:
		return

	var player: Vector3 = _game.get_player_position()
	player.y = 0.0

	# Trot ahead and off to the player's left: far enough out of the firing
	# line to not block a shot, close enough that you always see your skin.
	var facing: Vector3 = _game.get_player_forward()
	facing.y = 0.0
	if facing.length() < 0.01:
		facing = Vector3.FORWARD
	facing = facing.normalized()
	var side := facing.cross(Vector3.UP).normalized()
	var target := player + facing * FOLLOW_DISTANCE * 0.62 + side * FOLLOW_DISTANCE * 0.95

	var to_target := target - global_position
	to_target.y = 0.0
	var distance := to_target.length()

	if distance > 0.35:
		var move: float = minf(SPEED * delta * clampf(distance, 0.5, 3.0), distance)
		global_position += to_target.normalized() * move
		_speed_now = move / maxf(delta, 0.0001)
		var desired := atan2(to_target.x, to_target.z)
		rotation.y = lerp_angle(rotation.y, desired, clampf(delta * 8.0, 0.0, 1.0))
	else:
		_speed_now = lerpf(_speed_now, 0.0, clampf(delta * 6.0, 0.0, 1.0))
		# Idle: face the same way the player is looking.
		var desired := atan2(facing.x, facing.z)
		rotation.y = lerp_angle(rotation.y, desired, clampf(delta * 3.0, 0.0, 1.0))

	_bob += delta * (4.0 + _speed_now * 2.5)
	var moving := _speed_now > 0.3
	var hop: float = absf(sin(_bob)) * (0.07 if moving else 0.015)
	_model.position.y = hop
	_model.scale = Vector3(1.0, 1.0 - hop * 0.3, 1.0)

	_bark_timer -= delta
	if _bark_timer <= 0.0:
		_bark_timer = randf_range(9.0, 22.0)
		Sfx.play("bark", global_position, -14.0, randf_range(1.05, 1.3))
