extends CanvasLayer

## Status bar, overlays and the on-screen controls.
##
## Touch handling: the left ~55% of the screen is a floating joystick that
## appears wherever the thumb lands; the sneak pad sits bottom-right. Mouse
## input arrives here as touch too (emulate_touch_from_mouse), so there is only
## one code path for desktop and phone.

const JOY_RADIUS := 110.0
const PAD_SIZE := Vector2(168, 104)
const PAD_MARGIN := Vector2(30, 26)

var _root: Control
var _status: Label
var _flash: Label
var _flash_time := 0.0
var _alarm_bar: Control
var _overlay: Control
var _title: Label
var _subtitle: Label
var _controls: Control

var _joy_touch := -1
var _joy_origin := Vector2.ZERO
var _joy_pos := Vector2.ZERO
var _joy_active := false
var _sneak := false
var _tapped := false
var _alarm := 0.0

func _ready() -> void:
	layer = 10
	_root = Control.new()
	_root.set_anchors_preset(Control.PRESET_FULL_RECT)
	_root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_root)

	var bar_bg := ColorRect.new()
	bar_bg.set_anchors_preset(Control.PRESET_TOP_WIDE)
	bar_bg.offset_bottom = 58
	bar_bg.color = Color(0.02, 0.03, 0.05, 0.72)
	bar_bg.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_root.add_child(bar_bg)

	_status = _make_label(26, Color(0.85, 0.89, 0.96))
	_status.position = Vector2(24, 13)
	_root.add_child(_status)

	_alarm_bar = Control.new()
	_alarm_bar.set_anchors_preset(Control.PRESET_FULL_RECT)
	_alarm_bar.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_alarm_bar.draw.connect(_draw_alarm)
	_root.add_child(_alarm_bar)

	_flash = _make_label(30, Color(0.35, 0.92, 1.0))
	_flash.set_anchors_preset(Control.PRESET_TOP_WIDE)
	_flash.offset_top = 96
	_flash.offset_bottom = 140
	_flash.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_flash.modulate.a = 0.0
	_root.add_child(_flash)

	_controls = Control.new()
	_controls.set_anchors_preset(Control.PRESET_FULL_RECT)
	_controls.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_controls.draw.connect(_draw_controls)
	_root.add_child(_controls)

	_build_overlay()

func _make_label(size: int, color: Color) -> Label:
	var label := Label.new()
	label.add_theme_font_size_override("font_size", size)
	label.add_theme_color_override("font_color", color)
	label.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.85))
	label.add_theme_constant_override("shadow_offset_x", 2)
	label.add_theme_constant_override("shadow_offset_y", 2)
	label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return label

func _build_overlay() -> void:
	_overlay = Control.new()
	_overlay.set_anchors_preset(Control.PRESET_FULL_RECT)
	_overlay.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_root.add_child(_overlay)

	var dim := ColorRect.new()
	dim.set_anchors_preset(Control.PRESET_FULL_RECT)
	dim.color = Color(0.02, 0.03, 0.05, 0.78)
	dim.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_overlay.add_child(dim)

	var box := VBoxContainer.new()
	box.set_anchors_preset(Control.PRESET_FULL_RECT)
	box.alignment = BoxContainer.ALIGNMENT_CENTER
	box.add_theme_constant_override("separation", 18)
	box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_overlay.add_child(box)

	_title = _make_label(72, Color(0.95, 0.97, 1.0))
	_title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	box.add_child(_title)

	_subtitle = _make_label(30, Color(0.72, 0.78, 0.88))
	_subtitle.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	box.add_child(_subtitle)

	_overlay.visible = false

func _process(delta: float) -> void:
	if _flash_time > 0.0:
		_flash_time -= delta
		_flash.modulate.a = clampf(_flash_time * 2.0, 0.0, 1.0)
	_controls.queue_redraw()
	_alarm_bar.queue_redraw()

# ------------------------------------------------------------------- input

func _input(event: InputEvent) -> void:
	var screen_w := get_viewport().get_visible_rect().size.x
	if event is InputEventScreenTouch:
		if event.pressed:
			_tapped = true
			if event.position.x < screen_w * 0.55 and _joy_touch == -1:
				_joy_touch = event.index
				_joy_origin = event.position
				_joy_pos = event.position
				_joy_active = true
			elif _sneak_rect().has_point(event.position):
				_sneak = not _sneak
		elif event.index == _joy_touch:
			_joy_touch = -1
			_joy_active = false
	elif event is InputEventScreenDrag and event.index == _joy_touch:
		_joy_pos = event.position

