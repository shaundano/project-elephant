import os
import ctypes
import sys
import time

# --- 1. Set the correct path to your PID file ---
PID_FILE = r"C:\scripts\pid\ocap.pid"
# --- NEW: Define the link file to be deleted ---
MEETING_LINK_FILE = r"C:\scripts\meeting\meeting_link.txt"

# --- 2. Define Windows API functions ---
kernel32 = ctypes.windll.kernel32
# ... (rest of the Windows API logic is unchanged) ...
CTRL_C_EVENT = 0

# --- 3. Read the PID from the file ---
try:
    with open(PID_FILE, "r") as f:
        pid = int(f.read().strip())
    print(f"Read target PID: {pid} from {PID_FILE}")
except Exception as e:
    print(f"Error reading PID file: {e}")
    # Don't exit yet, still try to clean up the link file
    pid = None # Set pid to None so we skip the stop logic

# --- 4. Use Windows API to send Ctrl+C ---
if pid:
    print(f"Attempting to send Ctrl+C (SIGINT) to PID {pid}...")
    
    # 4a. Detach from our own console
    if not kernel32.FreeConsole():
        print(f"Failed to detach from our *own* console. Error: {ctypes.get_last_error()}")
        
    # 4b. Attach to the target process's console
    if not kernel32.AttachConsole(pid):
        print(f"Failed to attach to target console. Error: {ctypes.get_last_error()}")
        print(f"Is the target process (PID {pid}) still running?")
        # Don't exit, still try cleanup
    else:
        # 4c. Disable Ctrl+C for our *own* script
        if not kernel32.SetConsoleCtrlHandler(None, True):
            print(f"Failed to disable our own Ctrl-C handler. Error: {ctypes.get_last_error()}")
            kernel32.FreeConsole()
        else:
            # 4d. Send the Ctrl+C event
            if not kernel32.GenerateConsoleCtrlEvent(CTRL_C_EVENT, 0):
                print(f"Failed to send Ctrl+C event. Error: {ctypes.get_last_error()}")
            else:
                print("Successfully sent Ctrl+C signal.")

            time.sleep(1) # Give the signal time to process

            # 4e. Detach from the target's console
            kernel32.FreeConsole()

            # 4f. Re-enable Ctrl+C for our script (for good measure)
            kernel32.SetConsoleCtrlHandler(None, False)
else:
    print("No PID found, skipping process stop.")

print(f"Stop script finished. Proceeding to cleanup...")

try:
    if os.path.exists(MEETING_LINK_FILE):
        os.remove(MEETING_LINK_FILE)
        print(f"Successfully deleted meeting link file: {MEETING_LINK_FILE}")
    else:
        print(f"No meeting link file found to delete at: {MEETING_LINK_FILE}")
except Exception as e:
    print(f"Error deleting meeting link file: {e}")

print("Cleanup complete.")