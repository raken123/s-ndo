class_name KibbleBlaster extends Node3D
## The Kibble Blaster: hitscan pistol with a laser sight that doubles as the
## shop pointer. Built from primitives so it needs no imported model.

signal hit_dog(dog: Dog, damage_dealt: float, headshot: bool)

const DAMAGE := 18.0
const RANGE := 60.0
const FIRE_INTERVAL := 0.17
const MAG_SIZE := 12
const RELOAD_TIME := 1.15
const RAY_MASK := 1 | 2

var ammo := MAG_SIZE
var reloading := false

var _muzzle: Marker3D
var _flash: OmniLight3D
var _flash_mesh: MeshInstance3D
var _pointer: MeshInstance3D
var _pointer_dot: MeshInstance3D
var _accent_material: StandardMaterial3D
var _ammo_label: Label3D
var _cooldown := 0.0
var _reload_timer := 0.0
var _body: Node3D


func _ready() -> void:
	_body = Node3D.new()
	add_child(_body)

	var dark := StandardMaterial3D.new()
	dark.albedo_color = Color("2b3140")
	dark.metallic = 0.6
	dark.roughness = 0.42

	_accent_material = StandardMaterial3D.new()
	_accent_material.albedo_color = Color("ff9b3d")
	_accent_material.metallic = 0.3
	_accent_material.roughness = 0.35

	# Slide, barrel, grip, kibble hopper.
	_part(BoxMesh.new(), Vector3(0, 0, -0.10), Vector3.ZERO, Vector3(0.055, 0.075, 0.22), dark)
	_part(CylinderMesh.new(), Vector3(0, 0.012, -0.26), Vector3(90, 0, 0), Vector3(0.028, 0.14, 0.028), dark)
	_part(BoxMesh.new(), Vector3(0, -0.085, 0.005), Vector3(12, 0, 0), Vector3(0.048, 0.13, 0.06), dark)
	_part(BoxMesh.new(), Vector3(0, 0.055, -0.09), Vector3.ZERO, Vector3(0.04, 0.03, 0.14), _accent_material)
	_part(SphereMesh.new(), Vector3(0, 0.066, -0.02), Vector3.ZERO, Vector3(0.03, 0.03, 0.03), _accent_material)

	_muzzle = Marker3D.new()
	_muzzle.position = Vector3(0, 0.012, -0.33)
	add_child(_muzzle)

	_flash = OmniLight3D.new()
	_flash.light_color = Color("ffd08a")
	_flash.light_energy = 0.0
	_flash.omni_range = 3.5
	_flash.shadow_enabled = false
	_muzzle.add_child(_flash)

	var flash_mesh := SphereMesh.new()
	flash_mesh.radius = 0.055
	flash_mesh.height = 0.11
	flash_mesh.radial_segments = 8
	flash_mesh.rings = 4
	_flash_mesh = MeshInstance3D.new()
	_flash_mesh.mesh = flash_mesh
	_flash_mesh.material_override = _unshaded(Color("ffe6a8"), true)
	_flash_mesh.visible = false
	_flash_mesh.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_muzzle.add_child(_flash_mesh)

	_build_pointer()

	_ammo_label = Label3D.new()
	_ammo_label.font_size = 64
	_ammo_label.pixel_size = 0.00035
	_ammo_label.position = Vector3(0, 0.058, 0.075)
	_ammo_label.modulate = Color("9ef7ff")
	_ammo_label.outline_size = 12
	_ammo_label.outline_modulate = Color(0, 0, 0, 0.8)
	_ammo_label.no_depth_test = false
	add_child(_ammo_label)
	_refresh_ammo_label()


func _part(mesh: Mesh, position: Vector3, rotation_degrees: Vector3, size: Vector3, material: Material) -> void:
	if mesh is BoxMesh:
		(mesh as BoxMesh).size = size
	elif mesh is CylinderMesh:
		var cylinder := mesh as CylinderMesh
		cylinder.top_radius = size.x
		cylinder.bottom_radius = size.x
		cylinder.height = size.y
		cylinder.radial_segments = 10
		cylinder.rings = 1
	elif mesh is SphereMesh:
		var sphere := mesh as SphereMesh
		sphere.radius = size.x
		sphere.height = size.x * 2.0
		sphere.radial_segments = 10
		sphere.rings = 5

	var instance := MeshInstance3D.new()
	instance.mesh = mesh
	instance.material_override = material
	instance.position = position
	instance.rotation_degrees = rotation_degrees
	instance.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_body.add_child(instance)


func _build_pointer() -> void:
	var beam := CylinderMesh.new()
	beam.top_radius = 0.0035
	beam.bottom_radius = 0.0035
	beam.height = 1.0
	beam.radial_segments = 6
	beam.rings = 1
	_pointer = MeshInstance3D.new()
	_pointer.mesh = beam
	_pointer.material_override = _unshaded(Color(1.0, 0.35, 0.3, 0.55), true)
	_pointer.rotation_degrees = Vector3(-90, 0, 0)
	_pointer.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_muzzle.add_child(_pointer)

	var dot := SphereMesh.new()
	dot.radius = 0.014
	dot.height = 0.028
	dot.radial_segments = 8
	dot.rings = 4
	_pointer_dot = MeshInstance3D.new()
	_pointer_dot.mesh = dot
	_pointer_dot.material_override = _unshaded(Color(1.0, 0.4, 0.35, 0.9), true)
	_pointer_dot.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_muzzle.add_child(_pointer_dot)


