# Validates ForestMusic executable PowerShell helpers for Windows PowerShell 5.1.
# 1) Parser::ParseFile must report 0 errors.
# 2) Avoidable non-ASCII bytes in .ps1 sources are rejected (UTF-8 without BOM
#    is mis-decoded by Windows PowerShell 5.1 on many Russian Windows installs).
#
# Usage (from repository root, Windows PowerShell 5.1 or later):
#   powershell -NoProfile -File .\scripts\android\validate-ps51-encoding.ps1

[CmdletBinding()]
param(
	[string]$RepoRoot
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if (-not $RepoRoot) {
	$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
}
$RepoRoot = (Resolve-Path -LiteralPath $RepoRoot).Path

$targets = @(
	Get-ChildItem -LiteralPath (Join-Path $RepoRoot 'scripts') -Recurse -Filter '*.ps1' -File |
		Sort-Object FullName
)

if ($targets.Count -eq 0) {
	throw "No .ps1 helpers found under $RepoRoot\scripts"
}

$failed = $false

foreach ($file in $targets) {
	$path = $file.FullName
	$relative = $path.Substring($RepoRoot.Length).TrimStart('\')

	# Byte-level non-ASCII audit (UTF-8 without BOM hazard for PS 5.1).
	$bytes = [System.IO.File]::ReadAllBytes($path)
	$offset = 0
	if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
		# BOM is allowed but not preferred; still audit payload for typographic risk.
		$offset = 3
	}
	$nonAsciiOffsets = New-Object System.Collections.Generic.List[int]
	for ($i = $offset; $i -lt $bytes.Length; $i++) {
		if ($bytes[$i] -gt 127) {
			[void]$nonAsciiOffsets.Add($i)
		}
	}
	if ($nonAsciiOffsets.Count -gt 0) {
		$failed = $true
		$sample = ($nonAsciiOffsets | Select-Object -First 8) -join ', '
		Write-Host "[FAIL] $relative contains non-ASCII bytes at offsets: $sample" -ForegroundColor Red
		Write-Host '       Prefer ASCII-safe punctuation in executable .ps1 helpers for Windows PowerShell 5.1.' -ForegroundColor Yellow
	} else {
		Write-Host "[PASS] ASCII-safe bytes: $relative"
	}

	$tokens = $null
	$errors = $null
	[void][System.Management.Automation.Language.Parser]::ParseFile($path, [ref]$tokens, [ref]$errors)
	if ($null -eq $errors) {
		$errorCount = 0
	} else {
		$errorCount = @($errors).Count
	}
	if ($errorCount -gt 0) {
		$failed = $true
		Write-Host "[FAIL] Parser errors in $relative : $errorCount" -ForegroundColor Red
		foreach ($err in $errors) {
			Write-Host ("  " + $err.ToString()) -ForegroundColor Red
		}
	} else {
		Write-Host "[PASS] Parser clean: $relative"
	}
}

Write-Host ''
Write-Host ("PSVersion=" + $PSVersionTable.PSVersion.ToString())
Write-Host ("Edition=" + $PSVersionTable.PSEdition)

if ($failed) {
	Write-Host 'validate-ps51-encoding: FAIL' -ForegroundColor Red
	exit 1
}

Write-Host 'validate-ps51-encoding: PASS' -ForegroundColor Green
exit 0
