extends Node
## Nexora test probe. Nexora copies this folder into a project as res://_nexora/
## and runs `godot --path <project> res://_nexora/probe.tscn`. The probe starts the
## project's main scene, plays it with simulated input, saves screenshots to
## $NEXORA_PROBE_OUT and quits. It never ships: exports exclude _nexora/*.

func _ready() -> void:
	var main_path: String = ProjectSettings.get_setting("application/run/main_scene", "")
	if main_path == "" or not ResourceLoader.exists(main_path):
		printerr("NEXORA_PROBE: main scene missing: '%s' (set application/run/main_scene in project.godot)" % main_path)
		get_tree().quit(2)
		return
	var scene := load(main_path) as PackedScene
	if scene == null:
		printerr("NEXORA_PROBE: main scene failed to load: " + main_path)
		get_tree().quit(2)
		return
	# The driver lives directly under the root, so it survives scene changes and reloads.
	var driver: Node = load("res://_nexora/probe_driver.gd").new()
	driver.name = "NexoraProbeDriver"
	get_tree().root.add_child.call_deferred(driver)
	get_tree().change_scene_to_packed.call_deferred(scene)
