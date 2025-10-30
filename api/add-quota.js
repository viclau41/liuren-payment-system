import getRedis from './redis.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: '只允许 POST 请求' });
  }

  const { password, code, additionalUses } = req.body;

  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(403).json({ success: false, error: '管理密码错误' });
  }

  if (!code || !additionalUses) {
    return res.status(400).json({ success: false, error: '缺少必要参数' });
  }

  try {
    const redis = getRedis();
    const quotaKey = `quota:${code.toUpperCase()}`;
    const quotaDataStr = await redis.get(quotaKey);

    if (!quotaDataStr) {
      return res.status(404).json({ success: false, error: '起卦码不存在' });
    }

    const quotaData = JSON.parse(quotaDataStr);
    quotaData.totalUses += parseInt(additionalUses);

    await redis.set(quotaKey, JSON.stringify(quotaData), 'EX', 90 * 24 * 60 * 60); // 保持90天过期

    return res.status(200).json({
      success: true,
      code: code.toUpperCase(),
      newTotal: quotaData.totalUses,
      remaining: quotaData.totalUses - quotaData.usedCount
    });
  } catch (error) {
    console.error('增加配额错误:', error);
    return res.status(500).json({ success: false, error: '服务器错误' });
  }
}
