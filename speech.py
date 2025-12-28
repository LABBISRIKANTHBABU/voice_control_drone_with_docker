import speech_recognition as sr
from nlp_module import DroneNLP
import drone_control, time
try:
    import whisper
except Exception:
    whisper = None

r = sr.Recognizer()
mic = sr.Microphone()
nlp = DroneNLP()

drone_control.connect_drone("udp:127.0.0.1:14550")
print("🎙️ Say a command (e.g. 'take off 10', 'move left 5', 'land')")

while True:
    with mic as source:
        r.adjust_for_ambient_noise(source, duration=0.5)
        print("🎧 Listening...")
        audio = r.listen(source)

    try:
        cmd = r.recognize_google(audio, language="en-IN")
        print(f"🗣️ You said: {cmd}")
        intent, val = nlp.parse(cmd)
        print(f"🤖 NLP → {intent}, {val}")
        drone_control.execute_drone_command(intent, val)
        time.sleep(1)
    except sr.UnknownValueError:
        print("🤔 Didn't catch that.")
    except KeyboardInterrupt:
        print("🛑 Exiting.")
        break
