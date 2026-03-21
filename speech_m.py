"""
speech_m.py — Real-time speech → Whisper STT → NLP → Drone control

Pipeline:
  Microphone (sounddevice) → 5 s WAV chunk
  → OpenAI Whisper (offline, Indian English support)
  → spaCy NLP (DroneNLP)
  → DroneKit MAVLink command

Prereqs (inside .venv):
  pip install openai-whisper sounddevice soundfile imageio-ffmpeg spacy
  python -m spacy download en_core_web_sm
"""

import os
import sys
import time
import queue
from pathlib import Path

import numpy as np
import sounddevice as sd

# ── Whisper ──────────────────────────────────────────────────────────
try:
    import imageio_ffmpeg
    os.environ["PATH"] += os.pathsep + os.path.dirname(imageio_ffmpeg.get_ffmpeg_exe())
except ImportError:
    pass

try:
    import whisper as _whisper
except ImportError:
    print("❌ openai-whisper not installed. Run:")
    print("   pip install openai-whisper imageio-ffmpeg soundfile")
    sys.exit(1)

# ── NLP ──────────────────────────────────────────────────────────────
from nlp_module import DroneNLP

# ── Drone control (optional – requires Python ≤ 3.9 for dronekit) ───
try:
    import drone_control
    DRONE_AVAILABLE = True
except Exception as _e:
    drone_control = None
    DRONE_AVAILABLE = False
    print(f"⚠️  drone_control unavailable ({type(_e).__name__}) — STT+NLP mode only")

# ─────────────────────────────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────────────────────────────
SAMPLE_RATE  = 16000   # Whisper expects 16 kHz
RECORD_SECS  = 5       # seconds to record each utterance
WHISPER_SIZE = "small"  # tiny | base | small | medium  (small is best offline balance for accents)

# ─────────────────────────────────────────────────────────────────────
# Load models once at startup
# ─────────────────────────────────────────────────────────────────────
print(f"🎙️  Loading Whisper '{WHISPER_SIZE}' model …")
model = _whisper.load_model(WHISPER_SIZE)
print("✅  Whisper ready")

nlp = DroneNLP()
print("✅  spaCy NLP ready\n")

# ─────────────────────────────────────────────────────────────────────
# Drone connection (optional)
# ─────────────────────────────────────────────────────────────────────
if DRONE_AVAILABLE:
    try:
        drone_control.connect_drone("udp:127.0.0.1:14550")
    except Exception as e:
        print(f"⚠️  SITL not reachable: {e} — continuing in STT-only mode")
        DRONE_AVAILABLE = False

# ─────────────────────────────────────────────────────────────────────
# Core: transcribe + parse + execute
# ─────────────────────────────────────────────────────────────────────
def process_audio(audio_np: np.ndarray):
    """Transcribe a numpy float32 audio array directly via Whisper internals.
    Bypasses ffmpeg by using whisper.pad_or_trim + log_mel_spectrogram directly.
    """
    import whisper as _w

    # Whisper needs float32 mono at 16kHz — already that from sounddevice
    audio_np = audio_np.astype(np.float32)

    # Use model.transcribe for robust output instead of raw mel decoding
    result = model.transcribe(
        audio_np,
        language="en",
        fp16=False,
        initial_prompt=(
            "drone command: takeoff land move forward backward left right "
            "up down ascend descend rotate turn return to launch arm disarm "
            "hold hover stop brake climb lower drop freeze face look spin "
            "abort home stay lift off touch down go ahead come back reverse "
            "strafe slide increase decrease altitude loose"
        )
    )
    text = result.get("text", "").strip()

    if not text:
        print("🔇  (silence or noise — nothing heard)")
        return

    print(f"\n📝  Recognized  : {text}")

    intent, value = nlp.parse(text)
    print(f"🤖  NLP         → intent={intent}, value={value}")

    if intent == "UNKNOWN":
        print("❓  Not recognized — try: 'take off 10', 'land', 'move forward 5', 'return to launch'")
        return

    if not DRONE_AVAILABLE or drone_control is None:
        print(f"✅  STT+NLP OK  — would send: {intent}({value})")
        print("⚠️  Drone not connected. Start SITL + server.py to execute commands.")
        return

    try:
        if drone_control.vehicle is None:
            print(f"✅  STT+NLP OK  — would send: {intent}({value})")
            print("⚠️  SITL not connected yet.")
        else:
            drone_control.execute(intent, value)
            print(f"🚁  Executed    : {intent}({value})")
    except Exception as e:
        print(f"❌  Drone error : {e}")



