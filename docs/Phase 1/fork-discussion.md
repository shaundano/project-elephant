# Fork Discussion

This document explains the customizations made to the OCAP fork used in this project.

## Repository

**GitHub**: https://github.com/shaundano/elephant-ocap

## Why Use This Fork?

The standard OCAP installation may not work directly on non-GPU EC2 instances. This fork includes several modifications that enable OCAP to run on standard EC2 instances and adds additional features.

## Key Modifications

### 1. Non-GPU Encoder Support

**Overview**: Swapped the NVIDIA encoder for a standard non-GPU encoder (`x264enc`). This allows OCAP to run on non-GPU EC2 instances (like t3.xlarge).

```python title="pipeline.py"
screen_src |= "t. ! queue ! d3d11download ! videoconvert ! video/x-raw,format=NV12 ! x264enc tune=zerolatency speed-preset=ultrafast ! h264parse ! queue ! mux."
```

This line determines the encoder used for video recording.

### 2. Microphone Audio Capture

**Overview**: Added a second audio capture channel for microphone input. Allows recording both microphone and system audio as separate tracks.

```python title="pipeline.py"
if record_mic:
    src |= ElementFactory.wasapi2src(loopback=False) >> "audioconvert ! avenc_aac ! queue ! mux."
```

The `wasapi2src` component is the same one used for recording system audio. The only difference between input and output audio is the `loopback` boolean parameter.

```python title="pipeline.py"
record_mic: Annotated[bool, typer.Option(help="Whether to record microphone input as separate audio track")] = True,
```

The component is passed through setup and during the actual record function.

### 3. Process ID (PID) Automated Termination

**Overview**: Added PID file writing and graceful termination support. Windows doesn't have a graceful `kill` command like Unix systems. Sending a `task kill` to OCAP can corrupt files. This implementation allows graceful termination via SIGINT (Ctrl+C) from external processes. This might be the most based part of my project. I absolutely loved getting this to work. It is based on a [Stack Overflow discussion](https://stackoverflow.com/questions/813086/can-i-send-a-ctrl-c-sigint-to-an-application-on-windows). Read the stack overflow kids!

#### Writing the PID

```python title="recorder.py"
pid_file = Path(r"C:\scripts\pid\ocap.pid")
pid_file.parent.mkdir(parents=True, exist_ok=True)
pid_file.write_text(str(os.getpid()))
```

Windows finds its PID and writes it to a static directory (`C:\scripts\pid\`).

#### Reading and Using the PID

```python title="stop-ocap.py"
try:
    with open(PID_FILE, "r") as f:
        pid = int(f.read().strip())
```

The program reads `ocap.pid` and gets the process ID.

#### Sending SIGINT

```python title="stop-ocap.py"
if not kernel32.GenerateConsoleCtrlEvent(CTRL_C_EVENT, 0):
    print(f"Failed to send Ctrl+C event. Error: {ctypes.get_last_error()}")
else:
    print("Successfully sent Ctrl+C signal.")
```

- `kernel32` is a Windows system library that provides low-level API functions
- `GenerateConsoleCtrlEvent` sends the SIGINT signal
- The SIGINT is defined as Ctrl+C, and `0` means it targets the entire group of processes attached to the console

#### Cleanup

```python title="recorder.py"
finally:
    pid_file.unlink(missing_ok=True)
```

When OCAP wraps up, it deletes the PID file.

## PID Management Flow

```
┌─────────────────┐
│  OCAP Starts    │
│  Writes PID     │
│  to file        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  External       │
│  Process reads  │
│  PID file       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Send SIGINT    │
│  (Ctrl+C)       │
│  via kernel32   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  OCAP gracefully│
│  terminates     │
│  Deletes PID    │
└─────────────────┘
```
---

**Congratulations!** You've completed Phase 1. You should now have a fully functional setup with EC2, DCV, and OCAP running.

