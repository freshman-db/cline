const fs = require("fs")
const path = require("path")

// 配置
const CONFIG = {
	sourceFile: "package.json",
	defaultTranslationFile: "package.nls.json",
	translationFile: "package.nls.zh-cn.json",
	statusFile: "i18n/status.json",
}

// 读取JSON文件
function readJsonFile(filePath) {
	try {
		const content = fs.readFileSync(filePath, "utf8")
		return JSON.parse(content)
	} catch (error) {
		console.error(`Error reading file ${filePath}:`, error)
		return null
	}
}

// 写入JSON文件
function writeJsonFile(filePath, data) {
	try {
		const content = JSON.stringify(data, null, 4)
		fs.writeFileSync(filePath, content, "utf8")
		return true
	} catch (error) {
		console.error(`Error writing file ${filePath}:`, error)
		return false
	}
}

// 检查翻译状态
function checkTranslationStatus() {
	const source = readJsonFile(CONFIG.sourceFile)
	const defaultTranslation = readJsonFile(CONFIG.defaultTranslationFile)
	const translation = readJsonFile(CONFIG.translationFile)

	if (!source || !defaultTranslation || !translation) {
		console.error("Failed to read required files")
		return
	}

	// 创建状态对象
	const status = {
		lastUpdate: new Date().toISOString().split("T")[0],
		translations: {},
	}

	// 检查所有默认翻译中的key
	Object.keys(defaultTranslation).forEach((key) => {
		if (!translation[key]) {
			console.log(`Missing translation for key: ${key}`)
			status.translations[key] = {
				status: "pending",
				lastChecked: new Date().toISOString().split("T")[0],
			}
		} else {
			status.translations[key] = {
				status: "translated",
				lastChecked: new Date().toISOString().split("T")[0],
			}
		}
	})

	// 检查是否有多余的翻译key
	Object.keys(translation).forEach((key) => {
		if (!defaultTranslation[key]) {
			console.log(`Extra translation key found: ${key}`)
			status.translations[key] = {
				status: "extra",
				lastChecked: new Date().toISOString().split("T")[0],
			}
		}
	})

	// 确保状态文件目录存在
	const statusDir = path.dirname(CONFIG.statusFile)
	if (!fs.existsSync(statusDir)) {
		fs.mkdirSync(statusDir, { recursive: true })
	}

	// 更新状态文件
	writeJsonFile(CONFIG.statusFile, status)

	console.log("Translation status check completed")
}

// 生成翻译报告
function generateReport() {
	const status = readJsonFile(CONFIG.statusFile)
	if (!status) {
		console.error("Failed to read status file")
		return
	}

	console.log("\nTranslation Status Report")
	console.log("========================")
	console.log(`Last Update: ${status.lastUpdate}`)
	console.log("\nTranslation Items:")

	let total = 0
	let translated = 0
	let pending = 0
	let extra = 0

	Object.entries(status.translations).forEach(([key, value]) => {
		total++
		switch (value.status) {
			case "translated":
				translated++
				break
			case "pending":
				pending++
				console.log(`- ${key}: Missing translation (Last checked: ${value.lastChecked})`)
				break
			case "extra":
				extra++
				console.log(`- ${key}: Extra translation (Last checked: ${value.lastChecked})`)
				break
		}
	})

	console.log("\nSummary:")
	console.log(`Total items: ${total}`)
	console.log(`Translated: ${translated}`)
	console.log(`Pending: ${pending}`)
	console.log(`Extra: ${extra}`)
	console.log(`Coverage: ${((translated / (total - extra)) * 100).toFixed(2)}%`)
}

// 主函数
function main() {
	console.log("Starting i18n sync...")
	checkTranslationStatus()
	generateReport()
}

main()
