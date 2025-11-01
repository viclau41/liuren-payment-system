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
        const { planType, amount, phone } = req.body;

        // ✅ 驗證必要參數
        if (!planType || !amount || !phone) {
            return res.status(400).json({ error: '缺少必要參數' });
        }

        // ✅ 使用前端傳來的實際金額
        let actualAmount = parseFloat(amount);
        let description = '';

        // 根據 planType 設置描述
        if (planType === 'single') {
            description = '大六壬智慧排盤 - 單次起卦';
        } else if (planType === 'triple') {
            description = '大六壬智慧排盤 - 3次套餐 (送2次)';
        } else {
            return res.status(400).json({ error: '無效的方案類型' });
        }

        // 獲取 PayPal Access Token
        const accessToken = await getPayPalAccessToken();

        // 創建訂單
        const orderResponse = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({
                intent: 'CAPTURE',
                purchase_units: [{
                    amount: {
                        currency_code: 'HKD',
                        value: actualAmount.toFixed(2)  // ✅ 使用實際金額
                    },
                    description: description
                }],
                application_context: {
                    brand_name: 'Victor AI 大六壬',
                    landing_page: 'NO_PREFERENCE',
                    user_action: 'PAY_NOW'
                }
            })
        });

        const orderData = await orderResponse.json();

        if (!orderResponse.ok) {
            console.error('PayPal 訂單創建失敗:', orderData);
            return res.status(500).json({
                error: 'PayPal 訂單創建失敗',
                details: orderData
            });
        }

        return res.status(200).json({ id: orderData.id });

    } catch (error) {
        console.error('創建 PayPal 訂單錯誤:', error);
        return res.status(500).json({
            error: '服務器錯誤',
            message: error.message
        });
    }
}
