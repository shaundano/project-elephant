# NICE DCV

Amazon DCV (previously NICE DCV) is a remote desktop protocol (RDP). RDP lets you take remote control of someone else's computer, while having their screen streamed directly to you. The main app for doing this is literally just called Windows RDP.

So why did Amazon acquire DCV for a bunch of money? Here are a few things that are special about DCV:

1. **Multi-user support:** Several users can remote in at the same time, Windows RDP only allows one session
2. **Cross-platform:** Supported on the three main operating systems (MacOS, Linux, Windows)
3. **High performance:** DCV supports 4K and 60 FPS, and will compress the image quality in order to maintain low latency
4. **Dynamic resizing:** DCV can resize the remote session based on the size of the end user's client

All these things make DCV an interesting choice for companies that have expensive, highly customized workstations because they can simply remote into that machine. It also is good for gaming and is the remote desktop protocol that supports PLAICraft.

## Does it Just Work™?

Like, almost. DCV itself is incredibly stable, but just be warned that if you don't have a valid SSL, you're SOL. Both Jitsi Meet and DCV use TCP/UDP for video streaming (rather than HTTP), and anything Websocket, WebRTC or UDP-based will basically reject a connection unless both sides have valid SSL certificates. SSL certificates are very easily generated from a domain provider like Cloudflare when you own a domain.

Also, keep in mind that DCV is closed-source, and early on I tried to figure out how to separate inputs between multiple users in DCV, but I barely made a scratch.

