"""Nexora Local for Godot: writes a playable Godot 4 project from a JSON config.

    python nexora_godot_local.py config.json

Run with the project folder as the working directory. Astryx 5 Pro uses this as its
offline builder (no AI key needed); with Claude, Astryx writes its own Python instead.
Standard library only.

Config keys: title, tagline, seed, difficulty (0-2), palette {bg1, bg2, ground, top,
player, enemy, coin, accent, deco}, hyperreal (bool), hdri ("res://..." or ""),
ground_maps {albedo, normal, roughness} ("res://..." paths), models ["res://...gltf"].
"""
import json
import os
import sys

MAIN_GD = r'''extends Node3D
## __TITLE__ – made with Nexora (Astryx 5 Pro, Godot mode).
## Third-person: collect every orb before time runs out and keep away from the hunters.

const CFG_TEXT := """__CFG__"""
const SPEED := 7.0
const JUMP := 8.5
const GRAVITY := 22.0
const WORLD := 56.0

var cfg: Dictionary
var rng := RandomNumberGenerator.new()
var player: CharacterBody3D
var body_mesh: MeshInstance3D
var cam: Camera3D
var hud: Label
var banner: Label
var sub: Label
var orbs: Array[Node3D] = []
var foes: Array[Node3D] = []
var score := 0
var time_left := 0.0
var state := "intro"
var intro_t := 0.0
var t := 0.0

func _ready() -> void:
	cfg = JSON.parse_string(CFG_TEXT)
	rng.seed = int(cfg.seed)
	_setup_input()
	_setup_environment()
	_build_world()
	_spawn_player()
	for i in range(int(cfg.orbs)):
		_spawn_orb()
	for i in range(int(cfg.foes)):
		_spawn_foe(i)
	_build_hud()
	time_left = float(cfg.time)

# ---------------------------------------------------------------- setup
func _key(action: String, keys: Array) -> void:
	if not InputMap.has_action(action):
		InputMap.add_action(action)
	for k in keys:
		var e := InputEventKey.new()
		e.physical_keycode = k
		InputMap.action_add_event(action, e)

func _setup_input() -> void:
	_key("move_left", [KEY_A, KEY_LEFT])
	_key("move_right", [KEY_D, KEY_RIGHT])
	_key("move_forward", [KEY_W, KEY_UP])
	_key("move_back", [KEY_S, KEY_DOWN])
	_key("jump", [KEY_SPACE])
	_key("restart", [KEY_R, KEY_ENTER])

func _mat(color: String, emission := 0.0, rough := 0.8) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = Color(color)
	m.roughness = rough
	if emission > 0.0:
		m.emission_enabled = true
		m.emission = Color(color)
		m.emission_energy_multiplier = emission
	return m

func _setup_environment() -> void:
	var env := Environment.new()
	var sky := Sky.new()
	var hdri: String = cfg.get("hdri", "")
	if hdri != "" and ResourceLoader.exists(hdri):
		var pano := PanoramaSkyMaterial.new()
		pano.panorama = load(hdri)
		sky.sky_material = pano
	else:
		var ps := ProceduralSkyMaterial.new()
		ps.sky_top_color = Color(cfg.palette.bg1)
		ps.sky_horizon_color = Color(cfg.palette.bg2)
		ps.ground_horizon_color = Color(cfg.palette.bg2)
		ps.ground_bottom_color = Color(cfg.palette.ground)
		sky.sky_material = ps
	env.background_mode = Environment.BG_SKY
	env.sky = sky
	env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	env.reflected_light_source = Environment.REFLECTION_SOURCE_SKY
	env.glow_enabled = true
	env.glow_intensity = 0.6
	if cfg.hyperreal:
		# Physically based look: filmic tonemapping, GI, AO, reflections and a light haze.
		env.tonemap_mode = Environment.TONE_MAPPER_AGX
		env.sdfgi_enabled = true
		env.ssao_enabled = true
		env.ssil_enabled = true
		env.ssr_enabled = true
		env.volumetric_fog_enabled = true
		env.volumetric_fog_density = 0.008
		env.adjustment_enabled = true
		env.adjustment_contrast = 1.05
		env.adjustment_saturation = 1.05
	else:
		env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
		env.fog_enabled = true
		env.fog_light_color = Color(cfg.palette.bg2)
		env.fog_density = 0.006
	var we := WorldEnvironment.new()
	we.environment = env
	add_child(we)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-48, 32, 0)
	sun.shadow_enabled = true
	sun.light_energy = 1.3 if cfg.hyperreal else 1.1
	sun.directional_shadow_max_distance = 80.0
	add_child(sun)

func _build_world() -> void:
	var ground := MeshInstance3D.new()
	var plane := PlaneMesh.new()
	plane.size = Vector2(WORLD * 2.4, WORLD * 2.4)
	ground.mesh = plane
	var gm := _mat(cfg.palette.ground, 0.0, 0.95)
	var maps: Dictionary = cfg.get("ground_maps", {})
	if maps.get("albedo", "") != "" and ResourceLoader.exists(maps.albedo):
		gm.albedo_color = Color.WHITE
		gm.albedo_texture = load(maps.albedo)
		gm.uv1_scale = Vector3(40, 40, 1)
		if maps.get("normal", "") != "" and ResourceLoader.exists(maps.normal):
			gm.normal_enabled = true
			gm.normal_texture = load(maps.normal)
		if maps.get("roughness", "") != "" and ResourceLoader.exists(maps.roughness):
			gm.roughness_texture = load(maps.roughness)
			gm.roughness = 1.0
	ground.material_override = gm
	add_child(ground)
	var floor_body := StaticBody3D.new()
	var floor_shape := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = Vector3(WORLD * 2.4, 1, WORLD * 2.4)
	floor_shape.shape = box
	floor_shape.position.y = -0.5
	floor_body.add_child(floor_shape)
	add_child(floor_body)
	# invisible walls at the edge of the play area
	for side in [Vector3(1, 0, 0), Vector3(-1, 0, 0), Vector3(0, 0, 1), Vector3(0, 0, -1)]:
		var wall := StaticBody3D.new()
		var ws := CollisionShape3D.new()
		var wb := BoxShape3D.new()
		wb.size = Vector3(1 if side.x != 0 else WORLD * 2, 10, 1 if side.z != 0 else WORLD * 2)
		ws.shape = wb
		wall.position = side * WORLD + Vector3(0, 5, 0)
		wall.add_child(ws)
		add_child(wall)
	var models: Array = cfg.get("models", []).filter(func(p): return ResourceLoader.exists(p))
	for i in range(int(cfg.props)):
		var pos := Vector3(rng.randf_range(-WORLD, WORLD), 0, rng.randf_range(-WORLD, WORLD))
		if pos.length() < 7.0:
			continue
		var prop: Node3D
		var radius := 0.8
		if models.size() > 0:
			prop = (load(models[i % models.size()]) as PackedScene).instantiate()
			var s := rng.randf_range(0.9, 1.6)
			prop.scale = Vector3(s, s, s)
			radius = 0.6 * s
		else:
			prop = _primitive_prop(i)
		prop.position = pos
		prop.rotation.y = rng.randf() * TAU
		add_child(prop)
		var sb := StaticBody3D.new()
		var cs := CollisionShape3D.new()
		var cyl := CylinderShape3D.new()
		cyl.radius = radius
		cyl.height = 3.0
		cs.shape = cyl
		cs.position.y = 1.5
		sb.position = pos
		sb.add_child(cs)
		add_child(sb)

func _primitive_prop(i: int) -> Node3D:
	var root := Node3D.new()
	if i % 3 == 0:
		var rock := MeshInstance3D.new()
		var sm := SphereMesh.new()
		sm.radius = rng.randf_range(0.6, 1.3)
		sm.height = sm.radius * 1.3
		rock.mesh = sm
		rock.position.y = sm.radius * 0.4
		rock.material_override = _mat(cfg.palette.deco, 0.0, 0.9)
		root.add_child(rock)
	else:
		var trunk := MeshInstance3D.new()
		var cm := CylinderMesh.new()
		cm.top_radius = 0.18
		cm.bottom_radius = 0.26
		cm.height = 1.6
		trunk.mesh = cm
		trunk.position.y = 0.8
		trunk.material_override = _mat("#6b4a2e")
		root.add_child(trunk)
		for k in range(3):
			var crown := MeshInstance3D.new()
			var cone := CylinderMesh.new()
			cone.top_radius = 0.0
			cone.bottom_radius = 1.3 - k * 0.3
			cone.height = 1.5
			crown.mesh = cone
			crown.position.y = 1.9 + k * 0.7
			crown.material_override = _mat(cfg.palette.top)
			root.add_child(crown)
	return root

func _spawn_player() -> void:
	player = CharacterBody3D.new()
	var shape := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = 0.4
	cap.height = 1.8
	shape.shape = cap
	shape.position.y = 0.9
	player.add_child(shape)
	body_mesh = MeshInstance3D.new()
	var cm := CapsuleMesh.new()
	cm.radius = 0.4
	cm.height = 1.8
	body_mesh.mesh = cm
	body_mesh.position.y = 0.9
	body_mesh.material_override = _mat(cfg.palette.player, 0.15, 0.4)
	player.add_child(body_mesh)
	var visor := MeshInstance3D.new()
	var vm := BoxMesh.new()
	vm.size = Vector3(0.5, 0.18, 0.1)
	visor.mesh = vm
	visor.material_override = _mat(cfg.palette.accent, 2.0, 0.2)
	body_mesh.add_child(visor)
	visor.position = Vector3(0, 0.55, -0.38)
	add_child(player)
	cam = Camera3D.new()
	cam.fov = 62.0
	add_child(cam)
	cam.position = Vector3(0, 6, 10)
	cam.look_at(Vector3(0, 1, 0))

func _free_spot(min_dist: float) -> Vector3:
	for i in range(40):
		var p := Vector3(rng.randf_range(-WORLD + 3, WORLD - 3), 0, rng.randf_range(-WORLD + 3, WORLD - 3))
		if p.length() > min_dist:
			return p
	return Vector3(WORLD * 0.5, 0, 0)

func _spawn_orb() -> void:
	var orb := MeshInstance3D.new()
	var sm := SphereMesh.new()
	sm.radius = 0.35
	sm.height = 0.7
	orb.mesh = sm
	orb.material_override = _mat(cfg.palette.coin, 3.0, 0.2)
	orb.position = _free_spot(4.0) + Vector3(0, 1.0, 0)
	add_child(orb)
	orbs.append(orb)

func _spawn_foe(i: int) -> void:
	var foe := MeshInstance3D.new()
	var sm := SphereMesh.new()
	sm.radius = 0.6
	sm.height = 1.2
	foe.mesh = sm
	foe.material_override = _mat(cfg.palette.enemy, 1.5, 0.3)
	foe.position = _free_spot(22.0) + Vector3(0, 0.6, 0)
	foe.set_meta("speed", 2.4 + float(cfg.difficulty) * 0.8 + i * 0.15)
	add_child(foe)
	foes.append(foe)

func _build_hud() -> void:
	var layer := CanvasLayer.new()
	add_child(layer)
	hud = Label.new()
	hud.position = Vector2(24, 18)
	hud.add_theme_font_size_override("font_size", 28)
	hud.add_theme_color_override("font_outline_color", Color.BLACK)
	hud.add_theme_constant_override("outline_size", 8)
	layer.add_child(hud)
	banner = Label.new()
	banner.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	banner.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	banner.add_theme_font_size_override("font_size", 64)
	banner.add_theme_color_override("font_color", Color(cfg.palette.accent))
	banner.add_theme_color_override("font_outline_color", Color.BLACK)
	banner.add_theme_constant_override("outline_size", 14)
	banner.grow_horizontal = Control.GROW_DIRECTION_BOTH
	banner.grow_vertical = Control.GROW_DIRECTION_BOTH
	layer.add_child(banner)
	sub = Label.new()
	sub.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	sub.position.y += 70
	sub.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	sub.grow_horizontal = Control.GROW_DIRECTION_BOTH
	sub.add_theme_font_size_override("font_size", 24)
	sub.add_theme_color_override("font_outline_color", Color.BLACK)
	sub.add_theme_constant_override("outline_size", 8)
	layer.add_child(sub)
	banner.text = cfg.title
	sub.text = "%s\nWASD/pilar: gå · Mellanslag: hoppa · samla alla %d kulor" % [cfg.tagline, int(cfg.orbs)]

# ---------------------------------------------------------------- game loop
func _physics_process(delta: float) -> void:
	t += delta
	if state == "intro":
		intro_t += delta
		if intro_t > 2.5 or (intro_t > 0.4 and Input.is_action_just_pressed("jump")):
			state = "play"
			banner.text = ""
			sub.text = ""
	elif state != "play":
		if Input.is_action_just_pressed("restart") or Input.is_action_just_pressed("jump"):
			get_tree().reload_current_scene()
		return
	var v := player.velocity
	if not player.is_on_floor():
		v.y -= GRAVITY * delta
	elif state == "play" and Input.is_action_just_pressed("jump"):
		v.y = JUMP
	var inp := Input.get_vector("move_left", "move_right", "move_forward", "move_back") if state == "play" else Vector2.ZERO
	var dir := Vector3(inp.x, 0, inp.y)
	v.x = lerpf(v.x, dir.x * SPEED, clampf(delta * 10.0, 0, 1))
	v.z = lerpf(v.z, dir.z * SPEED, clampf(delta * 10.0, 0, 1))
	player.velocity = v
	player.move_and_slide()
	if dir.length() > 0.1:
		body_mesh.rotation.y = lerp_angle(body_mesh.rotation.y, atan2(-dir.x, -dir.z), clampf(delta * 12.0, 0, 1))
	var target := player.position + Vector3(0, 6.5, 10.5)
	cam.position = cam.position.lerp(target, clampf(delta * 4.0, 0, 1))
	cam.look_at(player.position + Vector3(0, 1.2, 0))
	if state != "play":
		return
	for orb in orbs:
		if orb.visible:
			orb.position.y = 1.0 + sin(t * 3.0 + orb.position.x) * 0.2
			orb.rotate_y(delta * 2.0)
			if orb.position.distance_to(player.position + Vector3(0, 1, 0)) < 1.3:
				orb.visible = false
				score += 1
	for foe in foes:
		var to := player.position - foe.position
		to.y = 0
		if to.length() < 30.0:
			foe.position += to.normalized() * float(foe.get_meta("speed")) * delta
		foe.position.y = 0.6 + absf(sin(t * 5.0 + foe.position.z)) * 0.3
		if to.length() < 1.1:
			_end(false, "En jägare fick tag i dig!")
	time_left -= delta
	if score >= orbs.size():
		_end(true, "Alla kulor samlade!")
	elif time_left <= 0.0:
		_end(false, "Tiden tog slut!")
	hud.text = "%s   Kulor %d/%d   Tid %d" % [cfg.title, score, orbs.size(), ceili(maxf(time_left, 0.0))]

func _end(won: bool, why: String) -> void:
	state = "won" if won else "lost"
	banner.text = "SEGER!" if won else "Game over"
	sub.text = why + "\nMellanslag eller R för att spela igen"
'''

