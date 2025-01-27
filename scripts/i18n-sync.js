const fs = require('fs');
const path = require('path');

// 配置
const CONFIG = {
    sourceFile: 'package.json',
    translationFile: 'i18n/zh-CN/package.nls.json',
    statusFile: 'i18n/zh-CN/translation-status.json'
};

// 读取JSON文件
function readJsonFile(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(content);
    } catch (error) {
        console.error(`Error reading file ${filePath}:`, error);
        return null;
    }
}

// 写入JSON文件
function writeJsonFile(filePath, data) {
    try {
        const content = JSON.stringify(data, null, 4);
        fs.writeFileSync(filePath, content, 'utf8');
        return true;
    } catch (error) {
        console.error(`Error writing file ${filePath}:`, error);
        return false;
    }
}

// 检查翻译状态
function checkTranslationStatus() {
    const source = readJsonFile(CONFIG.sourceFile);
    const translation = readJsonFile(CONFIG.translationFile);
    const status = readJsonFile(CONFIG.statusFile);

    if (!source || !translation || !status) {
        console.error('Failed to read required files');
        return;
    }

    // 检查命令翻译
    const commands = source.contributes.commands;
    commands.forEach(cmd => {
        const cmdName = cmd.command.replace('cline.', '');
        if (!translation.commands || !translation.commands[cmdName]) {
            console.log(`Missing translation for command: ${cmdName}`);
            if (!status.translations['package.nls.json'][`commands.${cmdName}`]) {
                status.translations['package.nls.json'][`commands.${cmdName}`] = {
                    status: 'pending',
                    lastChecked: new Date().toISOString().split('T')[0]
                };
            }
        } else {
            status.translations['package.nls.json'][`commands.${cmdName}`] = {
                status: 'translated',
                lastChecked: new Date().toISOString().split('T')[0]
            };
        }
    });

    // 检查配置翻译
    const configurations = source.contributes.configuration.properties;
    Object.keys(configurations).forEach(key => {
        const configKey = key.replace('cline.', '');
        const configPath = configKey.split('.');
        let translatedConfig = translation.configuration;
        let isTranslated = true;

        for (const part of configPath) {
            if (!translatedConfig || !translatedConfig[part]) {
                isTranslated = false;
                break;
            }
            translatedConfig = translatedConfig[part];
        }

        if (!isTranslated) {
            console.log(`Missing translation for configuration: ${configKey}`);
            if (!status.translations['package.nls.json'][`configuration.${configKey}`]) {
                status.translations['package.nls.json'][`configuration.${configKey}`] = {
                    status: 'pending',
                    lastChecked: new Date().toISOString().split('T')[0]
                };
            }
        } else {
            status.translations['package.nls.json'][`configuration.${configKey}`] = {
                status: 'translated',
                lastChecked: new Date().toISOString().split('T')[0]
            };
        }
    });

    // 更新状态文件
    status.lastUpdate = new Date().toISOString().split('T')[0];
    writeJsonFile(CONFIG.statusFile, status);

    console.log('Translation status check completed');
}

// 生成翻译报告
function generateReport() {
    const status = readJsonFile(CONFIG.statusFile);
    if (!status) {
        console.error('Failed to read status file');
        return;
    }

    console.log('\nTranslation Status Report');
    console.log('========================');
    console.log(`Last Update: ${status.lastUpdate}`);
    console.log('\nTranslation Items:');

    const translations = status.translations['package.nls.json'];
    let total = 0;
    let translated = 0;

    Object.entries(translations).forEach(([key, value]) => {
        total++;
        if (value.status === 'translated') {
            translated++;
        } else {
            console.log(`- ${key}: ${value.status} (Last checked: ${value.lastChecked})`);
        }
    });

    console.log('\nSummary:');
    console.log(`Total items: ${total}`);
    console.log(`Translated: ${translated}`);
    console.log(`Coverage: ${((translated / total) * 100).toFixed(2)}%`);
}

// 主函数
function main() {
    console.log('Starting i18n sync...');
    checkTranslationStatus();
    generateReport();
}

main(); 