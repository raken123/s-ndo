extends Node
## Builds cartoon dogs out of primitives (autoload: `DogFactory`).
##
## Every part of a dog is merged into ONE ArrayMesh with four surfaces
## (primary / secondary / dark / white). That keeps a dog at four draw calls
## instead of ~20, which is what makes a pack of them viable on a Quest.
## Meshes and materials are cached per skin, so ten Ginger Snaps share one mesh.

const SURF_PRIMARY := 0
const SURF_SECONDARY := 1
const SURF_DARK := 2
const SURF_WHITE := 3

var _mesh_cache: Dictionary = {}
var _material_cache: Dictionary = {}
var _spot_texture: ImageTexture

# Shared primitive resources - built once, stamped into dogs many times.
var _sphere: SphereMesh
var _box: BoxMesh
var _capsule: CapsuleMesh
var _cone: CylinderMesh
var _torus: TorusMesh


func _ready() -> void:
	_sphere = SphereMesh.new()
	_sphere.radius = 0.5
	_sphere.height = 1.0
	_sphere.radial_segments = 12
	_sphere.rings = 6

	_box = BoxMesh.new()
	_box.size = Vector3.ONE

	_capsule = CapsuleMesh.new()
	_capsule.radius = 0.5
	_capsule.height = 2.0
	_capsule.radial_segments = 10
	_capsule.rings = 3

	_cone = CylinderMesh.new()
	_cone.top_radius = 0.0
	_cone.bottom_radius = 0.5
	_cone.height = 1.0
	_cone.radial_segments = 8
	_cone.rings = 1

	_torus = TorusMesh.new()
	_torus.inner_radius = 0.4
	_torus.outer_radius = 0.5
	_torus.rings = 10
	_torus.ring_segments = 6


# ---------------------------------------------------------------- materials

func get_materials(skin_id: String) -> Array:
	if _material_cache.has(skin_id):
		return _material_cache[skin_id]

	var skin: Dictionary = Skins.get_skin(skin_id)
	var primary := _make_material(skin["primary"], skin)
	if skin["spots"]:
		primary.albedo_texture = _get_spot_texture(skin["spot_color"])
		primary.uv1_triplanar = true
		primary.uv1_scale = Vector3(1.7, 1.7, 1.7)

	var secondary := _make_material(skin["secondary"], skin)
	var dark := StandardMaterial3D.new()
	dark.albedo_color = Color(0.08, 0.07, 0.07)
	dark.roughness = 0.55
	var white := StandardMaterial3D.new()
	white.albedo_color = Color(0.97, 0.97, 0.97)
	white.roughness = 0.35

	if skin["golden"]:
		dark.albedo_color = Color("3a2a00")
		dark.metallic = 1.0
		dark.roughness = 0.2
		white.albedo_color = Color("fff6cf")
		white.emission_enabled = true
		white.emission = Color("ffdf7a")
		white.emission_energy_multiplier = 0.6

	var mats := [primary, secondary, dark, white]
	_material_cache[skin_id] = mats
	return mats


func _make_material(color: Color, skin: Dictionary) -> StandardMaterial3D:
	var mat := StandardMaterial3D.new()
	mat.albedo_color = color
	mat.metallic = skin["metallic"]
	mat.roughness = skin["roughness"]
	if float(skin["energy"]) > 0.0:
		mat.emission_enabled = true
		mat.emission = skin["emission"]
		mat.emission_energy_multiplier = float(skin["energy"])
	return mat


func _get_spot_texture(spot_color: Color) -> ImageTexture:
	if _spot_texture != null:
		return _spot_texture
	var size := 96
	var image := Image.create(size, size, false, Image.FORMAT_RGB8)
	image.fill(Color.WHITE)
	var rng := RandomNumberGenerator.new()
	rng.seed = 20260802
	for _i in range(26):
		var cx := rng.randi_range(0, size - 1)
		var cy := rng.randi_range(0, size - 1)
		var radius := rng.randf_range(3.0, 8.5)
		for y in range(int(cy - radius) - 1, int(cy + radius) + 2):
			for x in range(int(cx - radius) - 1, int(cx + radius) + 2):
				if Vector2(x - cx, y - cy).length() <= radius:
					image.set_pixel(posmod(x, size), posmod(y, size), spot_color)
	_spot_texture = ImageTexture.create_from_image(image)
	return _spot_texture


# --------------------------------------------------------------------- mesh

