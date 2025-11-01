import getRedis from './redis.js';

// 生成起卦碼（格式：LR-XXXX-XXXX）
function generateAccessCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'LR-';

    for (let i = 0; i < 4; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    code += '-';

    for (let i = 0; i < 4; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return code;
}

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
        const { planType, phone } = req.body;

        // 驗證手機號碼
        if (!phone || phone.length < 6) {
            return res.status(400).json({
                success: false,
                error: '請提供有效的手機號碼（至少6位）'
            });
        }

        // 驗證方案類型
        let quotaCount = 0;
        if (planType === 'single') {
            quotaCount = 1;
        } else if (planType === 'triple') {
            quotaCount = 5; // 3次 + 送2次
        } else {
            return res.status(400).json({
                success: false,
                error: '無效的方案類型'
            });
        }

        const redis = getRedis();

        // 生成唯一的起卦碼
        let accessCode;
        let exists = true;
        let attempts = 0;

        while (exists && attempts < 10) {
            accessCode = generateAccessCode();
            const quotaKey = `quota:${accessCode}`;
            const existingData = await redis.get(quotaKey);
            exists = existingData !== null;
            attempts++;
        }

        if (exists) {
            return res.status(500).json({
                success: false,
                error: '生成起卦碼失敗，請重試'
            });
        }

        // 生成初始密碼（手機號碼後6位）
        const initialPassword = phone.slice(-6);
        const hashedPassword = await hashPassword(initialPassword);

        // 創建起卦碼數據
        const quotaData = {
            code: accessCode,
            total: quotaCount,
            remaining: quotaCount,
            phone: phone,
            password: hashedPassword,
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90天有效期
            lastUsed: null
        };

        const quotaKey = `quota:${accessCode}`;
        await redis.set(quotaKey, JSON.stringify(quotaData));

        return res.status(200).json({
            success: true,
            code: accessCode,
            total: quotaCount,
            remaining: quotaCount,
            phone: phone,
            initialPassword: initialPassword, // ⚠️ 只在創建時返回一次
            message: `起卦碼創建成功！請妥善保管您的起卦碼和密碼。初始密碼為您的手機號碼後6位：${initialPassword}`
        });

    } catch (error) {
        console.error('創建起卦碼錯誤:', error);
        return res.status(500).json({
            success: false,
            error: '服務器錯誤'
        });
    }
}
