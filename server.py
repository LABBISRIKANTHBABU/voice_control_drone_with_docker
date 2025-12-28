#!/usr/bin/env python3

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import HTMLResponse
import uvicorn

import drone_control
from nlp_module import DroneNLP

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
