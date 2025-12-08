Set WshShell = CreateObject("WScript.Shell")
' Run the batch file with two specific arguments:
' 0 = Hide the window (Invisible)
' True = WAIT for the script to finish
' (CRITICAL: If set to False, the script finishes instantly, and Windows logs you off)
WshShell.Run "cmd.exe /c C:\scripts\master_launch.bat", 0, True