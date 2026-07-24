#requires -Version 5.1
$ErrorActionPreference = "Stop"

$ExpectedBranch = "cursor/neon-drizzle-better-auth-rebuild-909d"
$ExpectedRemote = "seonghyeonist/unstandard"
$StagingPhrase = "RUN NEON STAGING"

function Write-Sanitized {
    param([string]$Message)
    $redacted = $Message -replace '(postgres(ql)?://)[^:@\s]+(:[^@\s]+)?@', '$1[user]:[secret]@'
    Write-Host $redacted
}

function Fail {
    param([string]$Message)
    Write-Sanitized "FAIL: $Message"
    exit 1
}

function Read-Secret {
    param([string]$Prompt)
    $secure = Read-Host $Prompt -AsSecureString
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
    } finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
    }
}

Push-Location $PSScriptRoot\..\..
try {
    $status = git status --short
    if ($status) { Fail "working tree is not clean" }

    $branch = git branch --show-current
    if ($branch -ne $ExpectedBranch) { Fail "branch must be $ExpectedBranch" }

    $origin = (git remote get-url origin)
    if ($origin -notmatch $ExpectedRemote) { Fail "origin must be $ExpectedRemote" }

    git fetch origin main $ExpectedBranch | Out-Null
    $head = git rev-parse HEAD
    $remoteHead = git rev-parse "origin/$ExpectedBranch"
    if ($head -ne $remoteHead) {
        Fail "local HEAD does not match origin/$ExpectedBranch"
    }

    $typed = Read-Host "Type the staging confirmation phrase"
    if ($typed -ne $StagingPhrase) { Fail "staging confirmation phrase mismatch" }

    $databaseUrl = Read-Secret "DATABASE_URL (hidden)"
    $databaseEnv = Read-Host "DATABASE_ENV (must be staging)"
    if ($databaseEnv -eq "production") { Fail "DATABASE_ENV=production is forbidden" }
    if ($databaseEnv -ne "staging") { Fail "DATABASE_ENV must be staging" }

    $env:DATABASE_URL = $databaseUrl
    $env:DATABASE_ENV = $databaseEnv
    $env:UNSTANDARD_CONFIRM_DB_MIGRATE = "yes"

    $report = [ordered]@{
        timestamp = (Get-Date).ToUniversalTime().ToString("o")
        branch = $branch
        head = $head
        databaseEnv = $databaseEnv
        steps = @()
    }

    function Invoke-Step {
        param([string]$Name, [scriptblock]$Action)
        Write-Sanitized "STEP: $Name"
        & $Action
        if ($LASTEXITCODE -and $LASTEXITCODE -ne 0) { Fail "$Name exited $LASTEXITCODE" }
        $report.steps += @{ name = $Name; status = "PASS" }
    }

    Invoke-Step "npm ci" { npm ci }
    Invoke-Step "lint" { npm run lint }
    Invoke-Step "typecheck" { npm run typecheck }
    Invoke-Step "unit tests" { npm run test }
    Invoke-Step "build" { npm run build }
    Invoke-Step "guard:no-legacy-backend" { npm run guard:no-legacy-backend }
    Invoke-Step "guard:boundaries" { npm run guard:boundaries }
    Invoke-Step "db:migrate" { npm run db:migrate }
    Invoke-Step "db:seed first pass" { npm run db:seed }
    Invoke-Step "db:seed second pass" { npm run db:seed }
    Invoke-Step "db:check" { npm run db:check }

    $optionalIntegration = Read-Host "Run optional test:integration with separate TEST_DATABASE_URL? (yes/no)"
    if ($optionalIntegration -eq "yes") {
        $testUrl = Read-Secret "TEST_DATABASE_URL (hidden)"
        $env:TEST_DATABASE_URL = $testUrl
        $env:DATABASE_ENV = "test"
        $env:UNSTANDARD_CONFIRM_DESTRUCTIVE_TEST = "yes"
        Invoke-Step "test:integration" { npm run test:integration }
    }

    $report.verdict = "PASS"
    $report | ConvertTo-Json -Depth 6 | Write-Host
}
finally {
    Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
    Remove-Item Env:TEST_DATABASE_URL -ErrorAction SilentlyContinue
    Remove-Item Env:UNSTANDARD_CONFIRM_DB_MIGRATE -ErrorAction SilentlyContinue
    Remove-Item Env:UNSTANDARD_CONFIRM_DESTRUCTIVE_TEST -ErrorAction SilentlyContinue
    Pop-Location
}
