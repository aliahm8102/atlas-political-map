# Rasterize the existing SVG globe geometry with Windows System.Drawing.
Add-Type -AssemblyName System.Drawing
[xml]$svg = Get-Content -LiteralPath "$PSScriptRoot/../public/favicon.svg"
$outputDirectory = [IO.Path]::GetFullPath("$PSScriptRoot/../public/icons")
[IO.Directory]::CreateDirectory($outputDirectory) | Out-Null
foreach ($variant in @(@{Size=192; Name='icon-192.png'}, @{Size=512; Name='icon-512.png'}, @{Size=180; Name='apple-touch-icon.png'}, @{Size=512; Name='icon-maskable-512.png'; Maskable=$true})) {
    $size = $variant.Size
    $bitmap = New-Object Drawing.Bitmap($size, $size)
    $graphics = [Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.Clear([Drawing.ColorTranslator]::FromHtml($svg.svg.rect.fill))
    $graphics.ScaleTransform($size / 64.0, $size / 64.0)
    if ($variant.Maskable) {
        $graphics.TranslateTransform(6.4, 6.4)
        $graphics.ScaleTransform(0.8, 0.8)
    }
    $pen = New-Object Drawing.Pen([Drawing.ColorTranslator]::FromHtml($svg.svg.g.stroke), 2)
    $graphics.DrawEllipse($pen, 11, 11, 42, 42)
    $graphics.DrawEllipse($pen, 22, 11, 20, 42)
    $graphics.DrawLine($pen, 11, 32, 53, 32)
    $graphics.DrawLine($pen, 15, 21, 49, 21)
    $graphics.DrawLine($pen, 15, 43, 49, 43)
    $bitmap.Save((Join-Path $outputDirectory $variant.Name), [Drawing.Imaging.ImageFormat]::Png)
    $pen.Dispose()
    $graphics.Dispose()
    $bitmap.Dispose()
}
