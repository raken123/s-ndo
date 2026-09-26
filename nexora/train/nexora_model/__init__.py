"""Nexora's own model: a PyTorch training kit.

It fine-tunes an open code model (Qwen2.5-Coder by default) with LoRA so it answers
every request the Nexora app makes – games, bug fixes, SVG sprites, 3D meshes, music,
sound effects and text – and serves it to the app over an OpenAI-compatible HTTP API.
No API key is needed anywhere: the training data is made by the model itself and kept
only when it passes real checks (games are played in a headless browser).

    python -m nexora_model all      # data -> self-play -> train -> ... -> eval
    python -m nexora_model serve    # the app's "Din egen modell" talks to this
"""
from pathlib import Path

__version__ = "1.0.0"

KIT = Path(__file__).resolve().parent.parent          # nexora/train
ROOT = KIT.parent                                       # nexora
PROMPTS_FILE = ROOT / "colab" / "nexora_prompts.json"   # written by nexora/build/prompts.js
EXAMPLES_DIR = ROOT / "marketing" / "examples"
DATA_DIR = KIT / "data"
RUNS_DIR = KIT / "runs"
DEFAULT_BASE = "Qwen/Qwen2.5-Coder-1.5B-Instruct"
MODEL_ID = "nexora-egen"
