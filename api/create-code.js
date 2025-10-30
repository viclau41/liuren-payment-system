import { kv } from '@vercel/kv';

// 管理员密码（从环境变量读取）
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'laucheukhungdjvdjv';

// 生成起卦码
function generateAccessCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const parts = [4, 4, 4];
    return 'LR-' + parts.map(len =>
        Array.from({ length: len }, () =>
            chars[Math.floor(Math.random() * chars.length)]
        ).join('')
    ).join('-');
}

export default async function handler(req, res) {
    // 只允许 POST 请求
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: '只允許 POST 請求' });
    }

    try {
        const { password, email, totalUses = 5, expiryDays = 365 } = req.body;

        // 验证管理员密码
        if (password !== ADMIN_PASSWORD) {
            return res.status(401).json({ success: false, error: '密碼錯誤' });
        }

        // 生成唯一起卦码
        let accessCode;
        let attempts = 0;
        do {
            accessCode = generateAccessCode();
            attempts++;
            if (attempts > 10) {
                throw new Error('生成起卦碼失敗，請重試');
            }
        } while (await kv.exists(`quota:${accessCode}`));

        // 计算过期时间
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + expiryDays);

        // 创建配额数据
        const quotaData = {
            accessCode,
            totalUses: parseInt(totalUses),
            usedCount: 0,
            email: email || '',
            createdAt: new Date().toISOString(),
            expiresAt: expiresAt.toISOString(),
            lastUsedAt: null
        };

        // 保存到 KV（永久保存，直到手动删除）
        await kv.set(`quota:${accessCode}`, quotaData);

        // 记录创建日志
        await kv.set(`log:create:${accessCode}`, {
            timestamp: new Date().toISOString(),
            action: 'create_code',
            totalUses,
            email
        }, { ex: 2592000 }); // 30天过期

        return res.status(200).json({
            success: true,
            accessCode,
            totalUses: quotaData.totalUses,
            expiresAt: quotaData.expiresAt,
            message: '起卦碼生成成功'
        });

    } catch (error) {
        console.error('創建起卦碼錯誤:', error);
        return res.status(500).json({
            success: false,
            error: error.message || '服務器錯誤'
        });
    }
}
