extends Node3D

## A keycard on the floor. Spins and bobs so it reads as a pickup from the
## fixed camera angle.

var _t := 0.0
var _card: MeshInstance3D = null
var _base_y := 0.0

func _ready() -> void:
	_base_y = position.y
	_card = MeshInstance3D.new()
	var box := BoxMesh.new()
	box.size = Vector3(0.52, 0.34, 0.05)
	_card.mesh = box
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.16, 0.72, 0.92)
	mat.emission_enabled = true
	mat.emission = Color(0.2, 0.8, 1.0)
	mat.emission_energy_multiplier = 0.9
	mat.roughness = 0.35
	_card.material_override = mat
	add_child(_card)

	# A faint pool of light under it, so it's findable in a dark corner.
	var glow := OmniLight3D.new()
	glow.light_color = Color(0.35, 0.85, 1.0)
	glow.light_energy = 1.6
	glow.omni_range = 3.2
	glow.position = Vector3(0, 0.3, 0)
	add_child(glow)

func _process(delta: float) -> void:
	_t += delta
	_card.rotation.y = _t * 1.8
	_card.rotation.x = deg_to_rad(22.0)
	position.y = _base_y + sin(_t * 2.6) * 0.12
