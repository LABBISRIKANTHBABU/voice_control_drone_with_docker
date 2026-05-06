from dronekit import connect, VehicleMode, LocationGlobalRelative
from pymavlink import mavutil
import time, math

vehicle = None

MOVE_SPEED_MPS = 2.0  # meters per second (cruising speed)

# Execution-layer value caps — raised to 100m to match NLP VALUE_CAPS.
# Previously 20m caused every command >20m to travel the same distance.
_EXEC_CAPS = {
    "TAKEOFF":        50.0,
    "MOVE_FORWARD":  100.0, "MOVE_BACKWARD": 100.0,
    "MOVE_LEFT":     100.0, "MOVE_RIGHT":    100.0,
    "MOVE_UP":        50.0, "MOVE_DOWN":      50.0,
    "ROTATE_CW":    360.0,  "ROTATE_CCW":   360.0,
}
_EXEC_MINS = {
    "TAKEOFF":      1.0,
    "MOVE_FORWARD": 0.5, "MOVE_BACKWARD": 0.5,
    "MOVE_LEFT":    0.5, "MOVE_RIGHT":    0.5,
    "MOVE_UP":      0.5, "MOVE_DOWN":     0.5,
    "ROTATE_CW":    5.0, "ROTATE_CCW":    5.0,
}


def _clamp_value(intent: str, value) -> float:
    """Clamp a command value to safe bounds for this intent."""
    if value is None:
        return 0.0
    v   = float(value)
    cap = _EXEC_CAPS.get(intent)
    mn  = _EXEC_MINS.get(intent)
    if cap is not None:
        v = min(v, cap)
    if mn is not None and v > 0:
        v = max(v, mn)
    return v


# ---------------- CONNECT ----------------
def connect_drone(conn="udp:127.0.0.1:14550"):
    global vehicle
    if vehicle is None:
        print("Connecting to drone...")
        vehicle = connect(conn, wait_ready=True)
        print("Connected")
    return vehicle


def ready():
    return vehicle is not None and vehicle.is_armable


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
def _move_ned(vx, vy, vz, distance_m):
    """
    Move drone at MOVE_SPEED_MPS in the given NED direction,
    then send an explicit zero-velocity stop to prevent overshoot.

    NED frame:
      vx > 0 = North (forward)   vx < 0 = South (backward)
      vy > 0 = East  (right)     vy < 0 = West  (left)
      vz < 0 = Up                vz > 0 = Down

    distance_m: commanded distance in meters
    """
    # Guard against zero/tiny distances (would produce 0 iterations)
    distance_m = max(0.5, float(distance_m))
    duration_s = distance_m / MOVE_SPEED_MPS

    # Build the velocity command message
    move_msg = vehicle.message_factory.set_position_target_local_ned_encode(
        0, 0, 0,
        mavutil.mavlink.MAV_FRAME_LOCAL_NED,
        0b0000111111000111,          # velocity-only bitmask
        0, 0, 0,                     # position (ignored)
        vx * MOVE_SPEED_MPS,
        vy * MOVE_SPEED_MPS,
        vz * MOVE_SPEED_MPS,
        0, 0, 0, 0, 0
    )

    # FIX Bug 3 — zero-velocity stop message
    stop_msg = vehicle.message_factory.set_position_target_local_ned_encode(
        0, 0, 0,
        mavutil.mavlink.MAV_FRAME_LOCAL_NED,
        0b0000111111000111,
        0, 0, 0,
        0, 0, 0,                     # zero velocity in all axes
        0, 0, 0, 0, 0
    )

    # Send velocity at 10 Hz for the calculated duration
    iterations = max(1, int(duration_s * 10))
    for _ in range(iterations):
        vehicle.send_mavlink(move_msg)
        time.sleep(0.1)

    # FIX Bug 3: explicitly stop — send zero velocity for 0.5 s (5 ticks at 10 Hz)
    # This cuts residual momentum before the flight controller re-stabilises.
    for _ in range(5):
        vehicle.send_mavlink(stop_msg)
        time.sleep(0.1)

    # Brief BRAKE mode to dump any remaining kinetic energy, then restore GUIDED.
    try:
        from dronekit import VehicleMode as _VM
        vehicle.mode = _VM("BRAKE")
        time.sleep(0.6)
        vehicle.mode = _VM("GUIDED")
        time.sleep(0.3)
    except Exception:
        pass  # non-fatal — zero-velocity already sent


