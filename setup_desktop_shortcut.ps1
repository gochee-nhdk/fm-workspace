
$source = @"
using System;
using System.Runtime.InteropServices;
using System.Text;

[ComImport]
[Guid("00021401-0000-0000-C000-000000000046")]
internal class ShellLink {}

[ComImport]
[InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
[Guid("000214F9-0000-0000-C000-000000000046")]
internal interface IShellLinkW
{
    void GetPath([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder pszFile, int cchMaxPath, out IntPtr pfd, int fFlags);
    void GetIDList(out IntPtr ppidl);
    void SetIDList(IntPtr pidl);
    void GetDescription([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder pszName, int cchMaxName);
    void SetDescription([MarshalAs(UnmanagedType.LPWStr)] string pszName);
    void GetWorkingDirectory([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder pszDir, int cchMaxPath);
    void SetWorkingDirectory([MarshalAs(UnmanagedType.LPWStr)] string pszDir);
    void GetArguments([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder pszArgs, int cchMaxPath);
    void SetArguments([MarshalAs(UnmanagedType.LPWStr)] string pszArgs);
    void GetHotkey(out short pwHotkey);
    void SetHotkey(short wHotkey);
    void GetShowCmd(out int piShowCmd);
    void SetShowCmd(int iShowCmd);
    void GetIconLocation([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder pszIconPath, int cchIconPath, out int piIcon);
    void SetIconLocation([MarshalAs(UnmanagedType.LPWStr)] string pszIconPath, int iIcon);
    void SetRelativePath([MarshalAs(UnmanagedType.LPWStr)] string pszPathRel, int dwReserved);
    void Resolve(IntPtr hwnd, int fFlags);
    void SetPath([MarshalAs(UnmanagedType.LPWStr)] string pszFile);
}

[ComImport]
[InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
[Guid("0000010b-0000-0000-C000-000000000046")]
internal interface IPersistFile
{
    void GetClassID(out Guid pClassID);
    void IsDirty();
    void Load([MarshalAs(UnmanagedType.LPWStr)] string pszFileName, int dwMode);
    void Save([MarshalAs(UnmanagedType.LPWStr)] string pszFileName, [MarshalAs(UnmanagedType.Bool)] bool fRemember);
    void SaveCompleted([MarshalAs(UnmanagedType.LPWStr)] string pszFileName);
    void GetCurFile([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder ppszFileName);
}

public static class ShortcutHelper
{
    public static void Create(string shortcutPath, string targetPath, string arguments, string workingDir, string iconPath, string description)
    {
        IShellLinkW link = (IShellLinkW)new ShellLink();
        link.SetPath(targetPath);
        link.SetArguments(arguments);
        link.SetWorkingDirectory(workingDir);
        link.SetIconLocation(iconPath, 0);
        link.SetDescription(description);
        link.SetShowCmd(7); // Minimized
        IPersistFile file = (IPersistFile)link;
        file.Save(shortcutPath, true);
    }
}
"@

Add-Type -TypeDefinition $source

$desktops = @(
    "D:\OneDrive\Máy tính",
    [Environment]::GetFolderPath('Desktop'),
    (Join-Path $env:USERPROFILE "Desktop")
) | Select-Object -Unique

$wscript = Join-Path $env:SystemRoot "System32\wscript.exe"
$appDir = "D:\trợ lý thu mua"
$vbs = "D:\trợ lý thu mua\launch.vbs"
$ico = "D:\trợ lý thu mua\logo.ico"

foreach ($desk in $desktops) {
    if (Test-Path -LiteralPath $desk) {
        $shortcutPath = Join-Path $desk "Trợ Lý Thu Mua - Farmers Market.lnk"
        [ShortcutHelper]::Create($shortcutPath, $wscript, "`"$vbs`"", $appDir, $ico, "Hệ Thống Trợ Lý Thu Mua & Quản Trị - Farmers Market")
        Write-Host "Created shortcut: $shortcutPath"
    }
}
