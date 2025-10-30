import { kv } from '@vercel/kv';

// 管理员密码（从环境变量读取）
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'laucheukhungdjvdjv';

export default async function handler(req, res) {
    // 只允许 POST 请求
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: '只允許 POST 請求' });
    }

    try {
        const { password, code, additionalUses } = req.body;

        // 验证管理员密码
        if (password !== ADMIN_PASSWORD) {
            return res.status(401).json({ success: false, error: '密碼錯誤' });
        }

        if (!code) {
            return res.status(400).json({ success: false, error: '請提供起卦碼' });
        }

        if (!additionalUses || additionalUses <= 0) {
            return res.status(400).json({ success: false, error: '請提供有效的增加次數' });
        }

        const quotaKey = `quota:${code.toUpperCase()}`;
        const quotaData = await kv.get(quotaKey);

        if (!quotaData) {
            return res.status(404).json({ success: false, error: '起卦碼不存在' });
        }

        // 增加总次数
        quotaData.totalUses += parseInt(additionalUses);

        // 更新到 KV
        await kv.set(quotaKey, quotaData);

        // 记录增加日志
        await kv.set(`log:add:${code.toUpperCase()}:${Date.now()}`, {
            timestamp: new Date().toISOString(),
            action: 'add_quota',
            additionalUses: parseInt(additionalUses),
            newTotal: quotaData.totalUses
        }, { ex: 2592000 }); // 30天过期

        return res.status(200).json({
            success: true,
            accessCode: code.toUpperCase(),
            totalUses: quotaData.totalUses,
            usedCount: quotaData.usedCount,
            remaining: quotaData.totalUses - quotaData.usedCount,
            message: `成功增加 ${additionalUses} 次`
        });

    } catch (error) {
        console.error('增加配額錯誤:', error);
        return res.status(500).json({
            success: false,
            error: '服務器錯誤，請稍後再試'
        });
    }
}
