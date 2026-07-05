param(
  [Parameter(Mandatory = $true)]
  [string]$Path,

  [string]$Prompt = "Describe this image accurately. Focus on UI style, layout, colors, shapes, typography, and game-screen details. Do not guess beyond visible content.",

  [string]$Endpoint = "http://127.0.0.1:57321/v1/responses",

  [string]$Model = "gpt-5.5",

  [int]$MaxLongEdge = 768,

  [int]$JpegQuality = 82,

  [int]$MaxOutputTokens = 700
)

$ErrorActionPreference = "Stop"

function Resolve-ImagePath {
  param([string]$InputPath)
  $item = Get-Item -Path $InputPath
  return $item.FullName
}

function New-SafeJpegDataUrl {
  param(
    [string]$ImagePath,
    [int]$LongEdge,
    [int]$Quality
  )

  Add-Type -AssemblyName System.Drawing

  $image = [System.Drawing.Image]::FromFile($ImagePath)
  try {
    $longest = [Math]::Max($image.Width, $image.Height)
    $scale = $LongEdge / [double]$longest
    if ($scale -gt 1) { $scale = 1 }

    $width = [Math]::Max(1, [int][Math]::Round($image.Width * $scale))
    $height = [Math]::Max(1, [int][Math]::Round($image.Height * $scale))

    $bitmap = New-Object System.Drawing.Bitmap($width, $height)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    try {
      $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
      $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
      $graphics.DrawImage($image, 0, 0, $width, $height)

      $stream = New-Object System.IO.MemoryStream
      try {
        $jpegEncoder = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq "image/jpeg" }
        $encoderParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
        $encoderParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]$Quality)
        $bitmap.Save($stream, $jpegEncoder, $encoderParams)
        $bytes = $stream.ToArray()
        $base64 = [Convert]::ToBase64String($bytes)

        return [PSCustomObject]@{
          DataUrl = "data:image/jpeg;base64,$base64"
          Width = $width
          Height = $height
          Bytes = $bytes.Length
        }
      } finally {
        $stream.Dispose()
      }
    } finally {
      $graphics.Dispose()
      $bitmap.Dispose()
    }
  } finally {
    $image.Dispose()
  }
}

function Get-ResponseText {
  param($Response)

  if ($Response.output_text) {
    return [string]$Response.output_text
  }

  $parts = New-Object System.Collections.Generic.List[string]
  foreach ($item in $Response.output) {
    if ($item.content) {
      foreach ($part in $item.content) {
        if ($part.text) { $parts.Add([string]$part.text) }
      }
    }
  }

  return ($parts -join "`n")
}

$imagePath = Resolve-ImagePath -InputPath $Path
$prepared = New-SafeJpegDataUrl -ImagePath $imagePath -LongEdge $MaxLongEdge -Quality $JpegQuality

$body = @{
  model = $Model
  input = @(
    @{
      role = "user"
      content = @(
        @{ type = "input_text"; text = $Prompt },
        @{ type = "input_image"; image_url = $prepared.DataUrl }
      )
    }
  )
  max_output_tokens = $MaxOutputTokens
  stream = $false
} | ConvertTo-Json -Depth 10

try {
  $response = Invoke-RestMethod -Uri $Endpoint -Method Post -Body $body -ContentType "application/json" -TimeoutSec 120
  $text = Get-ResponseText -Response $response
  [PSCustomObject]@{
    Image = $imagePath
    SentWidth = $prepared.Width
    SentHeight = $prepared.Height
    SentBytes = $prepared.Bytes
    Model = $Model
    Text = $text
  } | ConvertTo-Json -Depth 4
} catch {
  if ($_.Exception.Response) {
    $status = $_.Exception.Response.StatusCode.value__
    $stream = $_.Exception.Response.GetResponseStream()
    $bodyText = ""
    if ($stream) {
      $reader = New-Object System.IO.StreamReader($stream)
      $bodyText = $reader.ReadToEnd()
    }
    throw "Vision request failed with HTTP $status. $bodyText"
  }

  throw
}
