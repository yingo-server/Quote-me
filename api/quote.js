const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const dataPath = path.join(__dirname, 'data.txt');
let lines = [];
try {
  const content = fs.readFileSync(dataPath, 'utf-8');
  lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
} catch (err) {
  lines = [];
}

function secureRandomInt(max) {
  return crypto.randomInt(0, max);
}

// 解析行：格式 "中文@@英文"
function parseLine(line) {
  const parts = line.split('@@');
  const zh = parts[0] || '';
  const en = parts[1] || '';
  // original 字段拼接为自然的阅读顺序，避免出现 @@ 符号
  let original = zh.trim();
  if (en.trim()) {
    original += ' ' + en.trim();
  }
  return { zh: zh.trim(), en: en.trim(), original: original };
}

// 根据 mode 过滤有效的行索引列表
function getValidIndices(mode) {
  const result = [];
  for (let i = 0; i < lines.length; i++) {
    const { zh, en } = parseLine(lines[i]);
    if (mode === 'zh' && zh) {
      result.push(i);
    } else if (mode === 'en' && en) {
      result.push(i);
    } else if (mode === 'both' || !mode) {
      result.push(i);
    }
  }
  return result;
}

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { type, line, mode } = req.query;
  const total = lines.length;

  if (total === 0) {
    const errMsg = '数据文件为空或加载失败';
    if (type === 'text') {
      res.status(500).setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.send(`Error: ${errMsg}`);
    }
    return res.status(500).json({ code: 500, msg: errMsg });
  }

  // 对于 text 模式，mode 影响选取范围；对于 json 模式，mode 忽略
  const effectiveMode = (type === 'text') ? (mode || 'both') : 'both';

  // 获取符合条件的行索引列表
  let validIndices = getValidIndices(effectiveMode);
  if (validIndices.length === 0) {
    const errMsg = `没有包含 ${effectiveMode === 'zh' ? '中文' : '英文'} 内容的句子`;
    if (type === 'text') {
      res.status(404).setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.send(`Error: ${errMsg}`);
    }
    return res.status(404).json({ code: 404, msg: errMsg });
  }

  let idx;
  if (line !== undefined) {
    const parsed = parseInt(line, 10);
    if (isNaN(parsed) || !isFinite(parsed)) {
      // 非数字，随机从 validIndices 中选
      idx = validIndices[secureRandomInt(validIndices.length)];
    } else {
      // 检查该行是否在 validIndices 中
      if (!validIndices.includes(parsed)) {
        const errMsg = `行号 ${parsed} 不包含 ${effectiveMode === 'zh' ? '中文' : '英文'} 内容`;
        if (type === 'text') {
          res.status(400).setHeader('Content-Type', 'text/plain; charset=utf-8');
          return res.send(`Error: ${errMsg}`);
        }
        return res.status(400).json({ code: 400, msg: errMsg });
      }
      idx = parsed;
    }
  } else {
    // 随机从 validIndices 中选
    idx = validIndices[secureRandomInt(validIndices.length)];
  }

  const raw = lines[idx];
  const { zh, en, original } = parseLine(raw);

  // JSON 模式返回所有字段
  if (type !== 'text') {
    return res.json({
      code: 200,
      line: idx,
      original: original,
      zh: zh,
      en: en,
      time: new Date().toISOString()
    });
  }

  // 文本模式
  let content;
  const modeLower = (mode || 'both').toLowerCase();
  if (modeLower === 'zh') {
    content = zh;
  } else if (modeLower === 'en') {
    content = en;
  } else {
    content = original; // both
  }
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.send(content);
};
