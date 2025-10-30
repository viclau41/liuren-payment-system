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

        // 从 Vercel KV 获取配额信息
        const quotaKey = `quota:${code.toUpperCase()}`;
        const quotaData = await kv.get(quotaKey);

        if (!quotaData) {
            return res.status(404).json({ success: false, error: '起卦碼不存在或已過期' });
        }

        // 检查是否过期
        if (quotaData.expiresAt && new Date(quotaData.expiresAt) < new Date()) {
            return res.status(410).json({ success: false, error: '起卦碼已過期' });
        }

        // 计算剩余次数
        const remaining = quotaData.totalUses - quotaData.usedCount;

        return res.status(200).json({
            success: true,
            remaining: remaining,
            total: quotaData.totalUses,
            used: quotaData.usedCount,
            createdAt: quotaData.createdAt
        });

    } catch (error) {
        console.error('檢查配額錯誤:', error);
        return res.status(500).json({
            success: false,
            error: '服務器錯誤，請稍後再試'
        });
    }
}
