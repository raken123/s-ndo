class_name KibbleShop extends Node3D
## The Kibble Shop: a floating panel you point at with the blaster's laser to
## buy and equip skins for your own dog. Everything costs Dog Food.

signal loadout_changed()

const PANEL_WIDTH := 1.9
const PANEL_HEIGHT := 1.45
const COLS := 5
const CELL_W := 0.34
const CELL_H := 0.30
const STEP_X := 0.36
const STEP_Y := 0.36
const UI_LAYER := 8

var is_open := false

var _cells: Array[Dictionary] = []
var _title: Label3D
var _food_label: Label3D
var _status: Label3D
var _preview_holder: Node3D
var _preview_skin := ""
var _hovered: Dictionary = {}
var _close_cell: Dictionary = {}
var _status_timer := 0.0


func _ready() -> void:
	scale = Vector3.ONE * 0.88
	visible = false
	_build_panel()
	_build_cells()
	_build_preview()
	_set_colliders_enabled(false)
	SaveGame.food_changed.connect(func(_v: int) -> void: refresh())
	refresh()


# -------------------------------------------------------------------- build

func _build_panel() -> void:
	_quad(Vector3(0, 0, -0.01), Vector2(PANEL_WIDTH, PANEL_HEIGHT), Color(0.05, 0.07, 0.11), self)
	_quad(Vector3(0, 0, -0.012), Vector2(PANEL_WIDTH + 0.03, PANEL_HEIGHT + 0.03), Color(0.26, 0.6, 0.85), self)

	_title = _label("KIBBLE SHOP", Vector3(-0.46, PANEL_HEIGHT * 0.5 - 0.11, 0.01), 54, Color("9ef7ff"))
	_food_label = _label("", Vector3(0.50, PANEL_HEIGHT * 0.5 - 0.11, 0.01), 54, Color("ffd447"))
	_status = _label("Point with your blaster and pull the trigger to buy.",
		Vector3(0, -PANEL_HEIGHT * 0.5 + 0.18, 0.01), 30, Color("cfd6dd"))


func _build_cells() -> void:
	var skins := Skins.all()
	for index in range(skins.size()):
		var skin: Dictionary = skins[index]
		var col: int = index % COLS
		var row: int = floori(float(index) / float(COLS))
		var origin := Vector3(
			(col - (COLS - 1) * 0.5) * STEP_X,
			PANEL_HEIGHT * 0.5 - 0.34 - row * STEP_Y,
			0.012)
		_cells.append(_build_cell(skin, origin))

	_close_cell = _build_button("CLOSE", Vector3(0, -PANEL_HEIGHT * 0.5 + 0.075, 0.012),
		Vector2(0.44, 0.12), Color("6b2230"))


func _build_cell(skin: Dictionary, origin: Vector3) -> Dictionary:
	var holder := Node3D.new()
	holder.position = origin
	add_child(holder)

	var background := _quad(Vector3.ZERO, Vector2(CELL_W, CELL_H), Color(0.12, 0.15, 0.2), holder)

	# Colour swatch: two stacked bars showing the skin's primary/secondary coats.
	var swatch := _quad(Vector3(-CELL_W * 0.5 + 0.055, 0.045, 0.004), Vector2(0.075, 0.075), skin["primary"], holder)
	var swatch2 := _quad(Vector3(-CELL_W * 0.5 + 0.055, -0.03, 0.004), Vector2(0.075, 0.05), skin["secondary"], holder)

	var name_label := _label(skin["name"], Vector3(0.045, 0.084, 0.006), 34, Color.WHITE, holder)
	var rarity_label := _label(skin["rarity"], Vector3(0.045, 0.030, 0.006), 26,
		Skins.rarity_color(skin["rarity"]), holder)
	var state_label := _label("", Vector3(0.045, -0.044, 0.006), 32, Color("ffd447"), holder)

	var area := Area3D.new()
	area.collision_layer = UI_LAYER
	area.collision_mask = 0
	area.monitorable = false
	area.monitoring = false
	var shape := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = Vector3(CELL_W, CELL_H, 0.03)
	shape.shape = box
	area.add_child(shape)
	holder.add_child(area)

	return {
		"kind": "skin",
		"skin": skin,
		"holder": holder,
		"area": area,
		"background": background,
		"name_label": name_label,
		"rarity_label": rarity_label,
		"state_label": state_label,
		"swatch": swatch,
		"swatch2": swatch2,
	}


