 # 🛠️ Installation Guide

Follow these steps to set up the Voice Control Drone system on your local machine.

## Prerequisites

- **Python 3.10+**: Ensure Python is installed and added to your PATH.
- **Git**: To clone the repository.
- **Microphone**: For voice commands.
- **ArduPilot SITL (Optional)**: For testing without a real drone.

## 1. Clone the Repository

```bash
git clone https://github.com/LABBISRIKANTHBABU/VoiceControlDrone.git
cd VoiceControlDrone
```

## 2. Set Up Virtual Environment (Recommended)

```bash
python -m venv venv
# Windows
venv\Scripts\activate
# Linux/Mac
source venv/bin/activate
```

## 3. Install Dependencies

```bash
pip install -r requirements.txt
```

> **Note**: If `requirements.txt` is missing, install key libraries manually:
> `pip install fastapi uvicorn spacy dronekit pymavlink`
> And download the spaCy model:
> `python -m spacy download en_core_web_sm`

## 4. Run the Drone Simulator (SITL)

If you don't have a real drone, run the simulated vehicle:

```bash
# In a separate terminal
sim_vehicle.py -v Copter --console --map
```
*Wait until the console shows "GPS lock" or "Ready to FLY".*

## 5. Start the Server

```bash
python server.py
```
You should see output indicating the server is running at `http://0.0.0.0:8002`.

## 6. Launch the Interface

Open your browser (Chrome or Edge recommended) and navigate to:

**[http://localhost:8002/](http://localhost:8002/)**

1.  Allow Microphone access when prompted.
2.  Click **▶ Start Listening**.
3.  Speak a command (e.g., *"Take off 10 meters"*).
