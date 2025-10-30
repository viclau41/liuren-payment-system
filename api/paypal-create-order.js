import fetch from 'node-fetch';

// PayPal 配置（从环境变量读取）
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

export default async function handler(req, res) {
    // 只允许 POST 请求
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: '只允許 POST 請求' });
    }

    try {
        const accessToken = await getPayPalAccessToken();

        // 创建 PayPal 订单
        const orderResponse = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                intent: 'CAPTURE',
                purchase_units: [{
                    amount: {
                        currency_code: 'HKD',
                        value: '1000.00'
                    },
                    description: '大六壬智慧排盤 - 5次起卦服務'
                }]
            })
        });

        const orderData = await orderResponse.json();

        if (!orderResponse.ok) {
            throw new Error(orderData.message || 'PayPal 訂單創建失敗');
        }

        return res.status(200).json({
            success: true,
            orderID: orderData.id
        });

    } catch (error) {
        console.error('創建 PayPal 訂單錯誤:', error);
        return res.status(500).json({
            success: false,
            error: error.message || '服務器錯誤'
        });
    }
}
