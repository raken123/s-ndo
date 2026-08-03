class_name Levels
extends RefCounted

## Level definitions.
##
## Each level is a rectangular grid of characters plus a patrol route per guard.
## Grid legend:
##   #  wall              .  floor
##   P  player start      E  exit (needs every keycard on the level)
##   K  keycard           D  locked door (opens once you hold a keycard)
##   ~  shadow patch (guards only spot you at half range while you stand in it)
##
## Patrol waypoints are [column, row] grid coordinates. Guards walk between them
## with A* pathfinding, so a waypoint only has to be reachable, not in a
## straight unobstructed line from the previous one.

const TILE := 64.0

const DATA := [
	{
		"name": "B-Block Cells",
		"hint": "Grab the keycard, slip past the patrol, reach the gate.",
		"grid": [
			"########################",
			"#P.....#........#~~~~~~#",
			"#......#........#~~~~~~#",
			"#......#........#......#",
			"###.####........####.###",
			"#......................#",
			"#~~~...................#",
			"###.########D###########",
			"#......#............#..#",
			"#..K...#............#..#",
			"#......#..............E#",
			"#......#....~~~~....#..#",
			"#......#....~~~~....#..#",
			"########################",
		],
		"guards": [
			[[16, 5], [3, 5]],
			[[12, 10], [18, 10], [18, 12], [12, 12]],
		],
	},
	{
		"name": "The Yard",
		"hint": "Two keycards, three patrols. Use the dark patches.",
		"grid": [
			"##########################",
			"#P...#..........#........#",
			"#....#...~~~~...#...K....#",
			"#....D...~~~~...#........#",
			"#....#..........D........#",
			"####.#####..#####...######",
			"#........................#",
			"#..~~~..........#........#",
			"#..~~~..........#...#....#",
			"####..##.########...#....#",
			"#......#........#...#....#",
			"#..K...#...~~~..#........#",
			"#......#...~~~..#.......E#",
			"##########################",
		],
		"guards": [
			[[19, 1], [19, 8], [12, 8]],
			[[5, 6], [22, 6]],
			[[8, 11], [8, 7], [2, 7]],
		],
	},
	{
		"name": "Perimeter Wall",
		"hint": "Last stretch. Four of them, and nowhere quiet to stand.",
		"grid": [
			"##########################",
			"#P.......#...............#",
			"#........#....########...#",
			"#..####..#....#......#...#",
			"#..#..#..D....#..K...#...#",
			"#..#..#..#....#......#...#",
			"#..#..#..#....####.###...#",
			"#..#..####...............#",
			"#..#.........#.##.####...#",
			"#..###########..#....#...#",
			"#...~~~....D....#....#...#",
			"#...~~~....#....#....#...#",
			"#.......K..#....#....#..E#",
			"##########################",
		],
		"guards": [
			[[23, 1], [23, 12], [12, 12]],
			[[11, 7], [23, 7]],
			[[9, 12], [2, 12], [2, 4]],
			[[15, 3], [19, 3], [19, 5], [15, 5]],
		],
	},
]
