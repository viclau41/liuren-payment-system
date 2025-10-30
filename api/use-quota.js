import getRedis from './redis.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: '只允许 POST 请求' });
  }

  const { code } = req.body;

  if (!code) {
    return res.status(400).json({ success: false, error: '缺少起卦码' });
  }

  try {
    const redis = getRedis();
    const quotaKey = `quota:${code.toUpperCase()}`;
    const quotaDataStr = await redis.get(quotaKey);

    if (!quotaDataStr) {
      return res.status(404).json({ success: false, error: '起卦码不存在或已过期' });
    }

    const quotaData = JSON.parse(quotaDataStr);

    // 检查过期时间
    if (quotaData.expiresAt && new Date(quotaData.expiresAt) < new Date()) {
      return res.status(403).json({ success: false, error: '起卦码已过期' });
    }

    // 检查剩余次数
    if (quotaData.usedCount >= quotaData.totalUses) {
      return res.status(403).json({ success: false, error: '起卦次数已用完' });
    }

    // 更新使用次数
    quotaData.usedCount += 1;
    quotaData.lastUsedAt = new Date().toISOString();

    await redis.set(quotaKey, JSON.stringify(quotaData));

    // 记录使用日志
    const logKey = `log:${code.toUpperCase()}:${Date.now()}`;
    await redis.set(logKey, JSON.stringify({
      code: code.toUpperCase(),
      usedAt: quotaData.lastUsedAt,
      remainingUses: quotaData.totalUses - quotaData.usedCount
    }), 'EX', 90 * 24 * 60 * 60); // 90天过期

    const remaining = quotaData.totalUses - quotaData.usedCount;

    return res.status(200).json({
      success: true,
      remaining,
      total: quotaData.totalUses,
      used: quotaData.usedCount
    });
  } catch (error) {
    console.error('使用配额错误:', error);
    return res.status(500).json({ success: false, error: '服务器错误' });
  }
}
