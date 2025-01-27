# 国际化 (i18n) 说明

本项目支持多语言本地化。目前支持以下语言：
- 英语 (默认)
- 简体中文

## 目录结构

```
i18n/
├── zh-CN/                # 简体中文翻译文件
│   ├── package.nls.json  # VS Code扩展本地化
│   └── docs/            # 文档翻译
├── translation-status.json # 翻译状态跟踪
└── README.md            # 本说明文件
```

## 更新翻译

本项目提供了两个更新脚本来帮助维护翻译：

### Windows 用户
使用 PowerShell 脚本：
```powershell
.\scripts\update-translations.ps1
```

### Linux/Mac 用户
使用 Bash 脚本：
```bash
./scripts/update-translations.sh
```

这些脚本会：
1. 从上游仓库同步最新更改
2. 检查是否有新的需要翻译的内容
3. 更新翻译状态文件
4. 生成翻译报告

## 翻译工作流程

1. 确保你在 `i18n-zh` 分支上：
   ```bash
   git checkout i18n-zh
   ```

2. 运行更新脚本检查是否有新的需要翻译的内容

3. 如果有新的内容需要翻译：
   - 更新相应的翻译文件
   - 运行 `node scripts/i18n-sync.js` 检查翻译状态
   - 提交更改并推送到远程仓库

4. 定期从主分支同步更新：
   ```bash
   git checkout main
   git pull upstream main
   git checkout i18n-zh
   git merge main
   ```

## 注意事项

1. 专业术语处理：
   - 某些专业术语（如"MCP"）保持原文不翻译
   - 首次出现时可以添加中文说明

2. 文件编码：
   - 所有翻译文件必须使用 UTF-8 编码
   - 不要使用 BOM 头

3. 格式规范：
   - JSON 文件使用4空格缩进
   - 字符串使用双引号
   - 最后一个属性后不要加逗号

4. 提交规范：
   - 提交信息使用中文
   - 格式：`i18n(zh-CN): 具体改动说明`
   - 例如：`i18n(zh-CN): 更新配置项说明文本`

## 贡献指南

1. Fork 本仓库
2. 切换到 `i18n-zh` 分支
3. 进行翻译工作
4. 提交 Pull Request

## 自动化检查

每次提交时会自动运行以下检查：
1. 翻译文件格式验证
2. 翻译完整性检查
3. 生成翻译覆盖率报告

## 联系方式

如果你在翻译过程中遇到任何问题，请：
1. 提交 Issue
2. 在 PR 中讨论
3. 通过项目主页联系维护者 