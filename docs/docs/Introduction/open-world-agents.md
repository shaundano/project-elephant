# Open World Agents

PLAICraft, to capture multimodal training data, has a bespoke setup consisting of [[OBS]], a Minecraft mod package called Spigot, and then whatever middleware they used to pack it all in together. Open World Agents is trying to generalize that process for all desktop recording, which makes a ton of sense. It doesn't matter if the user interface is Minecraft, Excel or trading Memecoins; the inputs of screen, audio, mouse and keyboard ought to be the same.

Actually, another win for DCV: it allows I/O devices, so bring your USB steering wheel.

## OCAP

The key component for this project from Open World Agents is called [OCAP](https://github.com/open-world-agents/ocap). OCAP captures full desktop interactions, and then writes it to two files:

- **MCAP**: [MCAP](https://mcap.dev/) is an open-source standard for time-aligned multimodal input files
- **MKV**: Just a standard video file type

OCAP mainly relies on an impossibly large library called **Gstreamer**, which is basically just a ton of multimedia encoders. You can generally install from Gstreamer the same way that people install from a package manager like brew or pip. Open World Agents and OCAP use Anaconda, which as far as I know is a virtual environment and path manager, not unlike a python virtual environment. The main way you call it is via `conda` and you'll know that you have conda when you see `(base)` in your terminal.

## Does OCAP Just Work™?

Well... I give them **7.5 / 10**. I must accept responsibility as a developer who reads docs too fast (or not at all). But their docs are quite scattered, and they recently broke off OCAP into its own repository which confused me.

The biggest issues are critical limitations with OCAP at the time of writing:

- It's **Windows-only**
- It requires an **NVIDIA GPU**

This means that you have to:

- Request from your cloud provider access to NVIDIA GPUs (I requested 8 vCPUs from AWS, which corresponded to two `g4dn.xlarge` instances at a time)
- Spend about **5x more on compute**
- Install the correct NVIDIA drivers on your virtual machine
- Probably increase the storage while you're at it

I plan on making an open-source contribution to their project, because near the end of my directed study I was able to replace the NVIDIA encoder with a more standard `x264enc` software encoder. I hope that I can save you some grief. In the event that I was abducted or something, it's not hard. The encoder is hardcoded within the project and OCAP is open-source.

## Installation

The last thing on OCAP for this section: I found that the commands in the docs straight up did not work. Here's what you should do: download the project onto your VM via GitHub, then in Powershell, run this command. This basically installs all the dependencies for the project as far as I know.

```bash
pip install -e .
```

