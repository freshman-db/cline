#!/bin/bash

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_message() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# 检查命令是否成功执行
check_result() {
    if [ $? -eq 0 ]; then
        print_message "$GREEN" "✓ $1"
    else
        print_message "$RED" "✗ $1"
        exit 1
    fi
}

# 主要更新流程
main() {
    print_message "$YELLOW" "开始更新翻译..."

    # 1. 保存当前分支名
    current_branch=$(git rev-parse --abbrev-ref HEAD)
    print_message "$YELLOW" "当前分支: $current_branch"

    # 2. 确保工作区干净
    if [[ -n $(git status -s) ]]; then
        print_message "$RED" "错误: 工作区不干净，请先提交或存储更改"
        exit 1
    fi

    # 3. 更新主分支
    print_message "$YELLOW" "更新主分支..."
    git checkout main
    check_result "切换到主分支"
    
    git pull upstream main
    check_result "从上游拉取更新"

    # 4. 更新i18n分支
    print_message "$YELLOW" "更新i18n分支..."
    git checkout i18n-zh
    check_result "切换到i18n-zh分支"
    
    git merge main
    check_result "合并主分支更新"

    # 5. 运行翻译同步工具
    print_message "$YELLOW" "运行翻译同步工具..."
    node scripts/i18n-sync.js
    check_result "运行翻译同步工具"

    # 6. 检查是否有需要更新的翻译
    if [[ -n $(git status -s) ]]; then
        print_message "$YELLOW" "检测到翻译文件更改，请检查并提交更改"
    else
        print_message "$GREEN" "翻译文件已是最新"
    fi

    # 7. 返回到原始分支
    git checkout $current_branch
    check_result "返回到原始分支"

    print_message "$GREEN" "更新完成！"
}

# 运行主函数
main 