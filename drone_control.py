from dronekit import connect, VehicleMode, LocationGlobalRelative
from pymavlink import mavutil
import time, math

vehicle = None

# ---------------- CONNECT ----------------
def connect_drone(conn="udp:127.0.0.1:14550"):
    global vehicle
    if vehicle is None:
        print("🔗 Connecting to drone...")
        vehicle = connect(conn, wait_ready=True)
        print("✅ Connected")
    return vehicle

def ready():
    return vehicle and vehicle.is_armable

# ---------------- ARM / TAKEOFF ----------------
def arm():
    vehicle.mode = VehicleMode("GUIDED")
    vehicle.armed = True
    while not vehicle.armed:
        time.sleep(1)

def arm_and_takeoff(alt):
    arm()
    vehicle.simple_takeoff(alt)
    while vehicle.location.global_relative_frame.alt < alt * 0.95:
        time.sleep(1)

# ---------------- LAND / RTL ----------------
def land():
    vehicle.mode = VehicleMode("LAND")

def rtl():
    vehicle.mode = VehicleMode("RTL")

def hold():
    vehicle.mode = VehicleMode("BRAKE")

def disarm():
    vehicle.armed = False

# ---------------- VELOCITY CONTROL ----------------
def send_velocity(vx, vy, vz, duration=1):
    msg = vehicle.message_factory.set_position_target_local_ned_encode(
        0, 0, 0,
        mavutil.mavlink.MAV_FRAME_BODY_NED,
        0b0000111111000111,
        0, 0, 0,
        vx, vy, vz,
        0, 0, 0,
        0, 0
    )
    for _ in range(duration * 5):
        vehicle.send_mavlink(msg)
        time.sleep(0.2)

# ---------------- MOVEMENT ----------------
def move_forward(d): send_velocity(d, 0, 0)
def move_backward(d): send_velocity(-d, 0, 0)
def move_left(d): send_velocity(0, -d, 0)
def move_right(d): send_velocity(0, d, 0)
def move_up(d): send_velocity(0, 0, -d)
def move_down(d): send_velocity(0, 0, d)

# ---------------- ROTATION ----------------
def rotate(deg):
    vehicle.condition_yaw(abs(deg), direction=1 if deg > 0 else -1)

# ---------------- EXECUTOR ----------------
def execute(intent, value=None):
    intent = intent.upper()
    print(f"🎯 {intent} {value}")

    if not ready():
        print("⚠️ Drone not ready")
        return

    actions = {
        "ARM": arm,
        "TAKEOFF": lambda: arm_and_takeoff(value or 10),
        "LAND": land,
        "RTL": rtl,
        "HOLD": hold,
        "DISARM": disarm,
        "MOVE_FORWARD": lambda: move_forward(value or 2),
        "MOVE_BACKWARD": lambda: move_backward(value or 2),
        "MOVE_LEFT": lambda: move_left(value or 2),
        "MOVE_RIGHT": lambda: move_right(value or 2),
        "MOVE_UP": lambda: move_up(value or 1),
        "MOVE_DOWN": lambda: move_down(value or 1),
        "ROTATE_CW": lambda: rotate(value or 30),
        "ROTATE_CCW": lambda: rotate(-(value or 30)),
    }

    action = actions.get(intent)
    if action:
        action()
    else:
        print("❌ Unknown command")
