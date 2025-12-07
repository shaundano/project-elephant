The goal for this section is to use DCV to remote into your virtual machine running windows, and have run OCAP successfully.

## EC2 Setup

Here's how to set up a basic EC2 instance.

First thing, within AWS, you should navigate to the EC2 app. This is what my dashboard looks like, just as an example.

You're gonna want to hit `launch instance`.

![EC2 Dashboard with Launch Instance button](../docs/images/Screenshot 2025-12-06 at 4.04.41 PM 1.png)

## EC2 Launch settings

- So you have quite a bit of freedom as to how you set this up, I'm going to give you what I use, and explain why.
	- AMI: Microsoft Windows Server 2022 Base
		- We need windows because of OCAP, plus only windows DCV allows Webcam. Just use the most recent windows server
	- Instance: t3.xlarge
		- This is a non-GPU instance. If you're on free tier, just use the biggest one you can manage with free tier. The T3 series is like picking Mario in Mario Kart; kinda lame, but it's the most popular choice that you can't go wrong with.  It's very possible that you don't even need 16GB ram for your use case, you can adjust once you're comfortable with EC2.
	- Key Pair: Create new key pair
		- for this, you're gonna have to create a public and private key pair which will be another layer of security when accessing ec2 instances. As I remember, you just create the keys in your AWS account and ideally you keep the keys on your local machine or elsewhere.
	- Security Group: Create a security group
		- Security group basically determines what ports are open on the ec2, I'll have a section for setting up your security group further down.
	- Storage: Go with default for now
		- You can always add more storage. I did to install NVIDIA drivers, and then that ended up being unnecessary.

Then launch the instance.

### Security Group Setup

![Security Group Configuration Example](../docs/images/Screenshot 2025-12-06 at 4.13.01 PM.png)

The picture above is a mess: do not do this. You should ideally have a security group for each purpose for an ec2, so if one is running your actual DCV session and another is running a jitsi server, the ports you need are different.

But in case you're in a rush: here are the ones you need:

| **Type**       | **Protocol** | **Port Range** | **Source**  | **Description**                     |
| -------------- | ------------ | -------------- | ----------- | ----------------------------------- |
| RDP        | TCP          | `3389`         | `My IP`     | Initial Install & Backup Access |
| **Custom TCP** | TCP          | `8443`         | `0.0.0.0/0` | NICE DCV (Web/Client)               |
| **Custom UDP** | UDP          | `8443`         | `0.0.0.0/0` | NICE DCV (QUIC Support)             |
| **Custom UDP** | UDP          | `10000`        | `0.0.0.0/0` | Jitsi Meet (Media/VideoBridge)      |
| **HTTP**       | TCP          | `80`           | `0.0.0.0/0` | Jitsi Meet (Web Access)             |
| **HTTPS**      | TCP          | `443`          | `0.0.0.0/0` | Jitsi Meet (Web Access)             |
| **SSH**        | TCP          | `22`           | `My IP`     | SSH Access (Admin)                  |

### DCV Setup

Now we're gonna remote into the Windows instance. Start up your EC2 instance.

![EC2 Instance Running](../docs/images/Screenshot 2025-12-06 at 4.19.50 PM.png)

So, if you're familiar with SSH, you know that you can access the shell terminal of an ec2 instance. We're actually going to do something a bit funkier. Windows servers are a full OS after all, and so they have a GUI.

Rather than installing stuff via a `curl` function or using a package manager, we're gonna go into the ec2 and install it from the internet. To do that, you will need Windows App.

![Windows Remote Desktop App](../docs/images/Screenshot 2025-12-06 at 4.21.22 PM.png)
(Available on the App store via Mac, but should be available on your OS of choice)

This will allow us to remote into our EC2 before we even have DCV. Remember, DCV is basically the same thing as remote desktop, but better.

To connect to your EC2, note that when you launch it, once it's running it will provide you a public Ipv4 address. This is provisioned automatically on startup, and is basically random. We'll have a solution in the future to accessing our EC2 via a static link, but for now, grab that.

