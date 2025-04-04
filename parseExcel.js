import xlsx from 'xlsx';
import fs from 'fs';

// 读取Excel文件
const workbook = xlsx.readFile('560.xlsx');

// 初始化结果对象
const languageData = {};

// 遍历每个sheet
workbook.SheetNames.forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    const jsonSheet = xlsx.utils.sheet_to_json(sheet, { header: 1 });

    // 获取表头（语种）
    const headers = jsonSheet[0];

    // 遍历每一行数据
    for (let i = 1; i < jsonSheet.length; i++) {
        const row = jsonSheet[i];

        // 遍历每一列
        headers.forEach((header, index) => {
            if (header && row[index] && row[index] !== "——") { // 过滤掉内容为"——"的行
                const { code, name } = getLanguageInfo(header);

                if (!languageData[code]) {
                    languageData[code] = {
                        label: name, // 使用语言名称
                        sentences: []
                    };
                }

                // 去重：如果句子不存在于数组中，才添加
                if (!languageData[code].sentences.includes(row[index])) {
                    languageData[code].sentences.push(row[index]);
                }
            }
        });
    }
});

// 将结果写入JSON文件
fs.writeFileSync('languageData.json', JSON.stringify(languageData, null, 2));

console.log('JSON文件已生成！');

// 辅助函数：根据表头获取语种代码和语言名称
function getLanguageInfo(header) {
    const languageMap = {
        '英语说法举例': { code: 'en', name: 'English' },
        '俄语说法举例': { code: 'ru', name: 'Russian' },
        '西语说法举例': { code: 'es', name: 'Spanish' },
        '阿语说法举例': { code: 'ar', name: 'Arabic' },
        '波斯语说法举例': { code: 'fa', name: 'Persian' },
        '巴西葡语说法举例': { code: 'pt-BR', name: 'Brazilian Portuguese' },
        '欧洲葡语说法举例': { code: 'pt-PT', name: 'European Portuguese' },
        '泰语说法举例': { code: 'th', name: 'Thai' },
        '印尼语说法举例': { code: 'id', name: 'Indonesian' },
        '德语说法举例': { code: 'de', name: 'German' },
        '法语说法举例': { code: 'fr', name: 'French' },
        '意大利语说法举例': { code: 'it', name: 'Italian' },
        '土耳其语说法举例': { code: 'tr', name: 'Turkish' },
        '希伯来语说法举例': { code: 'he', name: 'Hebrew' },
        '荷兰语说法举例': { code: 'nl', name: 'Dutch' },
        '瑞典语说法举例': { code: 'sv', name: 'Swedish' },
        '波兰语说法举例': { code: 'pl', name: 'Polish' },
        '哈萨克语说法举例': { code: 'kk', name: 'Kazakh' },
        '马来西亚语说法举例': { code: 'ms', name: 'Malay' },
        '挪威语说法举例': { code: 'no', name: 'Norwegian' },
        '丹麦语说法举例': { code: 'da', name: 'Danish' }
    };

    return languageMap[header] || { code: header.toLowerCase(), name: header };
}