func joystick_vector() -> Vector2:
	if not _joy_active:
		return Vector2.ZERO
	var delta := _joy_pos - _joy_origin
	if delta.length() < 12.0:
		return Vector2.ZERO
	return delta / JOY_RADIUS if delta.length() < JOY_RADIUS else delta.normalized()

func sneak_held() -> bool:
	return _sneak

## True once per tap — used to dismiss result overlays.
func take_tap() -> bool:
	var t := _tapped
	_tapped = false
	return t

func _sneak_rect() -> Rect2:
	var vp := get_viewport().get_visible_rect().size
	return Rect2(vp - PAD_SIZE - PAD_MARGIN, PAD_SIZE)

# ------------------------------------------------------------------ display

func update_status(cards: int, total: int, alarm: float, sneaking: bool, level_name: String) -> void:
	_alarm = alarm
	var mode := "SNEAKING" if sneaking else "WALKING"
	_status.text = "%s   ·   KEYCARDS %d/%d   ·   %s" % [level_name.to_upper(), cards, total, mode]

func flash(text: String) -> void:
	_flash.text = text
	_flash_time = 1.6

func show_briefing(name: String, hint: String, index: int, total: int) -> void:
	_title.text = "BLOCK %d/%d — %s" % [index, total, name.to_upper()]
	_subtitle.text = hint
	_title.add_theme_color_override("font_color", Color(0.95, 0.97, 1.0))
	_overlay.visible = true
	_tapped = false

func show_result(title: String, subtitle: String, color: Color) -> void:
	_title.text = title
	_subtitle.text = subtitle
	_title.add_theme_color_override("font_color", color)
	_overlay.visible = true
	_tapped = false

func hide_overlay() -> void:
	_overlay.visible = false

# ------------------------------------------------------------------ drawing

func _draw_alarm() -> void:
	if _overlay.visible:
		return
	var vp := get_viewport().get_visible_rect().size
	var w := 320.0
	var bar := Rect2(vp.x - w - 24.0, 20.0, w, 18.0)
	_alarm_bar.draw_rect(bar, Color(0.10, 0.12, 0.16, 0.9))
	var col := Color(0.45, 0.9, 0.55).lerp(Color(1.0, 0.25, 0.25), _alarm)
	_alarm_bar.draw_rect(Rect2(bar.position, Vector2(bar.size.x * _alarm, bar.size.y)), col)
	_alarm_bar.draw_rect(bar, Color(0.6, 0.66, 0.76, 0.8), false, 2.0)

func _draw_controls() -> void:
	if _overlay.visible:
		return
	# Floating joystick.
	if _joy_active:
		_controls.draw_circle(_joy_origin, JOY_RADIUS, Color(1, 1, 1, 0.07))
		_controls.draw_arc(_joy_origin, JOY_RADIUS, 0, TAU, 40, Color(1, 1, 1, 0.22), 2.0)
		var knob := _joy_pos - _joy_origin
		if knob.length() > JOY_RADIUS:
			knob = knob.normalized() * JOY_RADIUS
		_controls.draw_circle(_joy_origin + knob, 34.0, Color(0.95, 0.6, 0.25, 0.55))
		_controls.draw_arc(_joy_origin + knob, 34.0, 0, TAU, 24, Color(1, 1, 1, 0.5), 2.0)

	# Sneak pad.
	var pad := _sneak_rect()
	var fill := Color(0.25, 0.75, 0.95, 0.30) if _sneak else Color(1, 1, 1, 0.08)
	_controls.draw_rect(pad, fill)
	_controls.draw_rect(pad, Color(1, 1, 1, 0.28), false, 2.0)
	var font := ThemeDB.fallback_font
	_controls.draw_string(font, pad.position + Vector2(0, pad.size.y * 0.62),
		"SNEAK", HORIZONTAL_ALIGNMENT_CENTER, pad.size.x, 34,
		Color(0.9, 0.97, 1.0) if _sneak else Color(0.75, 0.8, 0.88))
