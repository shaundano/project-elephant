# Windows

This project will basically turn you into a system administrator. I used **Windows Server 2022**, which you should understand is not a full-feature Windows. There is no Microsoft Store. There are no AI features. Think of it this way: as an end user who has no computer science background, it's Windows Lite. But for someone looking to experiment with the OS, it should be everything you need.

## User Setup

The most important part of my workflow on Windows was having two users:

- **Administrator**: Where I wrote code, set up Task Scheduler, messed with registries, etc.
- **KioskUser**: The end user

## Kiosk Mode

"Kiosk" refers to an umbrella term for single-app sessions in Windows. The burger menu screen at your local Wendy's? That's a kiosk.

Normally, when a user logs into their desktop on Windows, it runs an executable called `explorer.exe`, which gives them the desktop GUI. If you replace that with your own executable, like `burger.exe`, congratulations, you just made a kiosk. The only thing the user has access to (not entirely true, see AppLocker below) is your app. If they `Alt + F4` and kill that process, they will only get a black screen.

The main way that you configure a kiosk (other than creating a brand new user, which is straightforward) is via **regedit**, or Registry Edit. These are low-level instructions that the OS reads when booting up and when loading specific user profiles.

> ⚠️ **Warning:** Do not go poking around here without a purpose because you could brick your whole virtual machine.

## Task Scheduler

You'll also get familiar with **Task Scheduler**, which is a pretty awesome automation application that allows you to basically run any command on a certain trigger. There are pre-written triggers (e.g. at log on), but you can create custom triggers too (I never needed to).

## AppLocker

The last thing I'll mention now is **AppLocker**. AppLocker basically denies access to certain paths on a desktop, even ones that a user has access to by default. For example, you probably don't want your KioskUser accessing Task Manager, and you can lock that.

It is **NOT** a keyboard logger, so users can still press `Ctrl + Alt + Delete` and get to the session menu that contains Task Manager.

