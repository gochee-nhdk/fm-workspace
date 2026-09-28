' ==============================================================================
' FM WORKSPACE - SILENT LAUNCHER (KHỞI CHẠY NGẦM KHÔNG HIỆN CỬA SỔ ĐEN)
' ==============================================================================
Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
strDir = fso.GetParentFolderName(WScript.ScriptFullName)

' Chạy scripts\launch.bat với window style 0 (ẩn hoàn toàn)
WshShell.Run "cmd /c """ & strDir & "\scripts\launch.bat""", 0, False
