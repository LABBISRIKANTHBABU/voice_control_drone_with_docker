#!/usr/bin/env python3

from fastapi import FastAPI, Request, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import HTMLResponse, StreamingResponse
import uvicorn
import asyncio
import json
import math
import tempfile
import os

import drone_control
from nlp_module import DroneNLP
from stt_module import transcribe_vosk, transcribe_whisper, _load_vosk, _load_whisper


app = FastAPI(title="Voice Controlled Drone Server")
nlp = DroneNLP()

# -------------------------------------------------
# CORS (Allow frontend browser access)
# -------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)

# -------------------------------------------------
# Startup: Connect Drone Once
# -------------------------------------------------
@app.on_event("startup")
def startup_event():
    print("🔗 Connecting to drone at udp:127.0.0.1:14550 ...")
    drone_control.connect_drone("udp:127.0.0.1:14550")

# -------------------------------------------------
# Helper: Read live telemetry from DroneKit vehicle
# -------------------------------------------------
def read_telemetry() -> dict:
    v = drone_control.vehicle
    if v is None:
        return {"connected": False}

    try:
        loc   = v.location.global_relative_frame
        gps   = v.gps_0
        batt  = v.battery
        att   = v.attitude

        # Groundspeed from velocity vector (vx, vy components)
        vel   = v.velocity  # [vx, vy, vz] in m/s (NED)
        groundspeed = math.sqrt(vel[0]**2 + vel[1]**2) if vel else v.groundspeed

        return {
            "connected":    True,
            "armed":        v.armed,
            "mode":         v.mode.name if v.mode else "UNKNOWN",
            # Altitude (metres above home, AGL)
            "altitude":     round(loc.alt, 2) if loc else 0.0,
            # Speeds (m/s)
            "groundspeed":  round(groundspeed, 2),
            "airspeed":     round(v.airspeed, 2),
            # Attitude (degrees)
            "roll":         round(math.degrees(att.roll),  1) if att else 0.0,
            "pitch":        round(math.degrees(att.pitch), 1) if att else 0.0,
            "heading":      v.heading or 0,
            # Battery
            "battery_pct":  batt.level if batt and batt.level is not None else None,
            "battery_volt": round(batt.voltage, 2) if batt and batt.voltage else None,
            # GPS
            "lat":          loc.lat if loc else None,
            "lon":          loc.lon if loc else None,
            "gps_fix":      gps.fix_type if gps else 0,
            "satellites":   gps.satellites_visible if gps else 0,
        }
    except Exception as e:
        return {"connected": True, "error": str(e)}

# -------------------------------------------------
# GET /telemetry  – JSON snapshot (poll every ~1 s)
# -------------------------------------------------
@app.get("/telemetry")
async def get_telemetry():
    data = await run_in_threadpool(read_telemetry)
    return data

# -------------------------------------------------
# GET /telemetry/stream  – Server-Sent Events at 2 Hz
# Lets the React frontend subscribe once and get pushed updates.
# -------------------------------------------------
@app.get("/telemetry/stream")
async def telemetry_stream():
    async def event_generator():
        while True:
            try:
                data = await run_in_threadpool(read_telemetry)
                yield f"data: {json.dumps(data)}\n\n"
            except Exception:
                yield "data: {}\n\n"
            await asyncio.sleep(0.5)   # 2 Hz

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        }
    )

# -------------------------------------------------
# POST /stt/vosk  – Offline STT using Vosk (project Vosk model)
# Uses vosk-model-small-en-us-0.15 (US) or vosk-model-small-en-in-0.4 (Indian)
# Accepts WebM/WAV audio blob, converts to 16kHz mono WAV, runs Vosk
# -------------------------------------------------
@app.post("/stt/vosk")
async def stt_vosk(audio: UploadFile = File(...)):
    try:
        audio_bytes = await audio.read()
        mime = audio.content_type or ""
        text = await run_in_threadpool(transcribe_vosk, audio_bytes, mime)
        if text:
            return {"status": "ok", "engine": "vosk", "text": text}
        else:
            return {"status": "empty", "engine": "vosk", "text": "",
                    "detail": "No speech detected — speak clearly into the mic"}
    except FileNotFoundError as e:
        return {"status": "error", "engine": "vosk", "text": "", "detail": str(e)}
    except ImportError as e:
        return {"status": "error", "engine": "vosk", "text": "", "detail": str(e)}
    except Exception as e:
        print(f"❌ Vosk STT error: {e}")
        return {"status": "error", "engine": "vosk", "text": "", "detail": str(e)}

# -------------------------------------------------
# POST /stt  – Offline STT using Whisper (openai-whisper)
# Accepts WebM/WAV audio blob, returns transcribed text.
# -------------------------------------------------
@app.post("/stt")
async def stt_whisper(audio: UploadFile = File(...)):
    try:
        audio_bytes = await audio.read()
        mime = audio.content_type or ""
        result = await run_in_threadpool(transcribe_whisper, audio_bytes, mime)
        text = result.get("text", "")
        lang = result.get("language", "unknown")
        if text:
            return {"status": "ok", "engine": "whisper", "text": text, "language": lang}
        else:
            return {"status": "empty", "engine": "whisper", "text": "",
                    "detail": "No speech detected — speak clearly into the mic"}
    except ImportError as e:
        return {"status": "error", "engine": "whisper", "text": "", "detail": str(e)}
    except Exception as e:
        print(f"❌ Whisper STT error: {e}")
        return {"status": "error", "engine": "whisper", "text": "", "detail": str(e)}

# -------------------------------------------------
# Command Endpoint
# -------------------------------------------------
@app.post("/command")
async def receive_command(request: Request):
    data = await request.json()
    text = data.get("text", "").strip()

    if not text:
        return {"status": "error", "message": "Empty command"}

    print(f"\n📝 Received text: {text}")

    intent, value = nlp.parse(text)
    print(f"🤖 NLP → intent={intent}, value={value}")

    if intent == "UNKNOWN":
        return {
            "status": "ignored",
            "message": "Command not recognized",
            "text": text
        }

    # Run DroneKit command safely (non-blocking FastAPI)
    await run_in_threadpool(drone_control.execute, intent, value)

    return {
        "status": "executed",
        "intent": intent,
        "value": value
    }

# -------------------------------------------------
# UI Endpoint (Fixes Permission Persistence)
# -------------------------------------------------
@app.get("/", response_class=HTMLResponse)
async def serve_ui():
    try:
        with open("speech.html", "r", encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        return "<h1>Error: speech.html not found</h1>"

# -------------------------------------------------
# Run Server
# -------------------------------------------------
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8002)
