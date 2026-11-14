$letter = '__LETTER__'
$driveLetter = $letter.TrimEnd(':')
$instance = ''
$letters = @($letter)
$disk = $null

try {
    $partition = Get-Partition -DriveLetter $driveLetter -ErrorAction Stop
    $disk = Get-Disk -Number $partition.DiskNumber -ErrorAction Stop
    $letters = @(Get-Partition -DiskNumber $disk.Number -ErrorAction SilentlyContinue |
        Where-Object { $_.DriveLetter } |
        ForEach-Object { "$($_.DriveLetter):" })
    $instance = ($disk.Path -replace '^\\\\\?\\', '') -replace '#\{[0-9a-fA-F-]+\}$', '' -replace '#', '\'
} catch {
    # Fall back to the single drive letter when Storage cmdlets are unavailable.
}

$shell = New-Object -ComObject Shell.Application
$drive = $shell.Namespace(17).ParseName($letter)
if ($null -ne $drive) {
    $eject = @($drive.Verbs()) | Where-Object {
        (($_.Name -replace '&', '') -match 'Eject|弹出|退出')
    } | Select-Object -First 1
    if ($null -ne $eject) {
        try {
            $eject.DoIt()
        } catch {
            # The physical-device fallback below handles a vetoed/unsupported verb.
        }
    }
}

Start-Sleep -Milliseconds 2000
$remaining = @($letters | Where-Object {
    Test-Path -LiteralPath ($_ + '\') -ErrorAction SilentlyContinue
})
if ($remaining.Count -eq 0) {
    Write-Output 'ejected'
    exit 0
}

if ($null -eq $disk -or $disk.BusType -ne 'USB' -or [string]::IsNullOrWhiteSpace($instance)) {
    throw "设备仍在：$($remaining -join ', ')"
}

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Text;

public static class ResleekUsbEject {
    [DllImport("CfgMgr32.dll", CharSet = CharSet.Unicode)]
    public static extern int CM_Locate_DevNodeW(out uint devInst, string deviceID, uint flags);

    [DllImport("CfgMgr32.dll", CharSet = CharSet.Unicode)]
    public static extern int CM_Request_Device_EjectW(
        uint devInst,
        out uint vetoType,
        StringBuilder vetoName,
        uint nameLen,
        uint flags);
}
'@

$devInst = 0
$cr = [ResleekUsbEject]::CM_Locate_DevNodeW([ref]$devInst, $instance, 0)
if ($cr -ne 0) {
    throw "无法定位 USB 设备（代码 $cr）"
}

$vetoType = 0
$vetoName = New-Object System.Text.StringBuilder 260
$cr = [ResleekUsbEject]::CM_Request_Device_EjectW(
    $devInst,
    [ref]$vetoType,
    $vetoName,
    260,
    0)
if ($cr -ne 0) {
    throw "弹出被拒绝（代码 $cr）：$($vetoName.ToString())，仍在使用：$($remaining -join ', ')"
}

for ($i = 0; $i -lt 8; $i++) {
    Start-Sleep -Milliseconds 500
    $remaining = @($letters | Where-Object {
        Test-Path -LiteralPath ($_ + '\') -ErrorAction SilentlyContinue
    })
    if ($remaining.Count -eq 0) {
        break
    }
}

if ($remaining.Count -gt 0) {
    throw "设备仍有分区未移除：$($remaining -join ', ')"
}

Write-Output 'ejected'
