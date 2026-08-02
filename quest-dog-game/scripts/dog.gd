class_name Dog extends CharacterBody3D
## An enemy dog: trots at the player, nips at their ankles, poofs when shot.

signal died(dog: Node3D, food_reward: int, was_golden: bool)

const GRAVITY := 22.0
const BITE_RANGE := 1.35
const BITE_COOLDOWN := 1.1
const HEAD_HEIGHT := 0.52

var speed := 2.4
var max_health := 30.0
var health := 30.0
var food_reward := 10
var is_golden := false
var skin_id := "classic"
var size_scale := 1.0

var _game: Node = null
var _model: Node3D
var _alive := true
var _bob_time := 0.0
var _bite_timer := 0.0
var _bark_timer := 0.0
var _spawn_grace := 0.35


func setup(game: Node, wave: int, golden: bool) -> void:
	_game = game
	is_golden = golden

	var wave_f := float(wave)
	size_scale = randf_range(0.85, 1.15)
	speed = clampf(2.1 + wave_f * 0.13, 2.1, 5.4) * randf_range(0.9, 1.1) / sqrt(size_scale)
	max_health = (24.0 + wave_f * 3.5) * size_scale
	food_reward = 8 + int(wave_f * 1.5)

	if is_golden:
		skin_id = Skins.GOLDEN_ID
		size_scale = 1.25
		speed *= 0.78
		max_health = 140.0 + wave_f * 12.0
		food_reward = 500
	else:
		# Enemies wear the ordinary coats; the fancy ones are player cosmetics.
		skin_id = ["classic", "ash", "cocoa", "ginger", "snow", "midnight"].pick_random()

	health = max_health
	_build()


func _build() -> void:
	collision_layer = 2
	collision_mask = 1 | 2

	var shape := CollisionShape3D.new()
	var capsule := CapsuleShape3D.new()
	capsule.radius = 0.26 * size_scale
	capsule.height = 0.86 * size_scale
	shape.shape = capsule
	shape.position = Vector3(0, 0.43 * size_scale, 0)
	add_child(shape)

	_model = DogFactory.build_model(skin_id, size_scale)
	add_child(_model)

	# Pop into existence rather than blinking in.
	_model.scale = Vector3.ZERO
	var tween := create_tween()
	tween.tween_property(_model, "scale", Vector3.ONE * size_scale, 0.28) \
		.set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)

	_bark_timer = randf_range(1.0, 6.0)
	_bob_time = randf() * TAU


func _physics_process(delta: float) -> void:
	if not _alive:
		return

	if not is_on_floor():
		velocity.y -= GRAVITY * delta
	else:
		velocity.y = 0.0

	_spawn_grace = maxf(0.0, _spawn_grace - delta)
	_bite_timer = maxf(0.0, _bite_timer - delta)
	_bark_timer -= delta
	if _bark_timer <= 0.0:
		_bark_timer = randf_range(4.0, 11.0)
		Sfx.play("bark_low" if size_scale > 1.0 else "bark", global_position, -8.0, randf_range(0.85, 1.2))

	var target := _target_position()
	var to_target := target - global_position
	to_target.y = 0.0
	var distance := to_target.length()

	if distance > BITE_RANGE and _spawn_grace <= 0.0:
		var direction := to_target / maxf(distance, 0.001)
		velocity.x = direction.x * speed
		velocity.z = direction.z * speed
		_bob_time += delta * (6.0 + speed)
	else:
		velocity.x = move_toward(velocity.x, 0.0, speed * 4.0 * delta)
		velocity.z = move_toward(velocity.z, 0.0, speed * 4.0 * delta)
		if distance <= BITE_RANGE and _bite_timer <= 0.0 and _game != null:
			_bite()

	move_and_slide()

	if distance > 0.05:
		var desired := atan2(to_target.x, to_target.z)
		rotation.y = lerp_angle(rotation.y, desired, clampf(delta * 7.0, 0.0, 1.0))

	# A bouncy run cycle: hop, squash, and lean into the stride.
	var moving := Vector2(velocity.x, velocity.z).length() > 0.4
	var hop: float = absf(sin(_bob_time)) * (0.075 if moving else 0.012)
	var squash: float = 1.0 - hop * 0.35
	_model.position.y = hop
	_model.scale = Vector3(size_scale, size_scale * squash, size_scale)
	_model.rotation.x = sin(_bob_time * 0.5) * (0.09 if moving else 0.02)


