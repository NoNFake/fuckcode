$ErrorActionPreference = 'Stop'

$App = "fuckcode"
$Repo = "NoNFake/fuckcode"
$InstallDir = "$env:LOCALAPPDATA\Programs\$App\bin"
$Arch = if ($env:PROCESSOR_ARCHITECTURE -eq "ARM64") { "arm64" } else { "x64" }
$Filename = "$App-windows-$Arch.zip"

$TagPath = if ([string]::IsNullOrWhiteSpace($args[0])) { "latest/download" } else { "download/v" + $args[0].TrimStart('v') }
$Url = "https://github.com/$Repo/releases/$TagPath/$Filename"
Write-Host "Fetching $Url..."

$TempZip = Join-Path $env:TEMP ([IO.Path]::GetRandomFileName() + ".zip")

try {
    Invoke-WebRequest -Uri $Url -OutFile $TempZip -UseBasicParsing
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
    Expand-Archive -Path $TempZip -DestinationPath $InstallDir -Force

    if ((Test-Path "$InstallDir\opencode.exe") -and -not (Test-Path "$InstallDir\$App.exe")) {
        Move-Item "$InstallDir\opencode.exe" "$InstallDir\$App.exe" -Force
    }

    $UserPath = [Environment]::GetEnvironmentVariable("Path", "User")
    if ($UserPath -notlike "*$InstallDir*") {
        Write-Host "Adding $InstallDir to User PATH..."
        [Environment]::SetEnvironmentVariable("Path", "$UserPath;$InstallDir", "User")
        $env:Path = "$env:Path;$InstallDir"
    }

    Write-Host "`nFuckCode installed successfully to $InstallDir\$App.exe"
    Write-Host "Restart your terminal or run: & '$InstallDir\$App.exe'"
} finally {
    if (Test-Path $TempZip) { Remove-Item -Path $TempZip -Force -ErrorAction SilentlyContinue }
}