func _build_button(text: String, origin: Vector3, size: Vector2, color: Color) -> Dictionary:
	var holder := Node3D.new()
	holder.position = origin
	add_child(holder)
	var background := _quad(Vector3.ZERO, size, color, holder)
	_label(text, Vector3(0, 0.0, 0.006), 38, Color.WHITE, holder)

	var area := Area3D.new()
	area.collision_layer = UI_LAYER
	area.collision_mask = 0
	area.monitorable = false
	area.monitoring = false
	var shape := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = Vector3(size.x, size.y, 0.03)
	shape.shape = box
	area.add_child(shape)
	holder.add_child(area)

	return {"kind": "close", "holder": holder, "area": area, "background": background, "base_color": color}


func _build_preview() -> void:
	_preview_holder = Node3D.new()
	_preview_holder.position = Vector3(PANEL_WIDTH * 0.5 + 0.34, -PANEL_HEIGHT * 0.5 + 0.30, 0.1)
	_preview_holder.scale = Vector3.ONE * 0.62
	add_child(_preview_holder)

	var light := OmniLight3D.new()
	light.position = Vector3(0.4, 1.2, 1.0)
	light.light_energy = 2.2
	light.omni_range = 5.0
	light.shadow_enabled = false
	_preview_holder.add_child(light)

	_label("YOUR DOG", Vector3(PANEL_WIDTH * 0.5 + 0.34, -PANEL_HEIGHT * 0.5 + 0.98, 0.1), 36, Color("9ef7ff"))


## Panels are deliberately opaque. Alpha-blended quads are sorted by their
## distance to the camera, which drew the big backdrop on top of the cells
## nearest the panel's edges; opaque geometry just uses the depth buffer.
func _quad(position: Vector3, size: Vector2, color: Color, parent: Node) -> MeshInstance3D:
	var mesh := QuadMesh.new()
	mesh.size = size
	var instance := MeshInstance3D.new()
	instance.mesh = mesh
	var mat := StandardMaterial3D.new()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.albedo_color = Color(color.r, color.g, color.b, 1.0)
	mat.transparency = BaseMaterial3D.TRANSPARENCY_DISABLED
	mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	instance.material_override = mat
	instance.position = position
	instance.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	parent.add_child(instance)
	return instance


func _label(text: String, position: Vector3, font_size: int, color: Color, parent: Node = null) -> Label3D:
	var label := Label3D.new()
	label.text = text
	label.font_size = font_size
	label.pixel_size = 0.0009
	label.modulate = color
	label.outline_size = 10
	label.outline_modulate = Color(0, 0, 0, 0.85)
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	label.position = position
	label.shaded = false
	label.double_sided = false
	label.render_priority = 4
	label.outline_render_priority = 3
	if parent == null:
		parent = self
	parent.add_child(label)
	return label


# ------------------------------------------------------------------ lifecycle

func open(camera: Camera3D) -> void:
	is_open = true
	visible = true
	_set_colliders_enabled(true)
	var forward := -camera.global_transform.basis.z
	forward.y = 0.0
	if forward.length() < 0.01:
		forward = Vector3.FORWARD
	forward = forward.normalized()
	global_position = camera.global_position + forward * 1.55 + Vector3(0, -0.22, 0)
	look_at(camera.global_position, Vector3.UP)
	rotate_y(PI)
	refresh()
	_set_preview(SaveGame.equipped)
	Sfx.play("click", global_position, -6.0)


func close() -> void:
	is_open = false
	visible = false
	_set_colliders_enabled(false)
	_hovered = {}
	Sfx.play("click", global_position, -10.0, 0.7)


## A hidden panel must not block the blaster's laser, so its areas are
## switched off entirely while the shop is closed.
func _set_colliders_enabled(enabled: bool) -> void:
	var layer := UI_LAYER if enabled else 0
	for cell in _cells:
		(cell["area"] as Area3D).collision_layer = layer
	if not _close_cell.is_empty():
		(_close_cell["area"] as Area3D).collision_layer = layer


func toggle(camera: Camera3D) -> void:
	if is_open:
		close()
	else:
		open(camera)


func refresh() -> void:
	if _food_label == null:
		return
	_food_label.text = "%s DOG FOOD" % _format_number(SaveGame.food)
	for cell in _cells:
		_refresh_cell(cell)


