import fetch from 'node-fetch';

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
        const { orderID, planType, phone } = req.body;

        if (!orderID || !planType || !phone) {
            return res.status(400).json({
                error: '缺少必要參數'
            });
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

        if (!captureResponse.ok) {
            console.error('PayPal 捕獲訂單失敗:', captureData);
            return res.status(500).json({
                error: 'PayPal 付款失敗',
                details: captureData
            });
        }

        // 付款成功，調用內部 API 創建起卦碼
        const createCodeResponse = await fetch(
            `${req.headers.origin || 'http://localhost:3000'}/api/create-code`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    planType: planType,
                    phone: phone
                })
            }
        );

        const createCodeData = await createCodeResponse.json();

        if (!createCodeData.success) {
            console.error('創建起卦碼失敗:', createCodeData);
            return res.status(500).json({
                error: '創建起卦碼失敗',
                details: createCodeData
            });
        }

        return res.status(200).json({
            success: true,
            paypalOrderId: orderID,
            code: createCodeData.code,
            total: createCodeData.total,
            remaining: createCodeData.remaining,
            phone: phone,
            initialPassword: createCodeData.initialPassword,
            message: createCodeData.message
        });

    } catch (error) {
        console.error('捕獲 PayPal 訂單錯誤:', error);
        return res.status(500).json({
            error: '服務器錯誤',
            message: error.message
        });
    }
}
