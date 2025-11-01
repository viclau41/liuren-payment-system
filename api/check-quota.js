import getRedis from './redis.js';

// 簡單的密碼哈希（使用 SHA-256）
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}

export default async function handler(req, res) {
    // CORS 設置
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { code, password } = req.body;

        if (!code) {
            return res.status(400).json({
                success: false,
                error: '請提供起卦碼'
            });
        }

        if (!password) {
            return res.status(400).json({
                success: false,
                error: '請提供密碼'
            });
        }

        const redis = getRedis();
        const quotaKey = `quota:${code.toUpperCase()}`;
        const quotaDataStr = await redis.get(quotaKey);

        if (!quotaDataStr) {
            return res.status(404).json({
                success: false,
                error: '起卦碼不存在或已過期'
            });
        }

        const quotaData = JSON.parse(quotaDataStr);

        // 驗證密碼
        const hashedInputPassword = await hashPassword(password);
        if (hashedInputPassword !== quotaData.password) {
            return res.status(401).json({
                success: false,
                error: '密碼錯誤'
            });
        }

        // 檢查是否過期
        if (new Date(quotaData.expiresAt) < new Date()) {
            return res.status(403).json({
                success: false,
                error: '起卦碼已過期'
            });
        }

        // 檢查剩餘次數
        if (quotaData.remaining <= 0) {
            return res.status(403).json({
                success: false,
                error: '起卦次數已用完',
                remaining: 0
            });
        }

        return res.status(200).json({
            success: true,
            code: quotaData.code,
            total: quotaData.total,
            remaining: quotaData.remaining,
            phone: quotaData.phone.replace(/(\d{4})\d{4}(\d{4})/, '$1****$2'), // 隱藏部分手機號碼
            createdAt: quotaData.createdAt,
            expiresAt: quotaData.expiresAt
        });

    } catch (error) {
        console.error('檢查配額錯誤:', error);
        return res.status(500).json({
            success: false,
            error: '服務器錯誤'
        });
    }
}
