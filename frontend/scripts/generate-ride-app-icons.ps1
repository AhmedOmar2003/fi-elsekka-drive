Add-Type -AssemblyName System.Drawing

function New-RoundRectPath {
    param(
        [float]$X,
        [float]$Y,
        [float]$Width,
        [float]$Height,
        [float]$Radius
    )

    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $diameter = $Radius * 2

    $path.AddArc($X, $Y, $diameter, $diameter, 180, 90)
    $path.AddArc($X + $Width - $diameter, $Y, $diameter, $diameter, 270, 90)
    $path.AddArc($X + $Width - $diameter, $Y + $Height - $diameter, $diameter, $diameter, 0, 90)
    $path.AddArc($X, $Y + $Height - $diameter, $diameter, $diameter, 90, 90)
    $path.CloseFigure()

    return $path
}

function New-ColorBrush {
    param([string]$Hex)
    return New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml($Hex))
}

function Draw-AppIcon {
    param(
        [int]$Size,
        [string]$OutputPath
    )

    $bitmap = New-Object System.Drawing.Bitmap $Size, $Size
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml("#0B1411"))

    $outerPath = New-RoundRectPath -X 0 -Y 0 -Width $Size -Height $Size -Radius ($Size * 0.22)
    $outerBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush (
        [System.Drawing.RectangleF]::new(0, 0, $Size, $Size),
        [System.Drawing.ColorTranslator]::FromHtml("#101B17"),
        [System.Drawing.ColorTranslator]::FromHtml("#0A120F"),
        90
    )
    $graphics.FillPath($outerBrush, $outerPath)

    $glowPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(52, 61, 170, 144)), ($Size * 0.016)
    $graphics.DrawPath($glowPen, $outerPath)

    $innerMargin = $Size * 0.11
    $innerPath = New-RoundRectPath -X $innerMargin -Y $innerMargin -Width ($Size - ($innerMargin * 2)) -Height ($Size - ($innerMargin * 2)) -Radius ($Size * 0.18)
    $innerBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush (
        [System.Drawing.RectangleF]::new($innerMargin, $innerMargin, $Size - ($innerMargin * 2), $Size - ($innerMargin * 2)),
        [System.Drawing.ColorTranslator]::FromHtml("#162521"),
        [System.Drawing.ColorTranslator]::FromHtml("#101a17"),
        90
    )
    $graphics.FillPath($innerBrush, $innerPath)

    $innerPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(70, 83, 210, 175)), ($Size * 0.012)
    $graphics.DrawPath($innerPen, $innerPath)

    $coreMargin = $Size * 0.2
    $corePath = New-RoundRectPath -X $coreMargin -Y $coreMargin -Width ($Size - ($coreMargin * 2)) -Height ($Size - ($coreMargin * 2)) -Radius ($Size * 0.15)
    $coreBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush (
        [System.Drawing.RectangleF]::new($coreMargin, $coreMargin, $Size - ($coreMargin * 2), $Size - ($coreMargin * 2)),
        [System.Drawing.ColorTranslator]::FromHtml("#16231f"),
        [System.Drawing.ColorTranslator]::FromHtml("#101815"),
        90
    )
    $graphics.FillPath($coreBrush, $corePath)

    $symbolColor = [System.Drawing.ColorTranslator]::FromHtml("#47C3A6")
    $symbolPen = New-Object System.Drawing.Pen $symbolColor, ($Size * 0.05)
    $symbolPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $symbolPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $symbolPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round

    $leftX = $Size * 0.34
    $rightX = $Size * 0.67
    $topY = $Size * 0.36
    $midY = $Size * 0.5
    $bottomY = $Size * 0.64

    $graphics.DrawLine($symbolPen, $leftX + ($Size * 0.04), $topY, $rightX - ($Size * 0.03), $topY)
    $graphics.DrawLine($symbolPen, $rightX, $topY, $rightX, $midY - ($Size * 0.005))
    $graphics.DrawLine($symbolPen, $rightX - ($Size * 0.005), $midY, $leftX + ($Size * 0.12), $midY)
    $graphics.DrawLine($symbolPen, $leftX, $midY + ($Size * 0.025), $leftX, $bottomY - ($Size * 0.01))
    $graphics.DrawLine($symbolPen, $leftX + ($Size * 0.01), $bottomY, $rightX - ($Size * 0.04), $bottomY)

    $nodeDiameter = $Size * 0.115
    $nodeStroke = $Size * 0.024
    $nodePen = New-Object System.Drawing.Pen $symbolColor, $nodeStroke
    $nodePen.Alignment = [System.Drawing.Drawing2D.PenAlignment]::Center
    $nodeBrush = New-ColorBrush "#16231f"

    $graphics.FillEllipse($nodeBrush, $rightX - ($nodeDiameter / 2), $topY - ($nodeDiameter / 2), $nodeDiameter, $nodeDiameter)
    $graphics.DrawEllipse($nodePen, $rightX - ($nodeDiameter / 2), $topY - ($nodeDiameter / 2), $nodeDiameter, $nodeDiameter)

    $graphics.FillEllipse($nodeBrush, $leftX - ($nodeDiameter / 2), $bottomY - ($nodeDiameter / 2), $nodeDiameter, $nodeDiameter)
    $graphics.DrawEllipse($nodePen, $leftX - ($nodeDiameter / 2), $bottomY - ($nodeDiameter / 2), $nodeDiameter, $nodeDiameter)

    $directory = Split-Path -Parent $OutputPath
    if (-not (Test-Path $directory)) {
        New-Item -ItemType Directory -Path $directory | Out-Null
    }

    $bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)

    $nodeBrush.Dispose()
    $nodePen.Dispose()
    $symbolPen.Dispose()
    $coreBrush.Dispose()
    $innerPen.Dispose()
    $innerBrush.Dispose()
    $glowPen.Dispose()
    $outerBrush.Dispose()
    $corePath.Dispose()
    $innerPath.Dispose()
    $outerPath.Dispose()
    $graphics.Dispose()
    $bitmap.Dispose()
}

$publicDir = Join-Path $PSScriptRoot "..\\public"
Draw-AppIcon -Size 192 -OutputPath (Join-Path $publicDir "notification-icon-192.png")
Draw-AppIcon -Size 512 -OutputPath (Join-Path $publicDir "notification-icon-512.png")
