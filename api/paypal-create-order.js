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
        const { planType, amount } = req.body;

        // ✅ 使用前端傳來的金額
        let description = '';
        if (planType === 'single') {
            description = '大六壬智慧排盤 - 單次起卦 (測試)';
        } else if (planType === 'triple') {
            description = '大六壬智慧排盤 - 3次套餐+送2次 (測試)';
        } else {
            return res.status(400).json({ error: '無效的方案類型' });
        }

        const accessToken = await getPayPalAccessToken();

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
                        value: amount.toFixed(2)  // ✅ 使用前端傳來的金額
                    },
                    description: description
                }]
            })
        });

        const orderData = await orderResponse.json();

        if (!orderResponse.ok) {
            console.error('PayPal 錯誤:', orderData);
            return res.status(500).json({ error: 'PayPal 錯誤', details: orderData });
        }

        return res.status(200).json({ id: orderData.id });

    } catch (error) {
        console.error('創建訂單錯誤:', error);
        return res.status(500).json({ error: '服務器錯誤', message: error.message });
    }
}
