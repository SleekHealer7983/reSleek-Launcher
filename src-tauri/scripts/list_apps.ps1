$ErrorActionPreference = 'SilentlyContinue'
$ProgressPreference = 'SilentlyContinue'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)

try { Add-Type -AssemblyName System.Drawing } catch {}

try {
  Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;

public static class ResleekShellIcon
{
    [StructLayout(LayoutKind.Sequential)]
    private struct SIZE
    {
        public int cx;
        public int cy;
        public SIZE(int x, int y) { cx = x; cy = y; }
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct BITMAP
    {
        public int bmType;
        public int bmWidth;
        public int bmHeight;
        public int bmWidthBytes;
        public ushort bmPlanes;
        public ushort bmBitsPixel;
        public IntPtr bmBits;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct BITMAPINFOHEADER
    {
        public uint biSize;
        public int biWidth;
        public int biHeight;
        public ushort biPlanes;
        public ushort biBitCount;
        public uint biCompression;
        public uint biSizeImage;
        public int biXPelsPerMeter;
        public int biYPelsPerMeter;
        public uint biClrUsed;
        public uint biClrImportant;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct RGBQUAD
    {
        public byte rgbBlue;
        public byte rgbGreen;
        public byte rgbRed;
        public byte rgbReserved;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct BITMAPINFO
    {
        public BITMAPINFOHEADER bmiHeader;
        [MarshalAs(UnmanagedType.ByValArray, SizeConst = 1)]
        public RGBQUAD[] bmiColors;
    }

    [Flags]
    private enum SIIGBF
    {
        ICONONLY = 0x4
    }

    [ComImport]
    [Guid("bcc18b79-ba16-442f-80c4-8a59c30c463b")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IShellItemImageFactory
    {
        [PreserveSig]
        int GetImage(SIZE size, SIIGBF flags, out IntPtr phbm);
    }

    [DllImport("shell32.dll", CharSet = CharSet.Unicode)]
    private static extern int SHParseDisplayName(
        string pszName,
        IntPtr pbc,
        out IntPtr ppidl,
        uint sfgaoIn,
        out uint psfgaoOut);

    [DllImport("shell32.dll")]
    private static extern int SHCreateItemFromIDList(
        IntPtr pidl,
        ref Guid riid,
        [MarshalAs(UnmanagedType.Interface)] out IShellItemImageFactory ppv);

    [DllImport("gdi32.dll")]
    private static extern bool DeleteObject(IntPtr hObject);

    [DllImport("gdi32.dll")]
    private static extern int GetObject(IntPtr hgdiobj, int cbBuffer, out BITMAP lpvObject);

    [DllImport("gdi32.dll")]
    private static extern int GetDIBits(
        IntPtr hdc,
        IntPtr hbm,
        uint start,
        uint cLines,
        byte[] lpvBits,
        ref BITMAPINFO lpbmi,
        uint usage);

    [DllImport("user32.dll")]
    private static extern IntPtr GetDC(IntPtr hWnd);

    [DllImport("user32.dll")]
    private static extern int ReleaseDC(IntPtr hWnd, IntPtr hDC);

    private static Bitmap FromHBitmap(IntPtr hbitmap)
    {
        BITMAP info;
        if (GetObject(hbitmap, Marshal.SizeOf(typeof(BITMAP)), out info) == 0 ||
            info.bmWidth <= 0 || info.bmHeight <= 0)
        {
            return Image.FromHbitmap(hbitmap);
        }

        int width = info.bmWidth;
        int height = info.bmHeight;
        byte[] pixels = new byte[width * height * 4];
        BITMAPINFO bitmapInfo = new BITMAPINFO();
        bitmapInfo.bmiHeader.biSize = (uint)Marshal.SizeOf(typeof(BITMAPINFOHEADER));
        bitmapInfo.bmiHeader.biWidth = width;
        bitmapInfo.bmiHeader.biHeight = -height;
        bitmapInfo.bmiHeader.biPlanes = 1;
        bitmapInfo.bmiHeader.biBitCount = 32;
        bitmapInfo.bmiHeader.biCompression = 0;
        bitmapInfo.bmiColors = new RGBQUAD[1];

        IntPtr hdc = GetDC(IntPtr.Zero);
        int lines = 0;
        try
        {
            lines = GetDIBits(hdc, hbitmap, 0, (uint)height, pixels, ref bitmapInfo, 0);
        }
        finally
        {
            if (hdc != IntPtr.Zero) ReleaseDC(IntPtr.Zero, hdc);
        }

        if (lines == 0)
        {
            return Image.FromHbitmap(hbitmap);
        }

        Bitmap bitmap = new Bitmap(width, height, PixelFormat.Format32bppArgb);
        BitmapData data = bitmap.LockBits(
            new Rectangle(0, 0, width, height),
            ImageLockMode.WriteOnly,
            PixelFormat.Format32bppArgb);
        try
        {
            Marshal.Copy(pixels, 0, data.Scan0, pixels.Length);
        }
        finally
        {
            bitmap.UnlockBits(data);
        }
        return bitmap;
    }

    public static bool TryGetIcon(string path, int size, out string dataUrl)
    {
        dataUrl = null;
        IntPtr pidl = IntPtr.Zero;
        IntPtr hbitmap = IntPtr.Zero;
        IShellItemImageFactory factory = null;

        try
        {
            uint attributes;
            if (SHParseDisplayName(path, IntPtr.Zero, out pidl, 0, out attributes) != 0 || pidl == IntPtr.Zero)
            {
                return false;
            }

            Guid iid = typeof(IShellItemImageFactory).GUID;
            if (SHCreateItemFromIDList(pidl, ref iid, out factory) != 0 || factory == null)
            {
                return false;
            }

            if (factory.GetImage(new SIZE(size, size), SIIGBF.ICONONLY, out hbitmap) != 0 ||
                hbitmap == IntPtr.Zero)
            {
                return false;
            }

            using (Bitmap bitmap = FromHBitmap(hbitmap))
            using (MemoryStream stream = new MemoryStream())
            {
                bitmap.Save(stream, ImageFormat.Png);
                dataUrl = "data:image/png;base64," + Convert.ToBase64String(stream.ToArray());
            }

            return dataUrl != null;
        }
        catch
        {
            return false;
        }
        finally
        {
            if (hbitmap != IntPtr.Zero) DeleteObject(hbitmap);
            if (factory != null)
            {
                try { Marshal.ReleaseComObject(factory); } catch {}
            }
            if (pidl != IntPtr.Zero) Marshal.FreeCoTaskMem(pidl);
        }
    }
}
'@
} catch {}

try { $shell = New-Object -ComObject WScript.Shell } catch {}

$startDirs = @(
  (Join-Path $env:ProgramData 'Microsoft\Windows\Start Menu\Programs'),
  (Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs')
)

# Map Start Menu shortcut names to their full path and target. The shortcut
# itself is the best icon source: it carries the icon location chosen by the app.
$lnkInfo = @{}
foreach ($dir in $startDirs) {
  if (-not (Test-Path -LiteralPath $dir)) { continue }
  Get-ChildItem -LiteralPath $dir -Filter *.lnk -Recurse -File -ErrorAction SilentlyContinue | ForEach-Object {
    try {
      $target = $shell.CreateShortcut($_.FullName).TargetPath
      $key = $_.BaseName.ToLowerInvariant()
      if (-not $lnkInfo.ContainsKey($key)) {
        $lnkInfo[$key] = [pscustomobject]@{
          Path   = $_.FullName
          Target = $target
        }
      }
    } catch {}
  }
}

function Get-ShellIconDataUrl([string]$path) {
  if (-not $path) { return $null }
  try {
    $data = $null
    if ([ResleekShellIcon]::TryGetIcon($path, 64, [ref]$data)) {
      return $data
    }
  } catch {}
  return $null
}

function Get-IconDataUrl([string]$path) {
  if (-not $path) { return $null }
  if (-not (Test-Path -LiteralPath $path)) { return $null }
  if ($path -notmatch '\.(exe|ico)$') { return $null }
  try {
    $icon = [System.Drawing.Icon]::ExtractAssociatedIcon($path)
    if (-not $icon) { return $null }
    $bitmap = $icon.ToBitmap()
    $stream = New-Object System.IO.MemoryStream
    $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
    $bytes = $stream.ToArray()
    $bitmap.Dispose()
    $stream.Dispose()
    $icon.Dispose()
    return 'data:image/png;base64,' + [Convert]::ToBase64String($bytes)
  } catch {
    return $null
  }
}

$result = New-Object System.Collections.Generic.List[object]
$seen = @{}

foreach ($app in (Get-StartApps)) {
  $name = [string]$app.Name
  if (-not $name) { continue }
  $key = $name.ToLowerInvariant()
  if ($seen.ContainsKey($key)) { continue }
  $seen[$key] = $true

  $appId = [string]$app.AppID
  $info = $lnkInfo[$key]
  $target = $null

  if ($appId -match '^[A-Za-z]:\\' -or $appId -match '\.exe$') {
    $target = $appId
  } elseif ($info -and $info.Target) {
    $target = $info.Target
  }

  # Help files, documentation and uninstall helpers are not launcher material.
  if ($target -and $target -match '\.(chm|hlp|txt|pdf|url|htm|html)$') { continue }

  # Drop broken absolute-path shortcuts; UWP AUMIDs and shell targets have no path here.
  if ($target -and $target -match '^[A-Za-z]:\\' -and -not (Test-Path -LiteralPath $target)) { continue }

  $candidates = @()
  if ($info -and $info.Path) { $candidates += $info.Path }
  if ($appId -and $appId -notmatch '^[A-Za-z]:\\' -and $appId -notmatch '\.exe$') {
    $candidates += "shell:AppsFolder\$appId"
  }
  if ($target) { $candidates += $target }
  if ($target -match '^\{[^}]+\}\\(.+)$') {
    $systemExe = Join-Path $env:SystemRoot ('System32\' + $matches[1])
    if (Test-Path -LiteralPath $systemExe) { $candidates += $systemExe }
    $wowExe = Join-Path $env:SystemRoot ('SysWOW64\' + $matches[1])
    if (Test-Path -LiteralPath $wowExe) { $candidates += $wowExe }
  }

  # Fast path: an exe/ico target usually has a usable associated icon.
  $icon = $null
  if ($target) { $icon = Get-IconDataUrl $target }

  # Fall back to the Windows shell for UWP/MSIX, custom shortcut icons,
  # launcher stubs and exes without a readable icon resource.
  if (-not $icon) {
    foreach ($candidate in $candidates) {
      $icon = Get-ShellIconDataUrl $candidate
      if ($icon) { break }
    }
  }

  $result.Add([pscustomobject]@{
    name   = $name
    appId  = $appId
    target = $target
    icon   = $icon
  })
}

if ($result.Count -eq 0) {
  '[]'
} else {
  $result | ConvertTo-Json -Compress -Depth 4
}