# ─────────────────────────────────────────────────────────────────────
# Mic loop
# ─────────────────────────────────────────────────────────────────────
def mic_loop():
    try:
        dev = sd.query_devices(kind="input")
        print(f"🎧  Microphone  : {dev.get('name', 'unknown')}")
    except Exception as e:
        print(f"❌  No microphone found: {e}")
        return

    print(f"\n🎤  Dynamic Speech Detection Active · Speak at any time · Ctrl+C to stop\n")

    # Queue for audio chunks
    q = queue.Queue()
    def audio_callback(indata, frames, time_info, status):
        """This is called for each audio block."""
        if status:
            pass # print(status, file=sys.stderr)
        q.put(indata.copy())
        
    # VAD Variables
    CHUNK_SIZE = 2048 # frames (0.128 seconds at 16kHz)
    SILENCE_THRESHOLD = 0.008
    MAX_SILENCE_CHUNKS = 12 # ~1.5 seconds of silence ends the utterance
    
    recording = False
    audio_buffer = []
    silence_chunks = 0
    session = 0

    try:
        with sd.InputStream(samplerate=SAMPLE_RATE, channels=1, dtype="float32", 
                            blocksize=CHUNK_SIZE, callback=audio_callback):
            while True:
                # Poll the queue for an audio chunk
                try:
                    chunk = q.get(timeout=0.1)
                except queue.Empty:
                    continue
                    
                chunk_np = chunk.flatten()
                rms = float(np.sqrt(np.mean(chunk_np ** 2)))
                
                # Check for speech
                if rms >= SILENCE_THRESHOLD:
                    if not recording:
                        recording = True
                        audio_buffer = []
                        silence_chunks = 0
                        session += 1
                        print("\n" + "─" * 48)
                        print("�️  Speech detected, recording... ", end="", flush=True)
                    else:
                        silence_chunks = 0 # reset silence counter while speaking
                
                if recording:
                    audio_buffer.append(chunk_np)
                    if rms < SILENCE_THRESHOLD:
                        silence_chunks += 1
                        
                    # If we have reached the silence limit, end recording and transcribe
                    if silence_chunks > MAX_SILENCE_CHUNKS:
                        # Combine buffer into one array
                        full_audio = np.concatenate(audio_buffer)
                        recording = False
                        
                        # Only transcribe if the recording is long enough (ignore tiny blips)
                        if len(audio_buffer) > (MAX_SILENCE_CHUNKS + 3): # At least ~0.4s of actual speech
                            print(f"\n⏳  Transcribing... (length: {len(full_audio)/SAMPLE_RATE:.1f}s)")
                            process_audio(full_audio)
                            print("\n🎤  Listening...")
                        else:
                            print("\r🔇  Noise ignored, listening...   ", end="", flush=True)
                            
    except KeyboardInterrupt:
        print("\n\n🛑  Stopped. Goodbye!")


# ─────────────────────────────────────────────────────────────────────
# Text-mode fallback (for testing NLP without microphone)
# ─────────────────────────────────────────────────────────────────────
def text_mode():
    print("⌨️   Text mode — type commands and press Enter (type 'exit' to quit)\n")
    while True:
        try:
            cmd = input("🗣️  Command: ").strip()
        except KeyboardInterrupt:
            print("\n👋  Exiting.")
            break
        if not cmd:
            continue
        if cmd.lower() in ("exit", "quit"):
            break
        intent, value = nlp.parse(cmd)
        print(f"🤖  NLP → intent={intent}, value={value}")
        if intent == "UNKNOWN":
            print("❓  Not recognized")
        elif DRONE_AVAILABLE and drone_control and drone_control.vehicle:
            drone_control.execute(intent, value)
            print(f"�  Executed: {intent}({value})")
        else:
            print(f"✅  Would execute: {intent}({value})")


# ─────────────────────────────────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    USE_MIC = True   # set False to test commands via keyboard

    print("=" * 58)
    print("  VoiceControlDrone — Whisper STT Terminal")
    print(f"  Model : Whisper {WHISPER_SIZE!r}")
    print(f"  Drone : {'connected' if DRONE_AVAILABLE else 'STT-only mode'}")
    print("=" * 58)

    if not USE_MIC:
        text_mode()
    else:
        mic_loop()
