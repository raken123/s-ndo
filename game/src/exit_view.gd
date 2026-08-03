extends Node2D

## The perimeter gate. Pulses so it's readable as the goal from across the map.

const TILE := 64.0

var _t := 0.0

func _ready() -> void:
	z_index = 1

func _process(delta: float) -> void:
	_t += delta
	queue_redraw()

func _draw() -> void:
	var half := TILE * 0.5
	var pulse := 0.5 + 0.5 * sin(_t * 2.4)
	draw_rect(Rect2(-half, -half, TILE, TILE),
		Color(0.16, 0.62, 0.34, 0.30 + 0.25 * pulse))
	draw_rect(Rect2(-half + 3, -half + 3, TILE - 6, TILE - 6),
		Color(0.45, 1.0, 0.62, 0.5 + 0.4 * pulse), false, 3.0)
	# Upward chevrons: "out this way".
	for i in range(2):
		var y := 8.0 - i * 14.0 + sin(_t * 2.4 + i) * 2.0
		var col := Color(0.6, 1.0, 0.72, 0.85)
		draw_line(Vector2(-12, y), Vector2(0, y - 11), col, 3.0)
		draw_line(Vector2(0, y - 11), Vector2(12, y), col, 3.0)
