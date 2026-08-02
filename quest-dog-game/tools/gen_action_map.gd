extends SceneTree
## Regenerates res://openxr_action_map.tres with Godot's default OpenXR
## bindings (trigger / grip / thumbsticks / A-B-X-Y / haptics) for every
## supported controller profile, including Meta Touch.
##
## Run from the project root:
##   godot --headless --script res://tools/gen_action_map.gd

func _init() -> void:
	var action_map := OpenXRActionMap.new()
	action_map.create_default_action_sets()
	var error := ResourceSaver.save(action_map, "res://openxr_action_map.tres")
	if error == OK:
		print("Wrote res://openxr_action_map.tres with %d action sets and %d profiles" % [
			action_map.get_action_set_count(), action_map.get_interaction_profile_count()])
	else:
		printerr("Failed to save the OpenXR action map: ", error)
	quit(0 if error == OK else 1)
