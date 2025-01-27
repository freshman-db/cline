# PowerShell 更新脚本

# 颜色定义
$colors = @{
    Red = 'Red'
    Green = 'Green'
    Yellow = 'Yellow'
    White = 'White'
}

# 打印带颜色的消息
function Write-ColorMessage {
    param(
        [string]$Color,
        [string]$Message
    )
    Write-Host $Message -ForegroundColor $Color
}

# 检查命令是否成功执行
function Test-CommandResult {
    param(
        [string]$Message
    )
    if ($LASTEXITCODE -eq 0) {
        Write-ColorMessage -Color $colors.Green -Message "✓ $Message"
        return $true
    }
    else {
        Write-ColorMessage -Color $colors.Red -Message "✗ $Message"
        exit 1
    }
}

# 主要更新流程
function Update-Translations {
    Write-ColorMessage -Color $colors.Yellow -Message "开始更新翻译..."

    # 1. 保存当前分支名
    $current_branch = git rev-parse --abbrev-ref HEAD
    Write-ColorMessage -Color $colors.Yellow -Message "当前分支: $current_branch"

    # 2. 确保工作区干净
    $status = git status -s
    if ($status) {
        Write-ColorMessage -Color $colors.Red -Message "错误: 工作区不干净，请先提交或存储更改"
        exit 1
    }

    # 3. 更新主分支
    Write-ColorMessage -Color $colors.Yellow -Message "更新主分支..."
    git checkout main
    Test-CommandResult -Message "切换到主分支"
    
    git pull upstream main
    Test-CommandResult -Message "从上游拉取更新"

    # 4. 更新i18n分支
    Write-ColorMessage -Color $colors.Yellow -Message "更新i18n分支..."
    git checkout i18n-zh
    Test-CommandResult -Message "切换到i18n-zh分支"
    
    git merge main
    Test-CommandResult -Message "合并主分支更新"

    # 5. 运行翻译同步工具
    Write-ColorMessage -Color $colors.Yellow -Message "运行翻译同步工具..."
    node scripts/i18n-sync.js
    Test-CommandResult -Message "运行翻译同步工具"

    # 6. 检查是否有需要更新的翻译
    $status = git status -s
    if ($status) {
        Write-ColorMessage -Color $colors.Yellow -Message "检测到翻译文件更改，请检查并提交更改"
    }
    else {
        Write-ColorMessage -Color $colors.Green -Message "翻译文件已是最新"
    }

    # 7. 返回到原始分支
    git checkout $current_branch
    Test-CommandResult -Message "返回到原始分支"

    Write-ColorMessage -Color $colors.Green -Message "更新完成！"
}

# 运行主函数
Update-Translations 