![EC2 Public IPv4 Address](../docs/images/Screenshot 2025-12-06 at 4.25.27 PM.png)
(via the EC2 dashboard)

Go and add a PC connection. Within the EC2 console, there is actually a Connect button and there is an option for RDP Client.

![EC2 Connect Button with RDP Client Option](../docs/images/Screenshot 2025-12-06 at 4.26.43 PM 2.png)

If you are working from a default Windows AMi (which you should be), you will get the password at the bottom. Use `Administrator` and that password to log in (you will be able to change it within Windows settings later).

![Windows Remote Desktop Login Screen](../docs/images/Screenshot 2025-12-06 at 4.26.31 PM 1.png)
(The place where you put in username and password)

![Windows Desktop Connected via Remote Desktop](../docs/images/Screenshot 2025-12-06 at 4.29.01 PM.png)

Welcome. You are now in your remote computer.

If the framerate is dogwater, don't worry about that. First of all, you might be connected via TCP, which is a protocol for streaming video that is a lot slower than UDP, the fast standard. Check `Phase 6 - Optimizations` for that.

Now that we're here, we're going to install the DCV Server on the EC2 Instance, and the DCV client on your local machine. Here's the link: https://www.amazondcv.com/. To be clear, on your EC2 instance, you need to go on the internet (Microsoft Edge), go to this link and download it. You should be able to copy paste into DCV.

 It's pretty normal setup from here. You have used a Remote Desktop, and the client is exactly that. 
 
![DCV Client Download Page](../docs/images/Screenshot 2025-12-06 at 4.40.43 PM.png)

Also, download this. I'm not exactly sure what it does / I didn't see a huge change after downloading, but it could help down the road.

Alright, at this point, you should have an EC2 with the DCV server installed, and the native client installed as well. There are some extra options for DCV on the top tab. You should know that there are three ways to access DCV: via the browser client, the native client (the app you just downloaded), and the SDK. We're going to be using the SDK later on. If you want to access your EC2 via the web browser, just find your public DNS for your EC2. For example:

`ec2-35-88-162-10.us-west-2.compute.amazonaws.com`

then format it like this:

`https://ec2-35-88-162-10.us-west-2.compute.amazonaws.com:8443`

8443 is the default port for DCV connections, which is why you should have enabled it via your security group.

Alright, now we're gonna get into the last critical part of this phase: running OCAP.

First, you're going to need a specific directory setup on your EC2 at the `C:\` level, aka the root level.

```plaintext
C:\scripts\
├── pid\
│   └── (pid will write here, see fork discussion)
├── temp_recordings\
│   └── (ocap will write here)
├── (scipts go here)
```

Also, create a folder called `projects` at the `C:\` level. This is where ocap is going to go.

Next, download as a .zip my fork : https://github.com/shaundano/elephant-ocap and unzip the folder in `projects`.

Now, you're going to want to install Miniconda3. Conda is the package manager that open-world-agents uses, and although there might be a faster, leaner way to get OCAP working, this is the most stable way I found.

You should be able to install it via Powershell.

```code
Invoke-WebRequest -Uri "https://repo.anaconda.com/miniconda/Miniconda3-latest-Windows-x86_64.exe" -outfile ".\Downloads\Miniconda3-latest-Windows-x86_64.exe"
```

If you're given the option to install it on all users, accept it. You should see `(base)` on your Powershell once it's installed.

Now, we need to create an environment. 

```Bash
conda create -n ocap-env python=3.14
```

then activate it.

```Bash
conda activate ocap-env
```

Now, navigate to the project folder of OCAP. When you're inside it in Powershell, run this:

```python
pip install -e .
```

- the -e is just for Editable mode, kinda like debug mode or hot refresh. If the dependencies change in the Python project, it should automatically react. -e is probably not necessary, but this worked for me. The dependencies are defined in `pyproject.toml`.

Now, just for good measure, follow the official ocap docs of what to install:

```python
# Install GStreamer dependencies first (for video recording)
$ conda install open-world-agents::gstreamer-bundle

