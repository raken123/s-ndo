extends Node
## Procedurally synthesised sound effects (autoload: `Sfx`).
##
## Every sound is generated as a 16-bit PCM buffer at boot, so the game ships
## with zero audio assets and the APK stays small.

const MIX_RATE := 22050
const POOL_SIZE := 14

var _streams: Dictionary = {}
var _pool: Array[AudioStreamPlayer3D] = []
var _next := 0
var _rng := RandomNumberGenerator.new()


func _ready() -> void:
	_rng.randomize()
	_streams["shot"] = _bake(_synth_shot())
	_streams["bark"] = _bake(_synth_bark(1.0))
	_streams["bark_low"] = _bake(_synth_bark(0.72))
	_streams["yelp"] = _bake(_synth_yelp())
	_streams["kibble"] = _bake(_synth_blip(880.0, 1560.0, 0.12))
	_streams["click"] = _bake(_synth_blip(660.0, 660.0, 0.05))
	_streams["buy"] = _bake(_synth_chime([523.25, 659.25, 783.99], 0.45))
	_streams["golden"] = _bake(_synth_chime([523.25, 659.25, 783.99, 1046.5, 1318.5], 1.5))
	_streams["wave"] = _bake(_synth_chime([392.0, 523.25], 0.5))
	_streams["hurt"] = _bake(_synth_hurt())
	_streams["empty"] = _bake(_synth_blip(220.0, 140.0, 0.08))
	_streams["reload"] = _bake(_synth_blip(320.0, 520.0, 0.16))


## Sound players have to live in the 3D scene, so the game hands us its root.
func attach(parent: Node3D) -> void:
	for player in _pool:
		if is_instance_valid(player):
			player.queue_free()
	_pool.clear()
	for i in range(POOL_SIZE):
		var player := AudioStreamPlayer3D.new()
		player.max_distance = 45.0
		player.unit_size = 4.0
		parent.add_child(player)
		_pool.append(player)


func play(sound: String, position: Vector3, volume_db: float = 0.0, pitch: float = 1.0) -> void:
	if _pool.is_empty() or not _streams.has(sound):
		return
	var player := _pool[_next]
	_next = (_next + 1) % _pool.size()
	if not is_instance_valid(player):
		return
	player.stream = _streams[sound]
	player.global_position = position
	player.volume_db = volume_db
	player.pitch_scale = pitch
	player.play()


# ------------------------------------------------------------------ synthesis

func _bake(samples: PackedFloat32Array) -> AudioStreamWAV:
	var bytes := PackedByteArray()
	bytes.resize(samples.size() * 2)
	for i in range(samples.size()):
		var value := int(clampf(samples[i], -1.0, 1.0) * 32000.0)
		bytes.encode_s16(i * 2, value)
	var stream := AudioStreamWAV.new()
	stream.format = AudioStreamWAV.FORMAT_16_BITS
	stream.mix_rate = MIX_RATE
	stream.stereo = false
	stream.data = bytes
	return stream


func _buffer(seconds: float) -> PackedFloat32Array:
	var samples := PackedFloat32Array()
	samples.resize(int(seconds * MIX_RATE))
	return samples


func _synth_shot() -> PackedFloat32Array:
	var samples := _buffer(0.22)
	var phase := 0.0
	for i in range(samples.size()):
		var t := float(i) / MIX_RATE
		var env: float = exp(-t * 26.0)
		phase += TAU * lerpf(760.0, 90.0, minf(1.0, t * 12.0)) / MIX_RATE
		var body := sin(phase) * 0.6
		var noise := _rng.randf_range(-1.0, 1.0) * 0.55 * exp(-t * 42.0)
		samples[i] = (body + noise) * env
	return samples


func _synth_bark(pitch: float) -> PackedFloat32Array:
	var samples := _buffer(0.26)
	var phase := 0.0
	for i in range(samples.size()):
		var t := float(i) / MIX_RATE
		# "Woof": a fast pitch drop with a growly second harmonic.
		var freq: float = lerpf(430.0, 165.0, clampf(t * 5.0, 0.0, 1.0)) * pitch
		phase += TAU * freq / MIX_RATE
		var env: float = exp(-t * 11.0) * clampf(t * 60.0, 0.0, 1.0)
		var tone := sin(phase) * 0.7 + sin(phase * 2.0) * 0.25 + sin(phase * 3.0) * 0.1
		samples[i] = tone * env * 0.8
	return samples


func _synth_yelp() -> PackedFloat32Array:
	var samples := _buffer(0.34)
	var phase := 0.0
	for i in range(samples.size()):
		var t := float(i) / MIX_RATE
		var freq: float = lerpf(520.0, 940.0, clampf(t * 3.0, 0.0, 1.0)) * (1.0 - 0.4 * t)
		phase += TAU * freq / MIX_RATE
		var env: float = exp(-t * 7.5) * clampf(t * 40.0, 0.0, 1.0)
		samples[i] = (sin(phase) * 0.75 + sin(phase * 1.5) * 0.2) * env * 0.7
	return samples


func _synth_blip(from_hz: float, to_hz: float, seconds: float) -> PackedFloat32Array:
	var samples := _buffer(seconds)
	var phase := 0.0
	for i in range(samples.size()):
		var t := float(i) / MIX_RATE
		var k: float = t / maxf(seconds, 0.0001)
		phase += TAU * lerpf(from_hz, to_hz, k) / MIX_RATE
		samples[i] = sin(phase) * exp(-t * 14.0) * 0.55
	return samples


func _synth_chime(notes: Array, seconds: float) -> PackedFloat32Array:
	var samples := _buffer(seconds + 0.25)
	var step: float = seconds / float(notes.size())
	for n in range(notes.size()):
		var start := int(step * n * MIX_RATE)
		var phase := 0.0
		for i in range(int((seconds + 0.25 - step * n) * MIX_RATE)):
			var index := start + i
			if index >= samples.size():
				break
			var t := float(i) / MIX_RATE
			phase += TAU * float(notes[n]) / MIX_RATE
			var env: float = exp(-t * 5.0)
			samples[index] += (sin(phase) * 0.5 + sin(phase * 2.0) * 0.15) * env * 0.45
	return samples


func _synth_hurt() -> PackedFloat32Array:
	var samples := _buffer(0.3)
	var phase := 0.0
	for i in range(samples.size()):
		var t := float(i) / MIX_RATE
		phase += TAU * lerpf(180.0, 60.0, clampf(t * 4.0, 0.0, 1.0)) / MIX_RATE
		var noise := _rng.randf_range(-1.0, 1.0) * 0.3
		samples[i] = (sin(phase) * 0.7 + noise) * exp(-t * 9.0) * 0.7
	return samples
