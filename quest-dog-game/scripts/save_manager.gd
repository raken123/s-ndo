extends Node
## Persistent player profile: Dog Food balance, owned skins, records (autoload: `SaveGame`).

signal food_changed(amount: int)
signal inventory_changed()

const SAVE_PATH := "user://dogblaster.save"

var food: int = 0
var owned: Array = ["classic"]
var equipped: String = "classic"
var best_wave: int = 0
var total_kills: int = 0
var golden_unlocked: bool = false

var _dirty := false


func _ready() -> void:
	load_profile()
	# Batch writes: flush at most a couple of times a second instead of on every kill.
	var timer := Timer.new()
	timer.wait_time = 2.0
	timer.autostart = true
	timer.timeout.connect(_flush)
	add_child(timer)


func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_CLOSE_REQUEST or what == NOTIFICATION_APPLICATION_PAUSED or what == NOTIFICATION_PREDELETE:
		_flush()


func load_profile() -> void:
	if not FileAccess.file_exists(SAVE_PATH):
		return
	var file := FileAccess.open(SAVE_PATH, FileAccess.READ)
	if file == null:
		return
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	file.close()
	if typeof(parsed) != TYPE_DICTIONARY:
		return
	food = int(parsed.get("food", 0))
	owned = parsed.get("owned", ["classic"])
	if not owned.has("classic"):
		owned.append("classic")
	equipped = String(parsed.get("equipped", "classic"))
	best_wave = int(parsed.get("best_wave", 0))
	total_kills = int(parsed.get("total_kills", 0))
	golden_unlocked = bool(parsed.get("golden_unlocked", false))
	if not owned.has(equipped):
		equipped = "classic"


func _flush() -> void:
	if not _dirty:
		return
	_dirty = false
	var file := FileAccess.open(SAVE_PATH, FileAccess.WRITE)
	if file == null:
		return
	file.store_string(JSON.stringify({
		"food": food,
		"owned": owned,
		"equipped": equipped,
		"best_wave": best_wave,
		"total_kills": total_kills,
		"golden_unlocked": golden_unlocked,
	}))
	file.close()


func add_food(amount: int) -> void:
	food = max(0, food + amount)
	_dirty = true
	food_changed.emit(food)


func can_afford(amount: int) -> bool:
	return food >= amount


## Returns true when the purchase went through.
func purchase(skin_id: String) -> bool:
	var skin: Dictionary = Skins.get_skin(skin_id)
	if owns(skin_id) or not can_afford(int(skin["cost"])):
		return false
	add_food(-int(skin["cost"]))
	grant(skin_id)
	return true


func grant(skin_id: String) -> void:
	if owned.has(skin_id):
		return
	owned.append(skin_id)
	if skin_id == Skins.GOLDEN_ID:
		golden_unlocked = true
	_dirty = true
	inventory_changed.emit()


func owns(skin_id: String) -> bool:
	return owned.has(skin_id)


func equip(skin_id: String) -> bool:
	if not owns(skin_id):
		return false
	equipped = skin_id
	_dirty = true
	inventory_changed.emit()
	return true


func record_kill(wave: int) -> void:
	total_kills += 1
	best_wave = max(best_wave, wave)
	_dirty = true
