const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// 读取数据文件（Vercel 构建时会打包）
const dataPath = path.join(__dirname, 'data.txt');
let lines = [];
try {
  const content = fs.readFileSync(dataPath, 'utf-8');
  lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
} catch (err) {
  lines = [];
}

// 安全随机整数 [0, max)
function secureRandomInt(max) {
  return crypto.randomInt(0, max);
}

// 拆分中英文
function splitZhEn(text) {
  // 匹配中文字符 + 中文标点（全角）
  const zhMatch = text.match(/[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]+/g);
  const zh = zhMatch ? zhMatch.join('') : '';
  const en = text.replace(/[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/g, '').trim();
  return { zh: zh.trim(), en };
}

// UTC 时间戳
function getTimestamp() {
  return new Date().toISOString();
}

module.exports = (req, res) => {
  // 处理 CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { type, line, mode } = req.query;
  const total = lines.length;

  // 数据为空
  if (total === 0) {
    const errMsg = '数据文件为空或加载失败';
    if (type === 'text') {
      res.status(500).setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.send(`Error: ${errMsg}`);
    }
    return res.status(500).json({ code: 500, msg: errMsg });
  }

  // 处理行号
  let idx;
  if (line !== undefined) {
    const parsed = parseInt(line, 10);
    if (isNaN(parsed) || !isFinite(parsed)) {
      // 非数字 → 随机（兼容）
      idx = secureRandomInt(total);
    } else if (parsed < 0 || parsed >= total) {
      // 越界 → 返回错误
      const errMsg = `行号 ${parsed} 超出范围，有效范围 0-${total-1}`;
      if (type === 'text') {
        res.status(400).setHeader('Content-Type', 'text/plain; charset=utf-8');
        return res.send(`Error: ${errMsg}`);
      }
      return res.status(400).json({ code: 400, msg: errMsg });
    } else {
      idx = parsed;
    }
  } else {
    idx = secureRandomInt(total);
  }

  const original = lines[idx];
  const { zh, en } = splitZhEn(original);

  // JSON 模式（默认）
  if (type !== 'text') {
    return res.json({
      code: 200,
      line: idx,
      original,
      zh,
      en,
      time: getTimestamp()
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
    content = original; // both 或未知
  }
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.send(content);
};
