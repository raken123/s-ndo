class_name WristHud extends Node3D
## Wrist-mounted readout: Dog Food, wave, kills and a health bar.
## Rides on the left controller in VR, or sits in the corner of the view on
## desktop.

const WIDTH := 0.20
const HEIGHT := 0.135

var _food_label: Label3D
var _wave_label: Label3D
var _kills_label: Label3D
var _hint_label: Label3D
var _health_fill: MeshInstance3D
var _health_material: StandardMaterial3D
var _layer := 0


func _ready() -> void:
	_panel(Vector3(0, 0, -0.002), Vector2(WIDTH + 0.012, HEIGHT + 0.012), Color(0.4, 0.8, 1.0, 0.5))
	_panel(Vector3.ZERO, Vector2(WIDTH, HEIGHT), Color(0.04, 0.06, 0.09, 0.9))

	_label("DOG FOOD", Vector3(0, HEIGHT * 0.5 - 0.018, 0.002), 26, Color("7f8c9a"))
	_food_label = _label("0", Vector3(0, HEIGHT * 0.5 - 0.048, 0.002), 52, Color("ffd447"))
	_wave_label = _label("WAVE 1", Vector3(-0.045, -0.012, 0.002), 28, Color("9ef7ff"))
	_kills_label = _label("0 KILLS", Vector3(0.048, -0.012, 0.002), 28, Color("cfd6dd"))

	_panel(Vector3(0, -0.042, 0.002), Vector2(WIDTH - 0.03, 0.014), Color(0.2, 0.05, 0.07, 0.95))
	_health_fill = _panel(Vector3(0, -0.042, 0.003), Vector2(WIDTH - 0.03, 0.014), Color("54d16a"))
	_health_material = _health_fill.material_override

	_hint_label = _label("", Vector3(0, -HEIGHT * 0.5 + 0.014, 0.002), 22, Color("8a95a3"))
	set_hint("")


## Depth testing is off so the readout is never occluded by the world; that
## makes render_priority the only thing deciding what covers what.
func _panel(position: Vector3, size: Vector2, color: Color) -> MeshInstance3D:
	var mesh := QuadMesh.new()
	mesh.size = size
	var instance := MeshInstance3D.new()
	instance.mesh = mesh
	var mat := StandardMaterial3D.new()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.albedo_color = color
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	mat.no_depth_test = true
	_layer += 1
	mat.render_priority = _layer
	instance.material_override = mat
	instance.position = position
	instance.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(instance)
	return instance


func _label(text: String, position: Vector3, font_size: int, color: Color) -> Label3D:
	var label := Label3D.new()
	label.text = text
	label.font_size = font_size
	label.pixel_size = 0.00042
	label.modulate = color
	label.outline_size = 8
	label.outline_modulate = Color(0, 0, 0, 0.9)
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	label.position = position
	label.shaded = false
	label.no_depth_test = true
	label.render_priority = 20
	label.outline_render_priority = 19
	add_child(label)
	return label


func set_food(value: int) -> void:
	_food_label.text = str(value)


func set_wave(wave: int) -> void:
	_wave_label.text = "WAVE %d" % wave


func set_kills(kills: int) -> void:
	_kills_label.text = "%d KILLS" % kills


func set_health(current: float, maximum: float) -> void:
	var ratio := clampf(current / maxf(maximum, 0.001), 0.0, 1.0)
	_health_fill.scale = Vector3(ratio, 1.0, 1.0)
	_health_fill.position.x = -(WIDTH - 0.03) * 0.5 * (1.0 - ratio)
	_health_material.albedo_color = Color("54d16a").lerp(Color("ff4d4d"), 1.0 - ratio)


func set_hint(text: String) -> void:
	_hint_label.text = text
	_hint_label.visible = text != ""
