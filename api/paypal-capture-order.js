import fetch from 'node-fetch';
import getRedis from './redis.js';

function generateAccessCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const part1 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  const part2 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `LR-${part1}-${part2}`;
}

async function getAccessToken() {
  const auth = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString('base64');

  const response = await fetch(
    `https://api-m.${process.env.PAYPAL_SANDBOX === 'true' ? 'sandbox.' : ''}paypal.com/v1/oauth2/token`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    }
  );

  const data = await response.json();
  return data.access_token;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: '只允许 POST 请求' });
  }

  const { orderID } = req.body;

  if (!orderID) {
    return res.status(400).json({ success: false, error: '缺少订单 ID' });
  }

  try {
    const accessToken = await getAccessToken();

    const response = await fetch(
      `https://api-m.${process.env.PAYPAL_SANDBOX === 'true' ? 'sandbox.' : ''}paypal.com/v2/checkout/orders/${orderID}/capture`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    const orderData = await response.json();

    if (orderData.status === 'COMPLETED') {
      const redis = getRedis();
      let code;
      let attempts = 0;
      const maxAttempts = 10;

      do {
        code = generateAccessCode();
        attempts++;
        if (attempts > maxAttempts) {
          return res.status(500).json({ success: false, error: '无法生成唯一起卦码' });
        }
      } while (await redis.exists(`quota:${code}`));

      const quotaData = {
        code,
        email: orderData.payer?.email_address || '',
        totalUses: 5,
        usedCount: 0,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        lastUsedAt: null,
        paypalOrderId: orderID,
        paymentAmount: orderData.purchase_units[0]?.amount?.value || '1000'
      };

      await redis.set(`quota:${code}`, JSON.stringify(quotaData), 'EX', 90 * 24 * 60 * 60);

      return res.status(200).json({
        success: true,
        code,
        orderData
      });
    } else {
      return res.status(400).json({
        success: false,
        error: '支付未完成',
        orderData
      });
    }
  } catch (error) {
    console.error('捕获订单错误:', error);
    return res.status(500).json({ success: false, error: '服务器错误' });
  }
}
