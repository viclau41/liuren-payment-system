// ✅ PayPal 捕獲訂單並創建起卦碼（保存電話號碼和密碼）
import { createClient } from '@vercel/kv';

// ✅ 生成隨機起卦碼 (LR-XXXX-XXXX)
function generateAccessCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 排除易混淆字符
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

export default async function handler(req, res) {
    // ✅ CORS 設置
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

    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { orderID, phone } = req.body;

        if (!orderID) {
            return res.status(400).json({ error: '缺少 orderID' });
        }

        // ✅ 驗證手機號碼格式（需要至少8位數字）
        if (!phone || phone.length < 8 || !/^\d+$/.test(phone)) {
            return res.status(400).json({
                error: '手機號碼格式錯誤',
                message: '請輸入至少8位數字的有效手機號碼'
            });
        }

        // ✅ PayPal 捕獲訂單
        const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
        const PAYPAL_SECRET = process.env.PAYPAL_SECRET;
        const PAYPAL_API_BASE = process.env.PAYPAL_MODE === 'production'
            ? 'https://api-m.paypal.com'
            : 'https://api-m.sandbox.paypal.com';

        // 獲取 Access Token
        const authResponse = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`).toString('base64')}`
            },
            body: 'grant_type=client_credentials'
        });

        const authData = await authResponse.json();
        const accessToken = authData.access_token;

        // 捕獲訂單
        const captureResponse = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders/${orderID}/capture`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            }
        });

        const captureData = await captureResponse.json();

        if (captureData.status !== 'COMPLETED') {
            console.error('❌ PayPal 捕獲失敗:', captureData);
            return res.status(400).json({
                error: '付款捕獲失敗',
                message: '無法完成付款，請聯絡客服',
                details: captureData
            });
        }

        // ✅ 付款成功，提取金額
        const amount = parseFloat(captureData.purchase_units[0].amount.value);

        // ✅ 根據金額確定配額
        let quota = 0;
        if (amount <= 1.5) { // 測試模式單次 (1 HKD)
            quota = 1;
        } else if (amount <= 15) { // 測試模式3次 (10 HKD)
            quota = 5; // 3次 + 送2次
        } else if (amount <= 500) { // 生產模式單次 (399 HKD)
            quota = 1;
        } else { // 生產模式3次 (1000 HKD)
            quota = 5; // 3次 + 送2次
        }

        // ✅ 生成起卦碼
        let accessCode = generateAccessCode();

        // ✅ 確保起卦碼唯一（最多嘗試10次）
        const redis = createClient({
            url: process.env.KV_REST_API_URL,
            token: process.env.KV_REST_API_TOKEN,
        });

        let attempts = 0;
        while (attempts < 10) {
            const existing = await redis.get(`quota:${accessCode}`);
            if (!existing) break;
            accessCode = generateAccessCode();
            attempts++;
        }

        if (attempts >= 10) {
            console.error('❌ 無法生成唯一起卦碼');
            return res.status(500).json({
                error: '系統錯誤',
                message: '無法生成起卦碼，請聯絡客服'
            });
        }

        // ✅ 生成默認密碼（手機號碼後6位）
        const defaultPassword = phone.slice(-6);

        // ✅ 保存到 Redis（有效期30天）
        const expirySeconds = 30 * 24 * 60 * 60; // 30天
        const data = {
            code: accessCode,
            remaining: quota,
            total: quota,
            phone: phone, // ✅ 保存手機號碼
            password: defaultPassword, // ✅ 保存默認密碼
            paypalOrderId: orderID,
            amount: amount,
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + expirySeconds * 1000).toISOString()
        };

        await redis.set(`quota:${accessCode}`, JSON.stringify(data), {
            ex: expirySeconds
        });

        console.log(`✅ 起卦碼創建成功 - ${accessCode}, 配額: ${quota}, 手機: ${phone}, 默認密碼: ${defaultPassword}`);

        // ✅ 返回成功
        return res.status(200).json({
            success: true,
            code: accessCode,
            quota: quota,
            phone: phone,
            defaultPassword: defaultPassword, // ✅ 返回默認密碼給前端顯示
            message: `付款成功！您的起卦碼已生成，有效期30天。默認密碼為手機號碼後6位：${defaultPassword}`
        });

    } catch (error) {
        console.error('❌ 捕獲訂單失敗:', error);
        return res.status(500).json({
            error: '系統錯誤',
            message: '處理付款時發生錯誤',
            details: error.message
        });
    }
}
