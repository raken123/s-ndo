extends Node
## Headless self-test. Boots the real main scene with the dummy renderer and
## drives the systems that are hard to eyeball without a headset: dog spawning,
## the kill -> Dog Food -> shop economy, skin equipping, and the Golden Dog
## unlock paths.
##
##   godot --headless --path . tools/smoke_test.tscn

var _checks := 0
var _failures: Array[String] = []
var _game = null


func _ready() -> void:
	# A watchdog so a hung await can never wedge CI.
	get_tree().create_timer(150.0).timeout.connect(func() -> void:
		printerr("smoke test timed out")
		get_tree().quit(2))
	_run()


func _check(label: String, condition: bool) -> void:
	_checks += 1
	if condition:
		print("  ok   %s" % label)
	else:
		_failures.append(label)
		print("  FAIL %s" % label)


func _frames(count: int) -> void:
	for i in range(count):
		await get_tree().process_frame


## Headless runs uncapped, so a frame is worth almost no game time. Anything
## that depends on elapsed seconds has to wait on a real timer.
func _wait(seconds: float) -> void:
	await get_tree().create_timer(seconds).timeout


func _run() -> void:
	print("\n=== Dog Blaster smoke test ===")

	# Start from a clean profile so the assertions are deterministic.
	if FileAccess.file_exists(SaveGame.SAVE_PATH):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(SaveGame.SAVE_PATH))
	SaveGame.food = 0
	SaveGame.owned = ["classic"]
	SaveGame.equipped = "classic"
	SaveGame.golden_unlocked = false

	print("\n[1] Skin catalogue and dog meshes")
	var skins := Skins.all()
	_check("catalogue has 14 skins", skins.size() == 14)
	_check("The Golden Dog exists and is the priciest",
		Skins.get_skin(Skins.GOLDEN_ID)["name"] == "The Golden Dog"
		and int(Skins.get_skin(Skins.GOLDEN_ID)["cost"]) == 25000)
	var meshes_ok := true
	for skin in skins:
		var mesh := DogFactory.get_mesh(skin["id"])
		if mesh == null or mesh.get_surface_count() != 4:
			meshes_ok = false
			print("       bad mesh for %s" % skin["id"])
	_check("every skin builds a 4-surface dog mesh", meshes_ok)
	_check("meshes are cached, not rebuilt",
		DogFactory.get_mesh("classic") == DogFactory.get_mesh("classic"))

	print("\n[2] Boot the main scene")
	# Wait a frame first: the tree is still adding this test node, and a parent
	# that is busy setting up children rejects add_child().
	await _frames(1)
	_game = load("res://scenes/main.tscn").instantiate()
	get_tree().root.add_child(_game)
	await _frames(5)
	_check("game booted in desktop fallback (no headset here)", _game.vr_mode == false)
	_check("player rig built", _find_child_of_type(_game, "") != null or _game.get_node_or_null("Origin") != null)
	_check("wrist HUD built", _find_child_of_type(_game, "WristHud") != null)
	_check("companion dog spawned", _find_child_of_type(_game, "Companion") != null)

	print("\n[3] Waves spawn dogs")
	_game.call("_begin_wave", 3)
	await _wait(4.0)
	var dog_root = _game.get_node("Dogs")
	_check("wave 3 spawned dogs", dog_root.get_child_count() > 0)
	print("       %d dogs alive" % dog_root.get_child_count())

	print("\n[4] Killing a dog pays out Dog Food")
	var before := SaveGame.food
	var killed := 0
	for dog in dog_root.get_children():
		if dog is Dog:
			(dog as Dog).take_damage(9999.0, dog.global_position + Vector3(0, 0.4, 0), false)
			killed += 1
	print("       killed %d dogs" % killed)
	await _wait(4.0)
	_check("kills were recorded", SaveGame.total_kills >= killed and killed > 0)
	_check("Dog Food went up after the kibble was collected", SaveGame.food > before)
	print("       food: %d -> %d" % [before, SaveGame.food])

	print("\n[5] Shop: buying and equipping a skin")
	var shop = _find_child_of_type(_game, "KibbleShop")
	_check("shop exists", shop != null)
	SaveGame.add_food(5000)
	var bought: bool = SaveGame.purchase("cyber")
	_check("bought Cyber Hound", bought and SaveGame.owns("cyber"))
	_check("equipping works", SaveGame.equip("cyber") and SaveGame.equipped == "cyber")
	_game.call("_on_loadout_changed")
	await _frames(3)
	_check("cannot buy a skin twice", not SaveGame.purchase("cyber"))
	var broke_food := SaveGame.food
	SaveGame.food = 10
	_check("cannot buy what you cannot afford", not SaveGame.purchase("void"))
	_check("failed purchase did not spend anything", SaveGame.food == 10)
	SaveGame.food = broke_food

	print("\n[6] The Golden Dog")
	_check("golden is locked to start with", not SaveGame.owns(Skins.GOLDEN_ID))
	_game.call("_unlock_golden", "smoke test")
	await _frames(3)
	_check("killing a Golden Dog grants the cosmetic", SaveGame.owns(Skins.GOLDEN_ID))
	_check("golden flag persisted on the profile", SaveGame.golden_unlocked)
	_check("golden is equippable", SaveGame.equip(Skins.GOLDEN_ID))
	_game.call("_on_loadout_changed")
	await _frames(3)
	_check("golden drop odds are ultra rare", Skins.GOLDEN_DROP_ONE_IN >= 500)

	print("\n[7] Blaster")
	var gun = _find_child_of_type(_game, "KibbleBlaster")
	_check("blaster exists", gun != null)
	if gun != null:
		var start_ammo: int = gun.ammo
		gun.call("fire")
		_check("firing consumes a round", gun.ammo == start_ammo - 1)
		gun.ammo = 0
		await _wait(0.4)
		gun.call("fire")
		_check("empty magazine triggers a reload", gun.reloading)

	print("\n[8] Player damage and downed state")
	_game.call("damage_player", 40.0, Vector3.ZERO)
	await _frames(2)
	_check("damage lands", _game._health < 100.0)
	_game.call("damage_player", 500.0, Vector3.ZERO)
	await _frames(2)
	_check("player goes down at zero health", _game._downed)
	_check("downing clears the pack", _game.get_node("Dogs").get_child_count() == 0)

	print("\n[9] Save round-trip")
	SaveGame.call("_flush")
	SaveGame.food = 0
	SaveGame.owned = ["classic"]
	SaveGame.equipped = "classic"
	SaveGame.load_profile()
	_check("profile reloads from disk", SaveGame.owns("cyber") and SaveGame.owns(Skins.GOLDEN_ID))
	_check("balance survived the round-trip", SaveGame.food > 0)

	print("\n=== %d checks, %d failed ===" % [_checks, _failures.size()])
	for failure in _failures:
		print("  FAILED: %s" % failure)
	get_tree().quit(0 if _failures.is_empty() else 1)


func _find_child_of_type(node: Node, class_name_hint: String) -> Node:
	if class_name_hint == "":
		return null
	for child in node.get_children():
		if child.get_script() != null:
			var script: Script = child.get_script()
			if script.get_global_name() == class_name_hint:
				return child
		var found := _find_child_of_type(child, class_name_hint)
		if found != null:
			return found
	return null
