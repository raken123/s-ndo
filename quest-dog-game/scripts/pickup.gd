class_name Kibble extends Node3D
## A dropped piece of Dog Food. Hangs in the air for a beat, then homes in on
## the player and pays out.

const MAGNET_DELAY := 0.35
const LIFETIME := 12.0

var value: int = 5
var golden := false

var _game: Node = null
var _time := 0.0
var _speed := 2.0
var _collected := false
var _velocity := Vector3.ZERO


static func create(game: Node, position: Vector3, value: int, golden: bool = false) -> Kibble:
	var pickup := Kibble.new()
	pickup.value = value
	pickup.golden = golden
	pickup._game = game
	pickup.position = position
	return pickup


func _ready() -> void:
	var mesh_instance := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = Vector3(0.09, 0.06, 0.13)
	mesh_instance.mesh = mesh

	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color("ffd447") if golden else Color("a9702f")
	mat.roughness = 0.5
	if golden:
		mat.metallic = 0.9
		mat.emission_enabled = true
		mat.emission = Color("ffbe1a")
		mat.emission_energy_multiplier = 1.4
	mesh_instance.material_override = mat
	mesh_instance.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mesh_instance)

	_velocity = Vector3(randf_range(-1.2, 1.2), randf_range(2.2, 3.4), randf_range(-1.2, 1.2))
	rotation = Vector3(randf() * TAU, randf() * TAU, randf() * TAU)


func _process(delta: float) -> void:
	_time += delta
	rotate_y(delta * 4.0)

	if _time < MAGNET_DELAY:
		# Short arc out of the dog before the magnet kicks in.
		_velocity.y -= 12.0 * delta
		position += _velocity * delta
		if position.y < 0.12:
			position.y = 0.12
			_velocity = Vector3.ZERO
		return

	if _collected or _game == null:
		return

	var target: Vector3 = _game.get_player_position() + Vector3(0, -0.25, 0)
	var to_target := target - global_position
	var distance := to_target.length()
	if distance < 0.35:
		_collect()
		return

	_speed = minf(_speed + delta * 14.0, 12.0)
	global_position += to_target / maxf(distance, 0.001) * _speed * delta

	if _time > LIFETIME:
		_collect()


func _collect() -> void:
	if _collected:
		return
	_collected = true
	if _game != null and _game.has_method("collect_food"):
		_game.collect_food(value, golden)
	Sfx.play("kibble", global_position, -6.0, randf_range(0.95, 1.3) * (0.7 if golden else 1.0))
	queue_free()
