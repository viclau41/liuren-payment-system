import fetch from 'node-fetch';
import { kv } from '@vercel/kv';

// PayPal 配置
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
const PAYPAL_API_BASE = process.env.PAYPAL_SANDBOX === 'true'
    ? 'https://api-m.sandbox.paypal.com'
    : 'https://api-m.paypal.com';

// 获取 PayPal Access Token
async function getPayPalAccessToken() {
    const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');

    const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'grant_type=client_credentials'
    });

    const data = await response.json();
    return data.access_token;
}

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
        const { orderID } = req.body;

        if (!orderID) {
            return res.status(400).json({ success: false, error: '缺少訂單 ID' });
        }

        const accessToken = await getPayPalAccessToken();

        // 捕获 PayPal 付款
        const captureResponse = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders/${orderID}/capture`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        const captureData = await captureResponse.json();

        if (!captureResponse.ok || captureData.status !== 'COMPLETED') {
            throw new Error('付款未成功');
        }

        // 提取付款人信息
        const payerEmail = captureData.payer?.email_address || '';

        // 生成唯一起卦码
        let accessCode;
        let attempts = 0;
        do {
            accessCode = generateAccessCode();
            attempts++;
            if (attempts > 10) {
                throw new Error('生成起卦碼失敗');
            }
        } while (await kv.exists(`quota:${accessCode}`));

        // 计算过期时间（365天）
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 365);

        // 创建配额数据
        const quotaData = {
            accessCode,
            totalUses: 5, // 3次 + 新客送2次
            usedCount: 0,
            email: payerEmail,
            createdAt: new Date().toISOString(),
            expiresAt: expiresAt.toISOString(),
            lastUsedAt: null,
            paypalOrderID: orderID,
            paymentMethod: 'paypal'
        };

        // 保存到 KV
        await kv.set(`quota:${accessCode}`, quotaData);

        // 记录付款日志
        await kv.set(`log:paypal:${orderID}`, {
            timestamp: new Date().toISOString(),
            action: 'paypal_payment',
            orderID,
            accessCode,
            email: payerEmail,
            amount: '1000 HKD'
        }, { ex: 2592000 }); // 30天过期

        return res.status(200).json({
            success: true,
            accessCode,
            remaining: 5,
            totalUses: 5,
            message: '付款成功，起卦碼已生成'
        });

    } catch (error) {
        console.error('處理 PayPal 付款錯誤:', error);
        return res.status(500).json({
            success: false,
            error: error.message || '處理付款失敗'
        });
    }
}
