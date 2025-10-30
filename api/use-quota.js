import { kv } from '@vercel/kv';

export default async function handler(req, res) {
    // 只允许 POST 请求
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: '只允許 POST 請求' });
    }

    try {
        const { code } = req.body;

        if (!code) {
            return res.status(400).json({ success: false, error: '請提供起卦碼' });
        }

        const quotaKey = `quota:${code.toUpperCase()}`;
        const quotaData = await kv.get(quotaKey);

        if (!quotaData) {
            return res.status(404).json({ success: false, error: '起卦碼不存在' });
        }

        // 检查是否过期
        if (quotaData.expiresAt && new Date(quotaData.expiresAt) < new Date()) {
            return res.status(410).json({ success: false, error: '起卦碼已過期' });
        }

        // 检查剩余次数
        const remaining = quotaData.totalUses - quotaData.usedCount;
        if (remaining <= 0) {
            return res.status(403).json({ success: false, error: '起卦次數已用完' });
        }

        // 扣除次数
        quotaData.usedCount += 1;
        quotaData.lastUsedAt = new Date().toISOString();

        // 更新到 KV
        await kv.set(quotaKey, quotaData);

        // 记录使用日志
        const logKey = `log:${code.toUpperCase()}:${Date.now()}`;
        await kv.set(logKey, {
            timestamp: new Date().toISOString(),
            action: 'use_quota',
            remaining: quotaData.totalUses - quotaData.usedCount
        }, { ex: 2592000 }); // 30天过期

        return res.status(200).json({
            success: true,
            remaining: quotaData.totalUses - quotaData.usedCount,
            used: quotaData.usedCount,
            total: quotaData.totalUses
        });

    } catch (error) {
        console.error('扣除配額錯誤:', error);
        return res.status(500).json({
            success: false,
            error: '服務器錯誤，請稍後再試'
        });
    }
}
