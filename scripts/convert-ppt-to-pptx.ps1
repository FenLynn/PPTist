param(
  [Parameter(Mandatory = $true)]
  [string]$InputPath,

  [string]$OutputDir = ''
)

$resolvedInput = Resolve-Path -Path $InputPath -ErrorAction Stop
$inputFile = Get-Item -LiteralPath $resolvedInput

if ($inputFile.Extension.ToLower() -ne '.ppt') {
  throw "Only .ppt files are supported. Input: $($inputFile.FullName)"
}

if (-not $OutputDir) {
  $OutputDir = $inputFile.DirectoryName
}

if (-not (Test-Path -LiteralPath $OutputDir)) {
  New-Item -ItemType Directory -Path $OutputDir | Out-Null
}

$outputPath = Join-Path $OutputDir ($inputFile.BaseName + '.pptx')

try {
  $powerPoint = New-Object -ComObject PowerPoint.Application
} catch {
  throw 'PowerPoint COM automation is unavailable. Install Microsoft PowerPoint on this Windows machine before using this script.'
}

$presentation = $null

try {
  $powerPoint.Visible = -1
  $presentation = $powerPoint.Presentations.Open($inputFile.FullName, $false, $false, $false)
  $ppSaveAsOpenXMLPresentation = 24
  $presentation.SaveAs($outputPath, $ppSaveAsOpenXMLPresentation)
  Write-Output "Converted: $($inputFile.FullName) -> $outputPath"
}
finally {
  if ($presentation -ne $null) {
    $presentation.Close()
  }
  $powerPoint.Quit()
}