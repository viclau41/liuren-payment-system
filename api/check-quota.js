// ✅ 檢查配額 API（帶密碼驗證）
import { createClient } from '@vercel/kv';

export default async function handler(req, res) {
    // ✅ CORS 設置：允許多個域名訪問
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

    // ✅ 處理預檢請求
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { code, password } = req.body;

        // ✅ 驗證起卦碼格式
        if (!code || !/^LR-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code)) {
            return res.status(400).json({
                error: '起卦碼格式錯誤',
                message: '請輸入正確的起卦碼格式 (LR-XXXX-XXXX)'
            });
        }

        // ✅ 驗證密碼（至少6位數字）
        if (!password || password.length < 6 || !/^\d+$/.test(password)) {
            return res.status(400).json({
                error: '密碼格式錯誤',
                message: '密碼必須至少6位數字'
            });
        }

        // ✅ 連接 Redis
        const redis = createClient({
            url: process.env.KV_REST_API_URL,
            token: process.env.KV_REST_API_TOKEN,
        });

        // ✅ 查詢起卦碼數據
        const key = `quota:${code}`;
        const data = await redis.get(key);

        if (!data) {
            return res.status(404).json({
                error: '起卦碼不存在',
                message: '此起卦碼無效或已過期'
            });
        }

        // ✅ 驗證密碼
        const storedPassword = data.password || data.phone?.slice(-6); // 默認密碼為手機號後6位

        if (password !== storedPassword) {
            console.log(`❌ 密碼驗證失敗 - 起卦碼: ${code}`);
            return res.status(403).json({
                error: '密碼錯誤',
                message: '請輸入正確的密碼',
                isPasswordError: true
            });
        }

        // ✅ 密碼正確，返回配額信息
        const remaining = data.remaining || 0;
        const total = data.total || 0;
        const phone = data.phone || '';
        const createdAt = data.createdAt || '';

        console.log(`✅ 配額查詢成功 - 起卦碼: ${code}, 剩餘: ${remaining}/${total}`);

        return res.status(200).json({
            success: true,
            code: code,
            remaining: remaining,
            total: total,
            phone: phone.replace(/(\d{4})\d{4}(\d{4})/, '$1****$2'), // 手機號碼遮罩顯示
            createdAt: createdAt
        });

    } catch (error) {
        console.error('❌ 檢查配額失敗:', error);
        return res.status(500).json({
            error: '系統錯誤',
            message: '檢查配額時發生錯誤，請稍後再試',
            details: error.message
        });
    }
}
