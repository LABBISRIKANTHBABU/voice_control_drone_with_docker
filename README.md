# 🚁 VoiceControlDrone (Dockerized)

<div align="center">

![Project Banner](https://img.shields.io/badge/AI_Powered_Drone_Control-Voice_Controlled_Autonomous_Flight-red)
![Docker](https://img.shields.io/badge/Docker-Containerized-2496ED?logo=docker&logoColor=white)
![Python](https://img.shields.io/badge/Python-3.9%2B-blue)
![FastAPI](https://img.shields.io/badge/FastAPI-0.104-green)
![React](https://img.shields.io/badge/React-18.2-61dafb)
![Whisper](https://img.shields.io/badge/OpenAI_Whisper-Offline_STT-purple)
![License](https://img.shields.io/badge/License-MIT-yellow)

<h3>🎤 Speak. Command. Fly. An advanced, fully-dockerized voice-controlled drone system with offline AI speech recognition.</h3>

[![Live Demo](https://img.shields.io/badge/🌐-Live_Demo-8A2BE2?style=for-the-badge&logo=vercel)](https://voice-control-drone.vercel.app)
[![Watch Demo](https://img.shields.io/badge/🎬-Watch_Demo_Video-FF0000?style=for-the-badge&logo=youtube)](https://res.cloudinary.com/dnt5w44al/video/upload/v1766822735/V_C_D_Demo_Video__zumuri.mp4)
[![Documentation](https://img.shields.io/badge/📚-Full_Documentation-blue?style=for-the-badge)](https://www.notion.so/VoiceControlDrone-Documentation-323019bfbc8b810f8a02d898b81bc554)

</div>

---

## 📖 Table of Contents

- [Project Overview](#-project-overview)
- [Why Dockerized?](#-why-dockerized)
- [Key Features](#-key-features)
- [System Architecture](#-system-architecture)
- [Technology Stack](#-technology-stack)
- [Quick Start (Docker)](#-quick-start-docker)
- [Voice Commands](#-voice-commands)
- [API Documentation](#-api-documentation)
- [Project Structure](#-project-structure)
- [Acknowledgments & Team](#-acknowledgments--team)
- [License](#-license)

---

## 🎯 Project Overview

**VoiceControlDrone** is a cutting-edge, full-stack system that enables intuitive drone control through natural language voice commands. 

This repository (`voice_control_drone_with_docker`) is the **Primary, Production-Ready** version of the project. It encapsulates the Frontend, Backend, and ArduPilot SITL simulator into highly reproducible Docker containers, completely eliminating "it works on my machine" issues.

### 🚀 What Makes This Version Unique?

- **Zero-Config Setup**: Launch the entire system (UI, API, Simulator) with a single `docker compose up` command.
- **Offline-First NLP**: Complete privacy with local processing using OpenAI's Whisper model and spaCy.
- **Continuous Listening**: Hands-free operation with automatic audio chunk processing.
- **Real-Time Feedback**: Live MAVLink telemetry and 3D path visualization in the React Ground Control Station (GCS).

---

## 🐳 Why Dockerized?

Traditional UAV projects require massive dependency chains (DroneKit, PyMavlink, ArduPilot SITL, Node.js, Python environments). This repository simplifies everything into isolated, networked services:

1. **`vcd_backend`**: A Python container handling FastAPI, Whisper, spaCy, and DroneKit.
2. **`vcd_frontend`**: A Node container serving the React + Vite dashboard.
3. **`vcd_sitl`**: An Ubuntu container running the complete ArduCopter physics simulation.

All connected automatically via a private Docker bridge network.

---

## ✨ Key Features

<div align="center">

| Feature Category | Capabilities |
|-----------------|--------------|
| 🎤 **Voice Recognition** | Offline Whisper STT, Continuous listening, Web Speech Fallback |
| 🧠 **NLP Processing** | Intent extraction, Smart Defaults (e.g. "Takeoff" defaults to 10m) |
| 🚁 **Drone Control** | Takeoff, Land, Relative movement, Rotation, RTL |
| 📊 **Visualization** | Live telemetry, Real-time execution latency tracking, Artificial Horizon |
| 🔒 **Privacy** | 100% offline processing, No cloud dependency |
| ⚡ **Deployment** | 1-Click Docker Compose orchestration |

</div>

---

## 🏗️ System Architecture

### Component Breakdown

<details>
<summary><b>🎤 Frontend (React + Vite)</b></summary>

- Captures voice via Web Speech API or passes audio to the Whisper worker.
- Renders a rich Ground Control Station (GCS) with artificial horizons, maps, and latency logs.
</details>

<details>
<summary><b>⚡ Backend (FastAPI + ThreadPool)</b></summary>

- Asynchronous REST API that offloads blocking DroneKit MAVLink calls to worker threads, keeping the event loop unblocked for concurrent SSE telemetry streaming.
</details>

<details>
<summary><b>🧠 Whisper & spaCy NLP Pipeline</b></summary>

- Parses raw text into 14 distinct intents (`TAKEOFF`, `MOVE_FORWARD`, `ROTATE_CW`, etc.) and extracts precise numerical parameters.
</details>

<details>
<summary><b>🚁 Drone Controller & SITL</b></summary>

- Translates intents into MAVLink `SET_POSITION_TARGET_LOCAL_NED` and `COMMAND_LONG` velocity vectors for accurate, relative drone movements.
</details>

---

## 🛠️ Technology Stack

<div align="center">

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Infrastructure** | Docker, Docker Compose | Container orchestration |
| **Frontend** | React 18, Vite | Ground Control Station UI |
| **Backend** | FastAPI, Uvicorn | High-performance async API |
| **STT & NLP** | OpenAI Whisper, spaCy | Offline speech to intent |
| **Drone Control** | DroneKit, Pymavlink | MAVLink communication |
| **Simulation** | ArduPilot SITL | Software-in-the-loop physics |

</div>

---

## 🚀 Quick Start (Docker)

### Prerequisites
- **Docker** and **Docker Compose** installed.
- **Microphone** (Required for voice input).

### Installation & Execution

```bash
# 1. Clone the primary repository
git clone https://github.com/LABBISRIKANTHBABU/voice_control_drone_with_docker.git
cd voice_control_drone_with_docker

# 2. Build and start all services
docker compose up -d --build

# 3. Open the Voice Interface
# The React Showcase UI is now live at:
http://localhost:5173/

# 4. (Optional) Connect QGroundControl
# QGC will automatically connect to the simulated drone on TCP port 5780
```

*To stop the system, run `docker compose down`.*

*(For manual/non-docker installation instructions, please refer to the secondary [VoiceControlDrone](https://github.com/LABBISRIKANTHBABU/VoiceControlDrone) repository).*

---

## 🗣️ Voice Commands

The system extracts parameters smartly. If you omit a number, safe defaults are applied.

| Category | Voice Command Examples | Action | Default |
|----------|------------------------|--------|---------|
| **Flight** | "take off 10 meters", "land", "return to launch" | Ascend / Descend / Return | Takeoff: 10m |
| **Movement** | "move forward 5 meters", "move left 2", "go up" | NED Velocity changes | Move: 5m |
| **Rotation** | "rotate right 90 degrees", "turn left 45" | Yaw changes | Rotate: 30° |
| **Safety** | "hold position", "arm drone", "disarm" | Halt or arm motors | N/A |

---

## 📡 API Documentation

Once Docker is running, access the interactive Swagger UI:
```
http://localhost:8002/docs
```

---

## 📁 Project Structure

```
voice_control_drone_with_docker/
├── docker-compose.yml            # Core orchestrator
├── Dockerfile.backend            # Python/FastAPI container
├── Dockerfile.sitl               # ArduPilot simulation container
├── app/                          # Backend API & NLP logic
│   ├── api/                      # REST endpoints & SSE Telemetry
│   ├── core/                     # Configurations
│   ├── nlp/                      # spaCy intent engine
│   └── services/                 # DroneKit logic
├── showcase/                     # React Frontend
│   ├── Dockerfile.frontend       # Node container
│   └── src/                      # UI Components
├── drone_control.py              # MAVLink execution wrapper
└── README.md                     # You are here
```

---

## 🙏 Acknowledgments & Team

Built from the ground up by **K. Raghavendra, L. Srikanth Babu & V. Chandini** (G Pulla Reddy Engineering College) for the drone and AI community.

- **OpenAI** - Whisper model
- **ArduPilot Team** - SITL simulation
- **DroneKit Contributors** - Python drone control
- **SpaCy Team** - NLP processing framework
- **FastAPI Community** - Modern Python web framework

---

## 📄 License

This project is licensed under the **MIT License**.

```
MIT License

Copyright (c) 2024 LABBISRIKANTHBABU

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.
```

---

<div align="center">

### 🚁 Ready to Control Drones with Your Voice?

[![Live Demo](https://img.shields.io/badge/🌐-Try_Live_Demo-8A2BE2?style=for-the-badge)](https://voice-control-drone.vercel.app)
[![Documentation](https://img.shields.io/badge/📚-Read_the_Docs-blue?style=for-the-badge)](https://www.notion.so/VoiceControlDrone-Documentation-323019bfbc8b810f8a02d898b81bc554)
[![Star on GitHub](https://img.shields.io/badge/⭐-Star_on_GitHub-yellow?style=for-the-badge)](https://github.com/LABBISRIKANTHBABU/voice_control_drone_with_docker)

**Star this repository if you find it useful!** ⭐

*Built with ❤️ for the drone and AI community | Final Year Project 2026*

</div>
