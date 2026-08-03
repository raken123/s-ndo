extends Node3D

## The perimeter gate. A pulsing green pillar of light — it has to be findable
## from across the level, so it is deliberately the brightest thing on the map.

const TILE := 2.0

var _t := 0.0
var _mat: StandardMaterial3D = null
var _light: OmniLight3D = null

func _ready() -> void:
	var pillar := MeshInstance3D.new()
	var box := BoxMesh.new()
	box.size = Vector3(TILE * 0.85, 3.2, TILE * 0.85)
	pillar.mesh = box
	pillar.position = Vector3(0, 1.6, 0)
	pillar.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_mat = StandardMaterial3D.new()
	_mat.albedo_color = Color(0.35, 1.0, 0.55, 0.28)
	_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_mat.emission_enabled = true
	_mat.emission = Color(0.35, 1.0, 0.55)
	_mat.emission_energy_multiplier = 1.2
	pillar.material_override = _mat
	add_child(pillar)

	var pad := MeshInstance3D.new()
	var plate := CylinderMesh.new()
	plate.top_radius = TILE * 0.46
	plate.bottom_radius = TILE * 0.46
	plate.height = 0.06
	pad.mesh = plate
	pad.position = Vector3(0, 0.04, 0)
	var pad_mat := StandardMaterial3D.new()
	pad_mat.albedo_color = Color(0.22, 0.75, 0.40)
	pad_mat.emission_enabled = true
	pad_mat.emission = Color(0.3, 0.95, 0.5)
	pad_mat.emission_energy_multiplier = 0.8
	pad.material_override = pad_mat
	add_child(pad)

	_light = OmniLight3D.new()
	_light.light_color = Color(0.4, 1.0, 0.6)
	_light.omni_range = 6.5
	_light.position = Vector3(0, 1.4, 0)
	add_child(_light)

func _process(delta: float) -> void:
	_t += delta
	var pulse := 0.5 + 0.5 * sin(_t * 2.4)
	_mat.albedo_color.a = 0.18 + 0.20 * pulse
	_mat.emission_energy_multiplier = 0.8 + 0.9 * pulse
	_light.light_energy = 1.4 + 1.1 * pulse
