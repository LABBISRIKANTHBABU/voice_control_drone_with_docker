""" speech.py — Real-time speech -> NLP -> drone_control using Vosk Indian English model. Prereqs: - PulseAudio on Windows forwarding mic to WSL (PULSE_SERVER=tcp:127.0.0.1) - venv activated with vosk, sounddevice, spacy installed - vosk-model-small-en-in-0.4 downloaded and placed in project folder """ 
"""
speech.py — Real-time speech -> NLP -> drone_control using Vosk Indian English model.

Prereqs:
 - PulseAudio on Windows forwarding mic to WSL (PULSE_SERVER=tcp:127.0.0.1)
 - venv activated with vosk, sounddevice, spacy installed
 - vosk-model-small-en-in-0.4 downloaded and placed in project folder
"""

import os
import json
import queue
import time
from pathlib import Path

# audio
import sounddevice as sd
from vosk import Model, KaldiRecognizer

# NLP + drone control
from nlp_module import DroneNLP
import drone_control  # your drone_control.py

# ------------------------------------------------------------------
# CONFIG
# ------------------------------------------------------------------
SAMPLE_RATE = 16000
BLOCKSIZE = 8000
# name of the model folder (Indian English)
VOSK_MODEL_DIRNAME = "vosk-model-small-en-in-0.4"
VOSK_MODEL_PATH = Path(__file__).parent / VOSK_MODEL_DIRNAME

# If microphone passthrough does not work, set USE_MIC=False to use text mode
USE_MIC = True

# ------------------------------------------------------------------
# verify model
# ------------------------------------------------------------------
if not VOSK_MODEL_PATH.exists():
    raise FileNotFoundError(
        f"Vosk model not found at: {VOSK_MODEL_PATH}\n"
        "Download and extract the model and set VOSK_MODEL_DIRNAME accordingly."
    )

print("🧠 Loading Vosk model:", VOSK_MODEL_PATH)
model = Model(str(VOSK_MODEL_PATH))
rec = KaldiRecognizer(model, SAMPLE_RATE)
rec.SetWords(False)   # optional: disable word-level timestamps to reduce output size

q = queue.Queue()
nlp = DroneNLP()

# ------------------------------------------------------------------
# audio callback for sounddevice
# ------------------------------------------------------------------
def _callback(indata, frames, time_info, status):
    if status:
        print("⚠️ Audio status:", status)
    q.put(bytes(indata))

# ------------------------------------------------------------------
# core processing: parse and execute
# ------------------------------------------------------------------
def process_text(text):
    text = text.strip()
    if not text:
        return
    print(f"\n📝 Recognized: {text}")
    intent, value = nlp.parse(text)
    print(f"🤖 NLP → intent={intent}, value={value}")

    # Ensure drone is connected (connect if not)
    if not drone_control.is_connected():
        print("⚠️ Drone not connected — attempting to connect...")
        drone_control.connect_drone("udp:127.0.0.1:14550")
        # small wait for connection info to populate
        time.sleep(1)

    # Now execute (drone_control will check connection inside)
    drone_control.execute_drone_command(intent, value)

# ------------------------------------------------------------------
# microphone real-time loop
# ------------------------------------------------------------------
def mic_loop():
    print("🎤 Starting microphone stream (press Ctrl+C to stop).")
    # connect to drone early (keeps single connection in process)
    drone_control.connect_drone("udp:127.0.0.1:14550")

    try:
        with sd.RawInputStream(samplerate=SAMPLE_RATE, blocksize=BLOCKSIZE,
                               dtype='int16', channels=1, callback=_callback):
            while True:
                data = q.get()
                if rec.AcceptWaveform(data):
                    res = json.loads(rec.Result())
                    text = res.get("text", "")
                    process_text(text)
                else:
                    # partial = rec.PartialResult()   # we ignore partials for action
                    pass
    except KeyboardInterrupt:
        print("\n🛑 Stopping microphone loop.")
    except Exception as e:
        print("❌ Microphone loop error:", e)

# ------------------------------------------------------------------
# fallback: text mode (keyboard) for testing
# ------------------------------------------------------------------
def text_mode():
    print("⌨️ Text input mode (type 'exit' to quit).")
    drone_control.connect_drone("udp:127.0.0.1:14550")
    while True:
        try:
            cmd = input("🗣️ Enter command: ").strip()
        except KeyboardInterrupt:
            print("\n👋 Exiting.")
            break
        if not cmd:
            continue
        if cmd.lower() in ("exit", "quit"):
            break
        process_text(cmd)

drone_control.connect_drone("udp:127.0.0.1:14550")
print("🎙️ Say a command (e.g. 'take off 10', 'move left 5', 'land')")

# ------------------------------------------------------------------
# run
# ------------------------------------------------------------------
if __name__ == "__main__":
    print("🔎 Speech to Drone (Vosk Indian model) starting...")
    print(" - Vosk model:", VOSK_MODEL_PATH)
    print(" - SAMPLE_RATE:", SAMPLE_RATE)
    print(" - USE_MIC:", USE_MIC)
    print()

    # If USE_MIC False, run text mode
    if not USE_MIC:
        text_mode()
    else:
        # Test that sounddevice can query devices (helps for debug)
        try:
            devinfo = sd.query_devices(kind='input')
            print("🎧 Input device found:", devinfo.get('name', str(devinfo)))
        except Exception as e:
            print("⚠️ No input device accessible in WSL. Error:", e)
            print("→ If WSL has no mic access, set USE_MIC=False or configure PulseAudio on Windows and set PULSE_SERVER in WSL.")
            # fallback to text mode
            text_mode()
            raise SystemExit(1)

        # start mic loop
        mic_loop()

    print("✅ speech.py ended.")