PROJECT = """; Engine configuration file. Generated by Nexora.
config_version=5

[application]

config/name="__TITLE__"
config/description="__TAGLINE__"
run/main_scene="res://main.tscn"
config/features=PackedStringArray("4.7", "Forward Plus")

[display]

window/size/viewport_width=1280
window/size/viewport_height=720
window/stretch/mode="canvas_items"

[rendering]

anti_aliasing/quality/msaa_3d=2
anti_aliasing/quality/screen_space_aa=1
textures/vram_compression/import_etc2_astc=true
"""

SCENE = """[gd_scene load_steps=2 format=3]

[ext_resource type="Script" path="res://main.gd" id="1"]

[node name="Main" type="Node3D"]
script = ExtResource("1")
"""


def main(cfg=None):
    if cfg is None:
        cfg = json.load(open(sys.argv[1], encoding="utf-8"))
    d = int(cfg.get("difficulty", 1))
    cfg.setdefault("orbs", 10 + d * 2)
    cfg.setdefault("foes", 2 + d * 2)
    cfg.setdefault("time", 100 - d * 15)
    cfg.setdefault("props", 70 if cfg.get("hyperreal") else 55)
    cfg.setdefault("models", [])
    cfg.setdefault("hdri", "")
    cfg.setdefault("ground_maps", {})
    title = cfg.get("title", "Nexora-spel").replace('"', "")
    cfg_text = json.dumps(cfg, ensure_ascii=False).replace("\\", "\\\\").replace('"""', "")
    files = {
        "project.godot": PROJECT.replace("__TITLE__", title).replace("__TAGLINE__", cfg.get("tagline", "").replace('"', "")),
        "main.tscn": SCENE,
        "main.gd": MAIN_GD.replace("__CFG__", cfg_text).replace("__TITLE__", title),
        "README.md": "# %s\n\nSkapat med Nexora Astryx 5 Pro (Godot-läge).\n\nÖppna mappen i Godot 4.7 eller kör `godot --path .`.\n" % title,
    }
    for name, text in files.items():
        with open(name, "w", encoding="utf-8") as f:
            f.write(text)
    print("wrote", ", ".join(files), "| props", cfg["props"], "| models", len(cfg["models"]), "| hdri", bool(cfg["hdri"]))


if __name__ == "__main__":
    main()
