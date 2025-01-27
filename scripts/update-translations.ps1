# PowerShell Translation Update Script

# Set output encoding to UTF-8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

# Color definitions
$colors = @{
    Red = 'Red'
    Green = 'Green'
    Yellow = 'Yellow'
    White = 'White'
}

# Print colored message
function Write-ColorMessage {
    param(
        [string]$Color,
        [string]$Message
    )
    Write-Host $Message -ForegroundColor $Color
}

# Check command result
function Test-CommandResult {
    param(
        [string]$Message
    )
    if ($LASTEXITCODE -eq 0) {
        Write-ColorMessage -Color $colors.Green -Message "[OK] $Message"
        return $true
    } else {
        Write-ColorMessage -Color $colors.Red -Message "[ERROR] $Message"
        exit 1
    }
}

# Main update process
function Update-Translations {
    Write-ColorMessage -Color $colors.Yellow -Message "Starting translation update..."

    # 1. Save current branch name
    $current_branch = git rev-parse --abbrev-ref HEAD
    Write-ColorMessage -Color $colors.Yellow -Message "Current branch: $current_branch"

    # 2. Ensure working directory is clean
    $status = git status -s
    if ($status) {
        Write-ColorMessage -Color $colors.Red -Message "Error: Working directory is not clean. Please commit or stash changes."
        exit 1
    }

    # 3. Update main branch
    Write-ColorMessage -Color $colors.Yellow -Message "Updating main branch..."
    git checkout main
    Test-CommandResult -Message "Switched to main branch"
    
    git pull upstream main
    Test-CommandResult -Message "Pulled updates from upstream"

    # 4. Update i18n branch
    Write-ColorMessage -Color $colors.Yellow -Message "Updating i18n branch..."
    git checkout i18n-zh
    Test-CommandResult -Message "Switched to i18n-zh branch"
    
    git merge main
    Test-CommandResult -Message "Merged main branch updates"

    # 5. Run translation sync tool
    Write-ColorMessage -Color $colors.Yellow -Message "Running translation sync tool..."
    node scripts/i18n-sync.js
    Test-CommandResult -Message "Translation sync completed"

    # 6. Check for translation updates
    $status = git status -s
    if ($status) {
        Write-ColorMessage -Color $colors.Yellow -Message "Translation file changes detected. Please review and commit changes."
    } else {
        Write-ColorMessage -Color $colors.Green -Message "Translation files are up to date."
    }

    # 7. Return to original branch
    git checkout $current_branch
    Test-CommandResult -Message "Returned to original branch"

    Write-ColorMessage -Color $colors.Green -Message "Update completed"
}

# Run main function
Update-Translations 