func _unshaded(color: Color, additive: bool) -> StandardMaterial3D:
	var mat := StandardMaterial3D.new()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.albedo_color = color
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	if additive:
		mat.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	mat.disable_receive_shadows = true
	return mat


## Tint the blaster's trim to match the equipped dog skin.
func set_accent(color: Color) -> void:
	_accent_material.albedo_color = color


func aim_transform() -> Transform3D:
	return _muzzle.global_transform


func _process(delta: float) -> void:
	_cooldown = maxf(0.0, _cooldown - delta)
	if reloading:
		_reload_timer -= delta
		if _reload_timer <= 0.0:
			reloading = false
			ammo = MAG_SIZE
			_refresh_ammo_label()
			Sfx.play("reload", global_position, -8.0)

	_update_pointer()


func _update_pointer() -> void:
	var origin := _muzzle.global_position
	var direction := -_muzzle.global_transform.basis.z
	var length := RANGE
	var space := get_world_3d().direct_space_state
	if space != null:
		var query := PhysicsRayQueryParameters3D.create(origin, origin + direction * RANGE)
		query.collision_mask = RAY_MASK | 8
		query.collide_with_areas = true
		var hit := space.intersect_ray(query)
		if hit.has("position"):
			length = origin.distance_to(hit["position"])
	length = clampf(length, 0.2, RANGE)
	_pointer.position = Vector3(0, 0, -length * 0.5)
	_pointer.scale = Vector3(1, length, 1)
	_pointer_dot.position = Vector3(0, 0, -length)


func can_fire() -> bool:
	return _cooldown <= 0.0 and not reloading and ammo > 0


func start_reload() -> void:
	if reloading or ammo == MAG_SIZE:
		return
	reloading = true
	_reload_timer = RELOAD_TIME
	_ammo_label.text = "..."
	Sfx.play("click", global_position, -12.0)


## Fires one round. Returns true if a shot actually went out.
func fire() -> bool:
	if _cooldown > 0.0 or reloading:
		return false
	if ammo <= 0:
		Sfx.play("empty", global_position, -8.0)
		start_reload()
		return false

	ammo -= 1
	_cooldown = FIRE_INTERVAL
	_refresh_ammo_label()

	var origin := _muzzle.global_position
	var direction := -_muzzle.global_transform.basis.z
	var end := origin + direction * RANGE

	var space := get_world_3d().direct_space_state
	var query := PhysicsRayQueryParameters3D.create(origin, end)
	query.collision_mask = RAY_MASK
	var hit := space.intersect_ray(query)

	if hit.has("collider"):
		end = hit["position"]
		var collider: Object = hit["collider"]
		if collider is Dog:
			var dog := collider as Dog
			var headshot: bool = end.y > dog.global_position.y + Dog.HEAD_HEIGHT * dog.size_scale
			var dealt := dog.take_damage(DAMAGE, end, headshot)
			hit_dog.emit(dog, dealt, headshot)

	_spawn_tracer(origin, end)
	_muzzle_flash()
	Sfx.play("shot", origin, -3.0, randf_range(0.95, 1.08))

	if ammo == 0:
		start_reload()
	return true


func _refresh_ammo_label() -> void:
	_ammo_label.text = str(ammo)


func _muzzle_flash() -> void:
	_flash.light_energy = 3.2
	_flash_mesh.visible = true
	_flash_mesh.scale = Vector3.ONE * randf_range(0.8, 1.25)
	var tween := create_tween()
	tween.tween_property(_flash, "light_energy", 0.0, 0.07)
	tween.parallel().tween_property(_flash_mesh, "scale", Vector3.ONE * 0.2, 0.07)
	tween.tween_callback(func() -> void: _flash_mesh.visible = false)

	# Recoil kick.
	var recoil := create_tween()
	_body.position = Vector3(0, 0, 0.028)
	_body.rotation_degrees = Vector3(-4.5, 0, 0)
	recoil.tween_property(_body, "position", Vector3.ZERO, 0.09)
	recoil.parallel().tween_property(_body, "rotation_degrees", Vector3.ZERO, 0.11)


func _spawn_tracer(from: Vector3, to: Vector3) -> void:
	var length := from.distance_to(to)
	if length < 0.05:
		return
	var beam := CylinderMesh.new()
	beam.top_radius = 0.012
	beam.bottom_radius = 0.004
	beam.height = length
	beam.radial_segments = 6
	beam.rings = 1

	var instance := MeshInstance3D.new()
	instance.mesh = beam
	var mat := _unshaded(Color(1.0, 0.85, 0.45, 0.85), true)
	instance.material_override = mat
	instance.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF

	var world := get_tree().current_scene
	if world == null:
		return
	world.add_child(instance)
	var mid := (from + to) * 0.5
	instance.global_position = mid
	var direction := (to - from).normalized()
	var up := Vector3.UP if absf(direction.dot(Vector3.UP)) < 0.98 else Vector3.RIGHT
	instance.look_at_from_position(mid, to, up)
	instance.rotate_object_local(Vector3.RIGHT, PI * 0.5)

	var tween := instance.create_tween()
	tween.tween_property(mat, "albedo_color:a", 0.0, 0.09)
	tween.tween_callback(instance.queue_free)
