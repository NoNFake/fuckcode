$ErrorActionPreference = 'Stop'

$App = "fuckcode"
$Repo = "NoNFake/fuckcode"
$InstallDir = "$env:LOCALAPPDATA\Programs\$App\bin"

# Determine architecture
$Arch = "x64"
if ($env:PROCESSOR_ARCHITECTURE -eq "ARM64") {
    $Arch = "arm64"
}

$Filename = "$App-windows-$Arch.zip"

if ([string]::IsNullOrWhiteSpace($args[0])) {
    $Url = "https://github.com/$Repo/releases/latest/download/$Filename"
    Write-Host "Fetching latest release from $Repo..."
} else {
    $CleanVersion = $args[0].TrimStart('v')
    $Url = "https://github.com/$Repo/releases/download/v$CleanVersion/$Filename"
    Write-Host "Fetching release v$CleanVersion from $Repo..."
}

$TempDir = Join-Path $env:TEMP ("fuckcode_install_" + [System.Guid]::NewGuid().ToString().Substring(0,8))
New-Item -ItemType Directory -Path $TempDir -Force | Out-Null
$ZipPath = Join-Path $TempDir $Filename

try {
    Write-Host "Downloading $Url..."
    Invoke-WebRequest -Uri $Url -OutFile $ZipPath -UseBasicParsing

    Write-Host "Extracting to $InstallDir..."
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
    Expand-Archive -Path $ZipPath -DestinationPath $TempDir -Force

    $SourceExe = Join-Path $TempDir "$App.exe"
    if (-not (Test-Path $SourceExe)) {
        $SourceExe = Join-Path $TempDir "$App"
    }

    if (Test-Path $SourceExe) {
        Copy-Item -Path $SourceExe -Destination (Join-Path $InstallDir "$App.exe") -Force
    } else {
        $Candidates = Get-ChildItem -Path $TempDir -File
        if ($Candidates.Count -gt 0) {
            Copy-Item -Path $Candidates[0].FullName -Destination (Join-Path $InstallDir "$App.exe") -Force
        } else {
            throw "Could not find $App executable in extracted archive."
        }
    }

    # Add to User PATH if not present
    $UserPath = [Environment]::GetEnvironmentVariable("Path", [EnvironmentVariableTarget]::User)
    if ($UserPath -notlike "*$InstallDir*") {
        Write-Host "Adding $InstallDir to User PATH..."
        $NewPath = "$UserPath;$InstallDir"
        [Environment]::SetEnvironmentVariable("Path", $NewPath, [EnvironmentVariableTarget]::User)
        $env:Path = "$env:Path;$InstallDir"
    }

    Write-Host ""
    Write-Host "FuckCode installed successfully to $InstallDir\$App.exe"
    Write-Host "Restart your terminal or run: & '$InstallDir\$App.exe'"
} finally {
    if (Test-Path $TempDir) {
        Remove-Item -Path $TempDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}
