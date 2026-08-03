extends Node2D

## A keycard on the floor, gently bobbing so it reads as a pickup.

var _t := 0.0

func _ready() -> void:
	z_index = 2

func _process(delta: float) -> void:
	_t += delta
	queue_redraw()

func _draw() -> void:
	var bob := sin(_t * 3.0) * 3.0
	var glow := 0.35 + 0.15 * sin(_t * 3.0)
	draw_circle(Vector2(0, 6), 14.0, Color(0.2, 0.9, 1.0, glow * 0.4))
	var card := Rect2(-13, -9 + bob, 26, 18)
	draw_rect(card, Color(0.16, 0.72, 0.92))
	draw_rect(card, Color(0.75, 0.97, 1.0), false, 2.0)
	draw_rect(Rect2(-9, -5 + bob, 10, 6), Color(0.9, 0.98, 1.0, 0.9))
	draw_rect(Rect2(-9, 2 + bob, 16, 3), Color(0.05, 0.25, 0.35, 0.8))
