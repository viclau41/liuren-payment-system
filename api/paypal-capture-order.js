import fetch from 'node-fetch';
import getRedis from './redis.js';

const PAYPAL_API_BASE = process.env.PAYPAL_MODE === 'production'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

async function getPayPalAccessToken() {
    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

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

function generateAccessCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
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

function generateInitialPassword(phone) {
    if (phone && phone.length >= 6) {
        return phone.slice(-6);
    }
    return '000000';
}

export default async function handler(req, res) {
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
        const { orderID, planType, phone } = req.body;

        if (!orderID || !planType || !phone) {
            return res.status(400).json({ error: '缺少必要參數' });
        }

        // 獲取 PayPal Access Token
        const accessToken = await getPayPalAccessToken();

        // 捕獲付款
        const captureResponse = await fetch(
            `${PAYPAL_API_BASE}/v2/checkout/orders/${orderID}/capture`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`
                }
            }
        );

        const captureData = await captureResponse.json();

        if (captureData.status !== 'COMPLETED') {
            return res.status(400).json({
                success: false,
                error: '付款未完成'
            });
        }

        // 生成起卦碼和初始密碼
        const code = generateAccessCode();
        const initialPassword = generateInitialPassword(phone);

        // 計算次數
        let quota = 0;
        if (planType === 'single') {
            quota = 1;
        } else if (planType === 'triple') {
            quota = 5; // 3次 + 送2次
        }

        // 保存到 Redis
        const redis = getRedis();
        const quotaKey = `quota:${code}`;
        const quotaData = {
            code: code,
            total: quota,
            remaining: quota,
            phone: phone,
            password: initialPassword, // 初始密碼
            planType: planType,
            createdAt: new Date().toISOString(),
            paypalOrderId: orderID,
            expiresAt: null // 永久有效
        };

        await redis.set(quotaKey, JSON.stringify(quotaData));

        return res.status(200).json({
            success: true,
            code: code,
            quota: quota,
            phone: phone,
            // 注意：不返回密碼給前端，前端自己生成
            message: `起卦碼已生成，初始密碼為手機號碼後6位：${initialPassword}`
        });

    } catch (error) {
        console.error('捕獲 PayPal 訂單錯誤:', error);
        return res.status(500).json({
            success: false,
            error: '服務器錯誤',
            message: error.message
        });
    }
}
