from dronekit import connect, VehicleMode, LocationGlobalRelative
import time

def arm_and_takeoff(vehicle, target_altitude):
    print("Basic pre-arm checks...")
    while not vehicle.is_armable:
        print(" Waiting for vehicle to initialise...")
        time.sleep(1)

    print("Arming motors...")
    vehicle.mode = VehicleMode("GUIDED")
    vehicle.armed = True

    while not vehicle.armed:
        print(" Waiting for arming...")
        time.sleep(1)

    print("Taking off!")
    vehicle.simple_takeoff(target_altitude)

    while True:
        alt = vehicle.location.global_relative_frame.alt
        print(" Altitude:", alt)
        if alt >= target_altitude * 0.95:
            print("Reached target altitude")
            break
        time.sleep(1)

def main():
    print("Connecting to SITL...")
    vehicle = connect('udp:127.0.0.1:5760', wait_ready=True)

    arm_and_takeoff(vehicle, 10)

    print("Hovering for 10 seconds...")
    time.sleep(10)

    print("Landing...")
    vehicle.mode = VehicleMode("LAND")

    time.sleep(5)
    vehicle.close()
    print("Mission completed")

if __name__ == "__main__":
    main()

