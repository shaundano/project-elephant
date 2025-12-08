import os
import ctypes
import sys
import time

# --- 1. Set the correct path to your PID file ---
PID_FILE = r"C:\scripts\pid\ocap.pid"

# --- 2. Define Windows API functions ---
kernel32 = ctypes.windll.kernel32
CTRL_C_EVENT = 0

# --- 3. Read the PID from the file ---
try:
    with open(PID_FILE, "r") as f:
        pid = int(f.read().strip())
    print(f"Read target PID: {pid} from {PID_FILE}")
except Exception as e:
    print(f"Error reading PID file: {e}")
    sys.exit(1)

# --- 4. Use Windows API to send Ctrl+C ---
print(f"Attempting to send Ctrl+C (SIGINT) to PID {pid}...")

# 4a. !!! NEW STEP !!!
# Detach from our own console to be able to attach to another.
if not kernel32.FreeConsole():
    print(f"Failed to detach from our *own* console. Error: {ctypes.get_last_error()}")
    # We might still be able to proceed, so don't exit

# 4b. Attach to the target process's console
if not kernel32.AttachConsole(pid):
    print(f"Failed to attach to target console. Error: {ctypes.get_last_error()}")
    print("Is the target process (PID {pid}) still running?")
    sys.exit(1)

# 4c. Disable Ctrl+C for our *own* script
if not kernel32.SetConsoleCtrlHandler(None, True):
    print(f"Failed to disable our own Ctrl-C handler. Error: {ctypes.get_last_error()}")
    kernel32.FreeConsole()
    sys.exit(1)

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

print(f"Stop script finished.")