# Install ocap
$ pip install ocap
```

You should be ready to run ocap. Run it with this command:

```python
ocap my-recording
```

This will write files in the default path, which is `C:\`.

And... yeah. I pray that it works for you. Here's what you should see:

![OCAP Running Successfully](../docs/images/Screenshot 2025-12-06 at 5.32.36 PM.png)
![OCAP Recording Output](../docs/images/Screenshot 2025-12-06 at 5.32.50 PM.png)

### If you're having issues

Don't give up. Make sure your conda environment is activated; you should see `(ocap-env)` on your terminal line. The most common issue that I've seen is something like

`no module 'gi' found

OCAP uses a lot of different gstreamer components, and sometimes they're gonna be missing. Try re-installing the gstreamer plugins from open-world-agents. Try adding the `conda-forge` channel, which should be enabled by default, but sometimes it isn't.

```python
conda config --add channels conda-forge
```

Overall, I will say that getting OCAP to actually run was one of the **hardest parts of my project to debug**. Once it worked, I didn't even really understand why it started working. All I know is that by downloading the project onto your EC2, you are able to rely on your own local repository rather than `pip install ocap` which uses the most recent version. You can at least have visibility on the dependencies you need in `pyproject.toml`.



### Technical Documentation for my Fork

https://github.com/shaundano/elephant-ocap

The reason you want to use my project rather than the publicly available version is that I've made a few tweaks:

- x264enc: I swapped their NVIDIA encoder for a standard non-GPU encoder. This is what allows to run this on non-GPU EC2 instances

``` python
screen_src |= "t. ! queue ! d3d11download ! videoconvert ! video/x-raw,format=NV12 ! x264enc tune=zerolatency speed-preset=ultrafast ! h264parse ! queue ! mux."
```

In `pipeline.py`, this is the line that determines the encoder.

- Audio-in capture: I added a second audio capture channel so that both microphone and system audio are included in the recording
```python
if record_mic:
    src |= ElementFactory.wasapi2src(loopback=False) >> "audioconvert ! avenc_aac ! queue ! mux."
```
(pipeline.py)

- This is where I define the record_mic component, wasapi2src is the exact same one used for recording system audio. As far as I know, the only difference between in and out audio is the loopback boolean.

```python
record_mic: Annotated[bool, typer.Option(help="Whether to record microphone input as separate audio track")] = True,
```
- Other than that, it's a matter of ensuring that the component is passed in via setup and during the actual record function.

- Writes a PID: I followed an awesome [stackoverflow](https://stackoverflow.com/questions/813086/can-i-send-a-ctrl-c-sigint-to-an-application-on-windows) discussion about sending a SIGINT from an external process in Windows. Basically, you can't just send a `task kill` to OCAP, or it will corrupt the files. Normally, you terminate the program gracefully by sending pressing `Ctrl + C`,  but there is no graceful `kill` command in Windows. So here's what happens:
  
  ```python
	pid_file = Path(r"C:\scripts\pid\ocap.pid")
    pid_file.parent.mkdir(parents=True, exist_ok=True)
    pid_file.write_text(str(os.getpid()))
  ```
(recorder.py)

- Windows finds its PID, and it writes it to a static directory

```python
try:
	with open(PID_FILE, "r") as f:
	pid = int(f.read().strip())

```
(stop-ocap.py)

- program reads ocap.pid and gets the process ID

```python
if not kernel32.GenerateConsoleCtrlEvent(CTRL_C_EVENT, 0):
	print(f"Failed to send Ctrl+C event. Error: {ctypes.get_last_error()}")
else:
	print("Successfully sent Ctrl+C signal.")
```
(stop-ocap.py)

- kernel32 is a Windows system library that provides low-level API functions.
- GenerateConsoleCtrlEvent sends the SIGINT. The SIGINT isn't necessarily Ctrl + C, but I defined it as Ctrl + C above, and 0 means that it targets the entire group of processes attached to the console (done a few lines up)

``` python
finally:
        pid_file.unlink(missing_ok=True)
```
(recorder.py)

- When OCAP wraps up, it deletes the file.

(you should draw this)





