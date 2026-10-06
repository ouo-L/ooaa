' 两个人的小宇宙 · 异地模式（后台无窗口运行）
' 双击后没有任何窗口弹出是正常的：
' 等约 20 秒，打开本文件夹里的「公网地址.txt」，把里面的地址发给 TA。
' 想停止：任务管理器结束 node.exe 和 cloudflared.exe，或运行「停止异地模式.bat」。
Set sh = CreateObject("Wscript.Shell")
dir = Left(WScript.ScriptFullName, InStrRev(WScript.ScriptFullName, "\"))
sh.CurrentDirectory = dir
sh.Run "cmd /c """ & dir & "启动异地模式.bat""", 0, False
