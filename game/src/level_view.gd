extends Node2D

## Draws the static level: floor, walls and shadow patches. The grid never
## changes after the level is built, so this draws once and stays cached.

const TILE := 64.0

var grid: PackedStringArray = PackedStringArray()

# Floor stays flat and dark so the walls read as solid structure at a glance.
const FLOOR_A := Color(0.106, 0.121, 0.153)
const FLOOR_B := Color(0.121, 0.137, 0.172)
const WALL_FACE := Color(0.455, 0.486, 0.553)
const WALL_TOP := Color(0.580, 0.616, 0.686)
const WALL_LINE := Color(0.075, 0.086, 0.110)
const SHADOW_TINT := Color(0.0, 0.015, 0.05, 0.62)

func _ready() -> void:
	z_index = -10

func _draw() -> void:
	if grid.is_empty():
		return
	var rows := grid.size()
	var cols := grid[0].length()

	for y in rows:
		for x in cols:
			var c: String = grid[y][x]
			var pos := Vector2(x, y) * TILE
			var rect := Rect2(pos, Vector2(TILE, TILE))
			if c == "#":
				draw_rect(rect, WALL_FACE)
				draw_rect(Rect2(pos, Vector2(TILE, TILE * 0.22)), WALL_TOP)
				draw_rect(rect, WALL_LINE, false, 1.0)
			else:
				draw_rect(rect, FLOOR_B if (x + y) % 2 == 0 else FLOOR_A)
				if c == "~":
					draw_rect(rect, SHADOW_TINT)

	# Grated floor lines for a bit of texture.
	for y in range(1, rows):
		draw_line(Vector2(0, y * TILE), Vector2(cols * TILE, y * TILE),
			Color(0, 0, 0, 0.10), 1.0)
