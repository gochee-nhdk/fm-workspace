' =====================================================================
' FARMERS MARKET - TRO LY THU MUA & QUAN TRI (ONE-CLICK LAUNCHER)
' Mo web app tren trinh duyet mac dinh cua he thong (Edge, Chrome, Brave...)
' =====================================================================

Set WshShell = CreateObject("WScript.Shell")

' 1. Mo ngay tren trinh duyet mac dinh cua he thong (su dung localhost de lay dung du lieu IndexedDB)
WshShell.Run "rundll32 url.dll,FileProtocolHandler http://localhost:5173/", 1, False

' 2. Khoi dong Security Guardian Agent ngam neu chua khoi chay
WshShell.Run "powershell -WindowStyle Hidden -NoProfile -ExecutionPolicy Bypass -Command ""node .\security-guardian.cjs""", 0, False
