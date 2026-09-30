# 运行期截图取证工具（开发期用，不参与打包）——Phase 13 T1303。
# 用 GDI CopyFromScreen 抓真实桌面像素（含透明置顶的恐龙），产出 PNG 供 README。
# 说明：这不是"伪造素材"，而是对真实运行画面的取证截图。
#
# 用法：
#   powershell -File scripts/capture-screen.ps1                       # 截主屏全屏，自动时间戳命名到 screenshots/
#   powershell -File scripts/capture-screen.ps1 -OutFile screenshots\idle.png
#   powershell -File scripts/capture-screen.ps1 -X 200 -Y 850 -Width 200 -Height 200   # 截指定区域（恐龙特写）
param(
  [string]$OutFile = '',
  [int]$X = -1,
  [int]$Y = -1,
  [int]$Width = -1,
  [int]$Height = -1
)

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# 让本进程 DPI 感知：否则高 DPI 下 Bounds 是虚拟化的 DIP、截图被 OS 拉伸模糊。
$sig = '[System.Runtime.InteropServices.DllImport("user32.dll")] public static extern bool SetProcessDPIAware();'
$user32 = Add-Type -MemberDefinition $sig -Name 'User32' -Namespace 'Win32' -PassThru
[void]$user32::SetProcessDPIAware()

if ($X -lt 0 -or $Width -le 0) {
  $b = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
  $X = $b.Location.X; $Y = $b.Location.Y
  $Width = $b.Width;  $Height = $b.Height
}

if ([string]::IsNullOrEmpty($OutFile)) {
  $ts = Get-Date -Format 'yyyyMMdd-HHmmss'
  $OutFile = Join-Path (Split-Path -Parent $PSScriptRoot) "screenshots\capture-$ts.png"
}

$bmp = New-Object System.Drawing.Bitmap $Width, $Height
$g = [System.Drawing.Graphics]::FromImage($bmp)
$size = New-Object System.Drawing.Size -ArgumentList $Width, $Height
$g.CopyFromScreen($X, $Y, 0, 0, $size)

if (-not [System.IO.Path]::IsPathRooted($OutFile)) { $OutFile = Join-Path (Get-Location).Path $OutFile }
$dir = Split-Path -Parent $OutFile
if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
$bmp.Save($OutFile, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
Write-Output "SAVED $OutFile ${Width}x${Height}"
