' =====================================================================
' FARMERS MARKET - TRO LY THU MUA & QUAN TRI (ONE-CLICK LAUNCHER)
' Tu dong kiem tra, khoi dong dich vu va mo ung dung tren trinh duyet mac dinh
' =====================================================================

Option Explicit
Dim WshShell, fso, currentDir, guardianScript, nodeCmd

Set fso = CreateObject("Scripting.FileSystemObject")
currentDir = fso.GetParentFolderName(WScript.ScriptFullName)
guardianScript = currentDir & "\security-guardian.cjs"

Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = currentDir

' Uu tien duong dan node.exe chuan hoac PATH he thong
If fso.FileExists("C:\Program Files\nodejs\node.exe") Then
    nodeCmd = """C:\Program Files\nodejs\node.exe"""
Else
    nodeCmd = "node"
End If

' Khoi chay Security Guardian Agent ngam (window style 0 = an hoan toan cua so den)
WshShell.Run nodeCmd & " """ & guardianScript & """", 0, False
