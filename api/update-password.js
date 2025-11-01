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
        const { code, oldPassword, newPassword } = req.body;

        if (!code || !oldPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                error: '請提供起卦碼、舊密碼和新密碼'
            });
        }

        // 驗證新密碼格式
        if (!/^\d{6,}$/.test(newPassword)) {
            return res.status(400).json({
                success: false,
                error: '新密碼必須至少6位數字'
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

        // 驗證舊密碼
        const hashedOldPassword = await hashPassword(oldPassword);
        if (hashedOldPassword !== quotaData.password) {
            return res.status(401).json({
                success: false,
                error: '舊密碼錯誤'
            });
        }

        // 更新密碼
        const hashedNewPassword = await hashPassword(newPassword);
        quotaData.password = hashedNewPassword;
        quotaData.passwordUpdatedAt = new Date().toISOString();

        await redis.set(quotaKey, JSON.stringify(quotaData));

        return res.status(200).json({
            success: true,
            message: '密碼修改成功'
        });

    } catch (error) {
        console.error('修改密碼錯誤:', error);
        return res.status(500).json({
            success: false,
            error: '服務器錯誤'
        });
    }
}
