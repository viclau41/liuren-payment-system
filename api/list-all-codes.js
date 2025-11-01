import { createClient } from '@vercel/kv';

export default async function handler(req, res) {
  // CORS 設置
  const allowedOrigins = [
    'https://victorlau.myqnapcloud.com',
    'https://liuren-payment-victor.vercel.app'
  ];

  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', 'https://victorlau.myqnapcloud.com');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { adminPassword } = req.body;

    // 驗證管理員密碼
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'your-admin-password';
    if (adminPassword !== ADMIN_PASSWORD) {
      return res.status(403).json({ error: '管理員密碼錯誤' });
    }

    const redis = createClient({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    });

    // 獲取所有以 quota: 開頭的 key
    const pattern = 'quota:LR-*';
    const allKeys = await redis.keys(pattern);

    if (!allKeys || allKeys.length === 0) {
      return res.status(200).json({ codes: [] });
    }

    // 獲取所有起卦碼的詳細資料
    const allCodes = [];

    for (const key of allKeys) {
      try {
        const data = await redis.get(key);

        if (data) {
          const code = key.replace('quota:', '');

          allCodes.push({
            code: code,
            phone: data.phone || '未提供',
            totalUses: data.totalUses || 0,
            usedCount: data.usedCount || 0,
            remaining: (data.totalUses || 0) - (data.usedCount || 0),
            createdAt: data.createdAt || '未知',
            expiryDays: data.expiryDays || 180,
            createdDate: data.createdAt ? new Date(data.createdAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }) : '未知'
          });
        }
      } catch (err) {
        console.error(`Error reading key ${key}:`, err);
      }
    }

    // 按創建時間排序（最新的在前）
    allCodes.sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    });

    return res.status(200).json({
      success: true,
      total: allCodes.length,
      codes: allCodes
    });

  } catch (error) {
    console.error('❌ list-all-codes error:', error);
    return res.status(500).json({
      error: '獲取起卦碼列表失敗',
      message: error.message
    });
  }
}