func _target_position() -> Vector3:
	if _game != null and _game.has_method("get_player_position"):
		var pos: Vector3 = _game.get_player_position()
		pos.y = global_position.y
		return pos
	return global_position


func _bite() -> void:
	_bite_timer = BITE_COOLDOWN
	Sfx.play("bark", global_position, -2.0, randf_range(0.95, 1.15))
	_game.damage_player(6.0 + size_scale * 3.0, global_position)
	var lunge := create_tween()
	lunge.tween_property(_model, "position:z", 0.18, 0.08)
	lunge.tween_property(_model, "position:z", 0.0, 0.14)


## Returns the amount of damage actually dealt (0 once the dog is down).
func take_damage(amount: float, hit_point: Vector3, headshot: bool) -> float:
	if not _alive:
		return 0.0
	var dealt: float = amount * (2.0 if headshot else 1.0)
	health -= dealt
	_spawn_impact(hit_point, headshot)
	if health <= 0.0:
		_die(headshot)
	else:
		Sfx.play("yelp", global_position, -6.0, randf_range(1.0, 1.25))
		# Knock the dog back a little so hits feel like they land.
		var push := (global_position - hit_point).normalized() * 1.6
		velocity.x += push.x
		velocity.z += push.z
	return dealt


func _die(headshot: bool) -> void:
	_alive = false
	collision_layer = 0
	collision_mask = 0
	set_physics_process(false)
	Sfx.play("yelp", global_position, 0.0, randf_range(0.9, 1.1))
	if is_golden:
		Sfx.play("golden", global_position, 4.0)

	_spawn_poof()
	var reward: int = food_reward * (2 if headshot else 1)
	died.emit(self, reward, is_golden)

	var tween := create_tween()
	tween.set_parallel(true)
	tween.tween_property(_model, "scale", Vector3(size_scale * 1.35, size_scale * 0.15, size_scale * 1.35), 0.18)
	tween.tween_property(_model, "rotation:y", _model.rotation.y + TAU, 0.35)
	tween.chain().tween_property(_model, "scale", Vector3.ZERO, 0.2)
	tween.chain().tween_callback(queue_free)


func _spawn_impact(point: Vector3, headshot: bool) -> void:
	var particles := _make_burst(
		Color("ffe9a8") if headshot else Color("ffd0d0"),
		10 if headshot else 6, 2.4, 0.04)
	particles.position = to_local(point)
	add_child(particles)
	particles.emitting = true
	# One-shot bursts clean themselves up; a timer lambda would outlive the dog.
	particles.finished.connect(particles.queue_free)


func _spawn_poof() -> void:
	var color: Color = Color("fff0a0") if is_golden else Color("d8c39a")
	var particles := _make_burst(color, 26, 3.2, 0.07)
	particles.position = Vector3(0, 0.4, 0)
	# Reparent to the arena so the burst outlives the dog.
	var parent := get_parent()
	parent.add_child(particles)
	particles.global_position = global_position + Vector3(0, 0.4, 0)
	particles.emitting = true
	particles.finished.connect(particles.queue_free)


func _make_burst(color: Color, amount: int, velocity_max: float, size: float) -> GPUParticles3D:
	var particles := GPUParticles3D.new()
	particles.amount = amount
	particles.lifetime = 0.75
	particles.one_shot = true
	particles.explosiveness = 1.0

	var process := ParticleProcessMaterial.new()
	process.direction = Vector3(0, 1, 0)
	process.spread = 180.0
	process.initial_velocity_min = velocity_max * 0.35
	process.initial_velocity_max = velocity_max
	process.gravity = Vector3(0, -5.0, 0)
	process.damping_min = 1.0
	process.damping_max = 2.5
	process.scale_min = 0.5
	process.scale_max = 1.2
	process.color = color
	particles.process_material = process

	var quad := QuadMesh.new()
	quad.size = Vector2(size, size)
	var mat := StandardMaterial3D.new()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES
	mat.albedo_color = color
	mat.vertex_color_use_as_albedo = true
	quad.material = mat
	particles.draw_pass_1 = quad
	return particles