func _refresh_cell(cell: Dictionary) -> void:
	var skin: Dictionary = cell["skin"]
	var id: String = skin["id"]
	var owned: bool = SaveGame.owns(id)
	var equipped: bool = SaveGame.equipped == id
	var material: StandardMaterial3D = (cell["background"] as MeshInstance3D).material_override

	if equipped:
		cell["state_label"].text = "EQUIPPED"
		cell["state_label"].modulate = Color("7dff9b")
		material.albedo_color = Color(0.10, 0.28, 0.16)
	elif owned:
		cell["state_label"].text = "TAP TO WEAR"
		cell["state_label"].modulate = Color("9ef7ff")
		material.albedo_color = Color(0.10, 0.18, 0.26)
	else:
		cell["state_label"].text = "%s FOOD" % _format_number(int(skin["cost"]))
		var affordable: bool = SaveGame.can_afford(int(skin["cost"]))
		cell["state_label"].modulate = Color("ffd447") if affordable else Color("8a6a6a")
		material.albedo_color = Color(0.12, 0.15, 0.2) if affordable else Color(0.09, 0.09, 0.11)

	if id == Skins.GOLDEN_ID and not owned:
		cell["rarity_label"].text = "MYTHIC - 1 in %d" % Skins.GOLDEN_DROP_ONE_IN


func _set_preview(skin_id: String) -> void:
	if skin_id == _preview_skin:
		return
	_preview_skin = skin_id
	for child in _preview_holder.get_children():
		if child is Node3D and not (child is OmniLight3D):
			child.queue_free()
	var model := DogFactory.build_model(skin_id, 1.0)
	model.rotation_degrees = Vector3(0, 210, 0)
	_preview_holder.add_child(model)


func _process(delta: float) -> void:
	if not is_open:
		return
	_preview_holder.rotate_y(delta * 0.55)
	if _status_timer > 0.0:
		_status_timer -= delta
		if _status_timer <= 0.0:
			_status.text = "Point with your blaster and pull the trigger to buy."
			_status.modulate = Color("cfd6dd")


## Called every frame by the game while the shop is open.
func update_pointer(from: Vector3, direction: Vector3, clicked: bool) -> void:
	var space := get_world_3d().direct_space_state
	if space == null:
		return
	var query := PhysicsRayQueryParameters3D.create(from, from + direction * 12.0)
	query.collision_mask = UI_LAYER
	query.collide_with_areas = true
	query.collide_with_bodies = false
	var hit := space.intersect_ray(query)

	var target: Dictionary = {}
	if hit.has("collider"):
		var area: Object = hit["collider"]
		for cell in _cells:
			if cell["area"] == area:
				target = cell
				break
		if target.is_empty() and _close_cell["area"] == area:
			target = _close_cell

	if target.get("area") != _hovered.get("area"):
		_apply_hover(_hovered, false)
		_apply_hover(target, true)
		_hovered = target
		if not target.is_empty():
			Sfx.play("click", global_position, -22.0, 1.6)
			if target["kind"] == "skin":
				_set_preview(target["skin"]["id"])
			else:
				_set_preview(SaveGame.equipped)

	if clicked and not _hovered.is_empty():
		_activate(_hovered)


func _apply_hover(cell: Dictionary, hovered: bool) -> void:
	if cell.is_empty():
		return
	var holder: Node3D = cell["holder"]
	holder.scale = Vector3.ONE * (1.06 if hovered else 1.0)
	holder.position.z = 0.012 + (0.02 if hovered else 0.0)
	if cell["kind"] == "close":
		var material: StandardMaterial3D = (cell["background"] as MeshInstance3D).material_override
		material.albedo_color = Color("b03a4e") if hovered else cell["base_color"]


func _activate(cell: Dictionary) -> void:
	if cell["kind"] == "close":
		close()
		return

	var skin: Dictionary = cell["skin"]
	var id: String = skin["id"]

	if SaveGame.owns(id):
		if SaveGame.equipped == id:
			_flash_status("%s is already on your pup." % skin["name"], Color("cfd6dd"))
		else:
			SaveGame.equip(id)
			_flash_status("%s equipped!" % skin["name"], Color("7dff9b"))
			Sfx.play("buy", global_position, -2.0, 1.2)
			loadout_changed.emit()
	elif SaveGame.purchase(id):
		SaveGame.equip(id)
		_flash_status("Bought %s!" % skin["name"], Color("ffd447"))
		Sfx.play("golden" if id == Skins.GOLDEN_ID else "buy", global_position, 0.0)
		loadout_changed.emit()
	else:
		var missing: int = int(skin["cost"]) - SaveGame.food
		_flash_status("Need %s more Dog Food." % _format_number(missing), Color("ff8a8a"))
		Sfx.play("empty", global_position, -6.0)

	refresh()
	_set_preview(SaveGame.equipped if not SaveGame.owns(id) else id)


func _flash_status(text: String, color: Color) -> void:
	_status.text = text
	_status.modulate = color
	_status_timer = 2.5


func _format_number(value: int) -> String:
	var text := str(absi(value))
	var out := ""
	var count := 0
	for i in range(text.length() - 1, -1, -1):
		out = text[i] + out
		count += 1
		if count % 3 == 0 and i > 0:
			out = "," + out
	return ("-" if value < 0 else "") + out
