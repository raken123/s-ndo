extends Node
## Catalogue of every dog skin in the game (autoload: `Skins`).
##
## A skin is pure data. `DogFactory` turns it into a merged mesh + materials,
## the shop turns it into a purchasable cell, and the companion dog wears it.

const GOLDEN_ID := "golden"

## Ultra rare drop odds for The Golden Dog from an ordinary kill.
const GOLDEN_DROP_ONE_IN := 1000
## Odds that any given spawn is a live Golden Dog (killing one grants the skin).
const GOLDEN_SPAWN_CHANCE := 0.012

var _list: Array[Dictionary] = []
var _by_id: Dictionary = {}


func _init() -> void:
	_define("classic", "Classic Brown", 0, "COMMON", "8a5a2b", "e8d3ae")
	_define("snow", "Snow White", 150, "COMMON", "eceae2", "cfc7b4")
	_define("ash", "Ash Grey", 200, "COMMON", "7c8288", "d2d6d9")
	_define("midnight", "Midnight", 300, "COMMON", "2b2f3a", "6d7386")
	_define("cocoa", "Chocolate", 400, "UNCOMMON", "4a2c18", "9a6a3c")
	_define("ginger", "Ginger Snap", 550, "UNCOMMON", "c8631f", "f2c48b")
	_define("husky", "Frost Husky", 800, "UNCOMMON", "44536b", "f0f4f8")
	_define("dalmatian", "Dalmatian", 1100, "RARE", "f1efe8", "2a2a2a", {"spots": true, "spot_color": "1c1c1c"})
	_define("mint", "Bubblegum", 1400, "RARE", "ff8fc4", "fff0f6")
	_define("toxic", "Toxic Pup", 1900, "RARE", "3fa832", "d7ff8a", {"emission": "63ff3a", "energy": 1.1})
	_define("cyber", "Cyber Hound", 2600, "EPIC", "17283d", "17e8ff", {"emission": "18d7ff", "energy": 1.8, "metallic": 0.7, "roughness": 0.25})
	_define("lava", "Lava Beast", 3400, "EPIC", "2a0d09", "ff5a1e", {"emission": "ff6a10", "energy": 2.4, "roughness": 0.55})
	_define("void", "Void Walker", 5000, "LEGENDARY", "120c1f", "8b3dff", {"emission": "7a1bff", "energy": 2.0, "metallic": 0.4, "roughness": 0.3})
	_define(GOLDEN_ID, "The Golden Dog", 25000, "MYTHIC", "ffcf3d", "fff3b0", {
		"emission": "ffb400", "energy": 1.5, "metallic": 1.0, "roughness": 0.12,
		"golden": true, "crown": true,
	})


func _define(id: String, name: String, cost: int, rarity: String, primary: String, secondary: String, extra: Dictionary = {}) -> void:
	var skin := {
		"id": id,
		"name": name,
		"cost": cost,
		"rarity": rarity,
		"primary": Color(primary),
		"secondary": Color(secondary),
		"metallic": 0.0,
		"roughness": 0.85,
		"emission": Color(0, 0, 0),
		"energy": 0.0,
		"spots": false,
		"spot_color": Color(0, 0, 0),
		"golden": false,
		"crown": false,
	}
	for key in extra:
		var value: Variant = extra[key]
		if key in ["emission", "spot_color"]:
			skin[key] = Color(value)
		else:
			skin[key] = value
	_list.append(skin)
	_by_id[id] = skin


## Every skin, cheapest first (the order the shop lays them out in).
func all() -> Array[Dictionary]:
	return _list


func get_skin(id: String) -> Dictionary:
	return _by_id.get(id, _by_id["classic"])


func rarity_color(rarity: String) -> Color:
	match rarity:
		"UNCOMMON": return Color("6ddf6d")
		"RARE": return Color("4aa8ff")
		"EPIC": return Color("c46bff")
		"LEGENDARY": return Color("ff8a3d")
		"MYTHIC": return Color("ffd23d")
		_: return Color("cfd6dd")