func get_mesh(skin_id: String) -> ArrayMesh:
	if _mesh_cache.has(skin_id):
		return _mesh_cache[skin_id]

	var skin: Dictionary = Skins.get_skin(skin_id)
	var tools: Array[SurfaceTool] = []
	for _i in range(4):
		var st := SurfaceTool.new()
		st.begin(Mesh.PRIMITIVE_TRIANGLES)
		tools.append(st)

	# Body: a capsule lying along Z, chest a touch fatter than the hips.
	_stamp(tools[SURF_PRIMARY], _capsule, Vector3(0, 0.42, 0.02), Vector3(90, 0, 0), Vector3(0.36, 0.34, 0.34))
	_stamp(tools[SURF_SECONDARY], _sphere, Vector3(0, 0.33, 0.12), Vector3.ZERO, Vector3(0.34, 0.24, 0.46))

	# Head, snout, nose.
	_stamp(tools[SURF_PRIMARY], _sphere, Vector3(0, 0.63, 0.36), Vector3.ZERO, Vector3(0.34, 0.32, 0.35))
	_stamp(tools[SURF_SECONDARY], _box, Vector3(0, 0.575, 0.50), Vector3.ZERO, Vector3(0.15, 0.11, 0.17))
	_stamp(tools[SURF_DARK], _sphere, Vector3(0, 0.60, 0.585), Vector3.ZERO, Vector3(0.075, 0.06, 0.06))

	# Eyes (white ball + dark pupil, cartoon style).
	for side in [-1.0, 1.0]:
		_stamp(tools[SURF_WHITE], _sphere, Vector3(0.075 * side, 0.67, 0.475), Vector3.ZERO, Vector3(0.075, 0.085, 0.075))
		_stamp(tools[SURF_DARK], _sphere, Vector3(0.082 * side, 0.672, 0.505), Vector3.ZERO, Vector3(0.042, 0.05, 0.042))
		# Floppy ears.
		_stamp(tools[SURF_PRIMARY], _sphere, Vector3(0.155 * side, 0.70, 0.30), Vector3(10, 0, -22 * side), Vector3(0.07, 0.20, 0.13))

	# Legs and paws.
	for x in [-0.13, 0.13]:
		for z in [-0.20, 0.22]:
			_stamp(tools[SURF_PRIMARY], _capsule, Vector3(x, 0.19, z), Vector3.ZERO, Vector3(0.11, 0.19, 0.11))
			_stamp(tools[SURF_SECONDARY], _sphere, Vector3(x, 0.055, z + 0.02), Vector3.ZERO, Vector3(0.13, 0.09, 0.16))

	# Tail with a lighter tip.
	_stamp(tools[SURF_PRIMARY], _capsule, Vector3(0, 0.56, -0.34), Vector3(-40, 0, 0), Vector3(0.08, 0.14, 0.08))
	_stamp(tools[SURF_SECONDARY], _sphere, Vector3(0, 0.70, -0.42), Vector3.ZERO, Vector3(0.10, 0.10, 0.10))

	# Collar: a ring around the neck, so its axis has to point down the body (Z).
	_stamp(tools[SURF_DARK], _torus, Vector3(0, 0.565, 0.235), Vector3(90, 0, 0), Vector3(0.42, 0.42, 0.42))

	if skin["crown"]:
		_stamp(tools[SURF_PRIMARY], _torus, Vector3(0, 0.86, 0.34), Vector3.ZERO, Vector3(0.36, 0.36, 0.36))
		for i in range(5):
			var angle := TAU * float(i) / 5.0
			_stamp(tools[SURF_PRIMARY], _cone,
				Vector3(sin(angle) * 0.078, 0.925, 0.34 + cos(angle) * 0.078),
				Vector3.ZERO, Vector3(0.05, 0.11, 0.05))

	var mesh := ArrayMesh.new()
	for st in tools:
		st.commit(mesh)
	_mesh_cache[skin_id] = mesh
	return mesh


func _stamp(st: SurfaceTool, source: Mesh, position: Vector3, rotation_degrees: Vector3, scale: Vector3) -> void:
	# Scale first, then rotate. Basis.scaled() would scale along the *world*
	# axes, which stretches rotated parts down the wrong axis.
	var basis := Basis.from_euler(Vector3(
		deg_to_rad(rotation_degrees.x),
		deg_to_rad(rotation_degrees.y),
		deg_to_rad(rotation_degrees.z))) * Basis.from_scale(scale)
	st.append_from(source, 0, Transform3D(basis, position))


# -------------------------------------------------------------------- model

## A ready-to-parent dog model. `scale_factor` lets waves mix puppies and bruisers.
func build_model(skin_id: String, scale_factor: float = 1.0) -> Node3D:
	var root := Node3D.new()
	root.name = "Model"

	var mesh_instance := MeshInstance3D.new()
	mesh_instance.name = "Body"
	mesh_instance.mesh = get_mesh(skin_id)
	var materials := get_materials(skin_id)
	for i in range(materials.size()):
		mesh_instance.set_surface_override_material(i, materials[i])
	mesh_instance.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
	root.add_child(mesh_instance)
	root.scale = Vector3.ONE * scale_factor

	if Skins.get_skin(skin_id)["golden"]:
		root.add_child(_build_sparkles())
	return root


func _build_sparkles() -> GPUParticles3D:
	var particles := GPUParticles3D.new()
	particles.name = "Sparkle"
	particles.amount = 18
	particles.lifetime = 1.4
	particles.position = Vector3(0, 0.55, 0.05)

	var process := ParticleProcessMaterial.new()
	process.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_SPHERE
	process.emission_sphere_radius = 0.42
	process.direction = Vector3(0, 1, 0)
	process.spread = 35.0
	process.initial_velocity_min = 0.05
	process.initial_velocity_max = 0.3
	process.gravity = Vector3(0, 0.15, 0)
	process.scale_min = 0.3
	process.scale_max = 0.9
	process.color = Color("fff0a8")
	particles.process_material = process

	var quad := QuadMesh.new()
	quad.size = Vector2(0.05, 0.05)
	var mat := StandardMaterial3D.new()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	mat.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES
	mat.albedo_color = Color("ffe27a")
	mat.vertex_color_use_as_albedo = true
	quad.material = mat
	particles.draw_pass_1 = quad
	return particles
