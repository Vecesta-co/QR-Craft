param(
    [Parameter(Mandatory = $true)]
    [string]$Url,

    [int]$TimeoutSeconds = 120
)

$ErrorActionPreference = "Stop"
$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
$attempt = 0

while ((Get-Date) -lt $deadline) {
    $attempt++
    try {
        $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
        if ($response.StatusCode -eq 200) {
            Write-Host "  Server responded with HTTP 200 after $attempt attempt(s)."
            exit 0
        }
    } catch {
        # The server may still be starting; retry until the deadline.
    }
    Start-Sleep -Milliseconds 1500
}

Write-Host "  Timed out waiting for $Url"
exit 1
