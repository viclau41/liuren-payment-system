import getRedis from './redis.js';

function generateAccessCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const part1 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  const part2 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `LR-${part1}-${part2}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: '只允许 POST 请求' });
  }

  const { password, email, totalUses = 5 } = req.body;

  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(403).json({ success: false, error: '管理密码错误' });
  }

  try {
    const redis = getRedis();
    let code;
    let attempts = 0;
    const maxAttempts = 10;

    // 生成唯一起卦码
    do {
      code = generateAccessCode();
      attempts++;
      if (attempts > maxAttempts) {
        return res.status(500).json({ success: false, error: '无法生成唯一起卦码' });
      }
    } while (await redis.exists(`quota:${code}`));

    const quotaData = {
      code,
      email: email || '',
      totalUses: parseInt(totalUses),
      usedCount: 0,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90天后过期
      lastUsedAt: null
    };

    await redis.set(`quota:${code}`, JSON.stringify(quotaData), 'EX', 90 * 24 * 60 * 60); // 90天过期

    return res.status(200).json({
      success: true,
      code,
      totalUses: quotaData.totalUses,
      expiresAt: quotaData.expiresAt
    });
  } catch (error) {
    console.error('创建起卦码错误:', error);
    return res.status(500).json({ success: false, error: '服务器错误' });
  }
}