# ---------------- MOVEMENT ----------------
def move_forward(distance):
    _move_ned(+1, 0, 0, distance)


def move_backward(distance):
    _move_ned(-1, 0, 0, distance)


def move_left(distance):
    _move_ned(0, -1, 0, distance)


def move_right(distance):
    _move_ned(0, +1, 0, distance)


def move_up(distance):
    _move_ned(0, 0, -1, distance)


def move_down(distance):
    _move_ned(0, 0, +1, distance)


# ---------------- ROTATION ----------------
def rotate(deg):
    """
    Rotate drone BY angle_deg relative to current heading.
    Positive angle = clockwise (right turn).
    Negative angle = counter-clockwise (left turn).
    is_relative=True (param4=1) ensures rotation is relative, not absolute.
    """
    if deg >= 0:
        direction = 1    # clockwise
    else:
        direction = -1   # counter-clockwise
        deg = abs(deg)

    msg = vehicle.message_factory.command_long_encode(
        0, 0,
        mavutil.mavlink.MAV_CMD_CONDITION_YAW,
        0,
        deg,       # param1: target angle magnitude
        30,        # param2: rotation speed (deg/sec)
        direction, # param3: 1=CW, -1=CCW
        1,         # param4: 1=relative (CRITICAL — not absolute heading)
        0, 0, 0
    )
    vehicle.send_mavlink(msg)
    vehicle.flush()
    # Wait for rotation to complete
    wait_time = deg / 30.0  # 30 deg/sec
    time.sleep(wait_time + 0.5)  # +0.5s buffer


# ---------------- EXECUTOR ----------------
def execute(intent, value=None):
    intent = (intent or "").upper()

    # FIX Bug 4 (execution layer): clamp value to safe bounds before acting.
    safe_value = _clamp_value(intent, value)
    if value is not None and safe_value != float(value):
        print(f"[execute] value clamped: {value} → {safe_value} for {intent}")

    print(f"Executing {intent} value={safe_value}")

    actions = {
        "ARM":           arm,
        "TAKEOFF":       lambda: arm_and_takeoff(safe_value or 10),
        "LAND":          land,
        "RTL":           rtl,
        "HOLD":          hold,
        "DISARM":        disarm,
        "MOVE_FORWARD":  lambda: move_forward(safe_value or 5),
        "MOVE_BACKWARD": lambda: move_backward(safe_value or 5),
        "MOVE_LEFT":     lambda: move_left(safe_value or 5),
        "MOVE_RIGHT":    lambda: move_right(safe_value or 5),
        "MOVE_UP":       lambda: move_up(safe_value or 5),
        "MOVE_DOWN":     lambda: move_down(safe_value or 5),
        "ROTATE_CW":     lambda: rotate(safe_value or 30),
        "ROTATE_CCW":    lambda: rotate(-(safe_value or 30)),
    }

    action = actions.get(intent)
    if action is None:
        detail = "Unknown command"
        print(detail)
        return {"execution": "failed", "detail": detail}

    if vehicle is None:
        detail = "Drone not connected"
        print(detail)
        return {"execution": "failed", "detail": detail}

    if not ready() and intent not in {"LAND", "RTL", "HOLD", "DISARM"}:
        detail = "Drone not ready"
        print(detail)
        return {"execution": "failed", "detail": detail}

    try:
        action()
        detail = f"{intent} executed"
        print(detail)
        return {"execution": "success", "detail": detail}
    except Exception as exc:
        detail = str(exc)
        print(f"Drone execution error: {detail}")
        return {"execution": "failed", "detail": detail}
