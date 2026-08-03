extends Node2D

## A barred security door. Redrawn once when `open` flips.

const TILE := 64.0

var open := false

func _ready() -> void:
	z_index = 1

func _draw() -> void:
	var half := TILE * 0.5
	if open:
		# Retracted into the frame.
		draw_rect(Rect2(-half, -half, TILE, TILE), Color(0.11, 0.13, 0.16))
		draw_rect(Rect2(-half, -half, 6, TILE), Color(0.35, 0.45, 0.35))
		draw_rect(Rect2(half - 6, -half, 6, TILE), Color(0.35, 0.45, 0.35))
		return
	draw_rect(Rect2(-half, -half, TILE, TILE), Color(0.30, 0.24, 0.14))
	for i in range(4):
		var x := -half + 8 + i * 15
		draw_rect(Rect2(x, -half + 4, 5, TILE - 8), Color(0.62, 0.55, 0.32))
	draw_rect(Rect2(-half, -6, TILE, 12), Color(0.52, 0.44, 0.24))
	draw_rect(Rect2(-half, -half, TILE, TILE), Color(0.08, 0.07, 0.05), false, 2.0)
