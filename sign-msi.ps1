# MSI Code Signing Script for EmeraldNotes
# This script automatically signs the MSI installer after building

param(
    [string]$MsiPath = "dist\EmeraldNotes*.msi",
    [string]$TimestampServer = "http://timestamp.digicert.com"
)

Write-Host "=== EmeraldNotes MSI Signing Script ===" -ForegroundColor Cyan
Write-Host ""

# Find the MSI file
$msiFiles = Get-ChildItem -Path $MsiPath -ErrorAction SilentlyContinue
if (-not $msiFiles) {
    Write-Host "ERROR: No MSI file found matching pattern: $MsiPath" -ForegroundColor Red
    exit 1
}

$msiFile = $msiFiles[0].FullName
Write-Host "Found MSI file: $msiFile" -ForegroundColor Green

# Find the code signing certificate
$cert = Get-ChildItem -Path Cert:\CurrentUser\My -CodeSigningCert | 
    Where-Object { $_.Subject -like "*EmeraldNotes*" } |
    Select-Object -First 1

if (-not $cert) {
    Write-Host "ERROR: No EmeraldNotes code signing certificate found!" -ForegroundColor Red
    Write-Host "Run the following to create one:" -ForegroundColor Yellow
    Write-Host '  New-SelfSignedCertificate -Type CodeSigningCert -Subject "CN=EmeraldNotes, O=Peyton Winn, C=US" -CertStoreLocation "Cert:\CurrentUser\My" -NotAfter (Get-Date).AddYears(2)' -ForegroundColor Yellow
    exit 1
}

Write-Host "Using certificate:" -ForegroundColor Green
Write-Host "  Subject: $($cert.Subject)"
Write-Host "  Thumbprint: $($cert.Thumbprint)"
Write-Host "  Expires: $($cert.NotAfter)"
Write-Host ""

# Sign the MSI file
Write-Host "Signing MSI file..." -ForegroundColor Cyan
try {
    $result = Set-AuthenticodeSignature -FilePath $msiFile -Certificate $cert -TimestampServer $TimestampServer
    
    if ($result.Status -eq "Valid" -or $result.Status -eq "UnknownError") {
        Write-Host "MSI file signed successfully!" -ForegroundColor Green
        Write-Host "  Status: $($result.Status)"
        Write-Host "  Path: $($result.Path)"
        Write-Host ""
        
        if ($result.Status -eq "UnknownError") {
            Write-Host "Note: Status shows 'UnknownError' because this is a self-signed certificate." -ForegroundColor Yellow
            Write-Host "The file IS signed, but Windows will show a warning unless the certificate is trusted." -ForegroundColor Yellow
        }
    } else {
        Write-Host "WARNING: Signing completed with status: $($result.Status)" -ForegroundColor Yellow
        Write-Host "  Message: $($result.StatusMessage)"
    }
} catch {
    Write-Host "ERROR: Failed to sign MSI file!" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=== Signing Complete ===" -ForegroundColor Cyan
