from dronekit import connect, VehicleMode, LocationGlobalRelative
import time

vehicle = None   # Global connection

def connect_drone(connection_string = "udp:127.0.0.1:14550"):
    """
    Connects to SITL or real drone.
    Default: SITL at tcp:127.0.0.1:5760
    """
    global vehicle
    if vehicle is None or not vehicle.is_armable:
        print(f"🔗 Connecting to drone at {connection_string} ...")
        vehicle = connect(connection_string, wait_ready=True, timeout=60)
        print("✅ Drone connected")
    return vehicle

def arm_and_takeoff(aTargetAltitude):
    v = connect_drone()
    print("🚁 Pre-arm checks...")
    while not v.is_armable:
        print("⏳ Waiting for vehicle to initialise...")
        time.sleep(1)

    print("🚁 Arming motors")
    v.mode = VehicleMode("GUIDED")
    v.armed = True

    while not v.armed:
        print("⏳ Waiting for arming...")
        time.sleep(1)

    print(f"🚀 Taking off to {aTargetAltitude}m")
    v.simple_takeoff(aTargetAltitude)

    while True:
        alt = v.location.global_relative_frame.alt
        print(f"📡 Altitude: {alt:.2f} m")
        if alt >= aTargetAltitude * 0.95:
            print("✅ Reached target altitude")
            break
        time.sleep(1)

def land():
    v = connect_drone()
    print("🛬 Landing...")
    v.mode = VehicleMode("LAND")

def rtl():
    v = connect_drone()
    print("🔙 Return to Launch (RTL)...")
    v.mode = VehicleMode("RTL")

def move_forward(distance=5):
    v = connect_drone()
    print(f"➡️ Moving forward {distance} meters")
    # Example: move relative to current location
    current_location = v.location.global_relative_frame
    target_location = LocationGlobalRelative(
        current_location.lat + 0.00001 * distance,  # crude approx
        current_location.lon,
        current_location.alt
    )
    v.simple_goto(target_location)

def disarm():
    v = connect_drone()
    print("🔒 Disarming motors...")
    v.armed = False


    
def execute_drone_command(intent, value=None):
    if intent == "TAKEOFF":
        arm_and_takeoff(value or 10)
    elif intent == "LAND":
        land()
    elif intent == "RTL":
        rtl()
    elif intent == "STOP":
        print("⏹️ Emergency stop! Forcing LAND + disarm...")
        land()
        time.sleep(2)
        disarm()
    # other intents...
    elif intent == "RTL":
        rtl()
    elif intent == "MOVE_FORWARD":
        move_forward(5)
    elif intent == "MOVE_BACKWARD":
        print("⬅️ Move backward (future implementation)")
    elif intent == "TURN_LEFT":
        print("↩️ Turn left (future implementation)")
    elif intent == "TURN_RIGHT":
        print("↪️ Turn right (future implementation)")
    elif intent == "UP":
        arm_and_takeoff(15)   # Example: climb to 15m
    elif intent == "DOWN":
        land()  # Or descend a little instead of full land
    elif intent == "STOP":
        print("⏹️ Stop command received (hover in place)")
        v = connect_drone()
        v.mode = VehicleMode("BRAKE")
    else:
        print(f"⚠️ Unknown intent: {intent}")



if __name__ == "__main__":
    vehicle = connect("udp:127.0.0.1:14550", wait_ready=False, heartbeat_timeout=0)

    

    arm_and_takeoff(5)
    time.sleep(5)
    land()
    vehicle.close()
    print("🚪 Connection closed")
