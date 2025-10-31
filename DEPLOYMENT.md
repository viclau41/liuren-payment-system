# 大六壬智慧排盤 - 部署指南

## 📋 系統概述

這是一個完整的付費起卦系統，包含：
- **前端**：付款頁面 + 起卦頁面 + 管理後台
- **後端**：Vercel Serverless Functions
- **數據庫**：Vercel KV（Redis）
- **付款**：PayPal 集成

---

## 🚀 部署步驟

### 步驟 1：準備 Vercel 賬號

1. 前往 [https://vercel.com](https://vercel.com)
2. 使用 GitHub 賬號登入
3. 確保你的 Domain 已經添加到 Vercel

### 步驟 2：開通 Vercel KV 數據庫

1. 登入 Vercel Dashboard
2. 點擊 **Storage** → **Create Database**
3. 選擇 **KV (Redis)**
4. 選擇 **Free Plan**（256MB 免費）
5. 創建數據庫

### 步驟 3：獲取 PayPal API 密鑰

#### 測試環境（Sandbox）：
1. 前往 [https://developer.paypal.com](https://developer.paypal.com)
2. 登入你的 PayPal 賬號
3. 進入 **Dashboard** → **Apps & Credentials**
4. 在 **Sandbox** 選項卡下，創建新應用
5. 獲取 **Client ID** 和 **Secret**

#### 正式環境（Live）：
1. 在 **Apps & Credentials** 頁面
2. 切換到 **Live** 選項卡
3. 創建新應用（需要完成 PayPal 企業認證）
4. 獲取 **Client ID** 和 **Secret**

### 步驟 4：部署到 Vercel

#### 方法 A：使用 Vercel CLI（推薦）

```bash
# 1. 安裝 Vercel CLI
npm install -g vercel

# 2. 進入項目目錄
cd /your/project/directory

# 3. 登入 Vercel
vercel login

# 4. 部署（首次部署會詢問配置）
vercel

# 5. 生產環境部署
vercel --prod
```

#### 方法 B：使用 GitHub 自動部署

1. 將代碼推送到 GitHub
2. 在 Vercel Dashboard 點擊 **New Project**
3. 選擇你的 GitHub repository
4. 點擊 **Deploy**

### 步驟 5：配置環境變量

在 Vercel Dashboard 中：

1. 進入你的項目
2. 點擊 **Settings** → **Environment Variables**
3. 添加以下變量：

```
ADMIN_PASSWORD = xxxxxxxxxxx
PAYPAL_CLIENT_ID = 你的PayPal Client ID
PAYPAL_CLIENT_SECRET = 你的PayPal Secret
PAYPAL_SANDBOX = false  （測試環境用 true，正式環境用 false）
```

4. 點擊 **Save**
5. **重新部署**項目（Settings → Deployments → Redeploy）

### 步驟 6：連接 Vercel KV 到項目

1. 在 Vercel Dashboard
2. 進入你的項目
3. 點擊 **Storage** → **Connect Store**
4. 選擇你剛創建的 KV 數據庫
5. 點擊 **Connect**

### 步驟 7：更新 PayPal Client ID

編輯 `index.html` 第 8 行：

```html
<!-- 將 YOUR_PAYPAL_CLIENT_ID 替換為你的實際 Client ID -->
<script src="https://www.paypal.com/sdk/js?client-id=YOUR_ACTUAL_CLIENT_ID&currency=HKD"></script>
```

然後重新部署。

### 步驟 8：綁定自定義域名

1. 在 Vercel Dashboard → **Settings** → **Domains**
2. 添加你的域名（例如：liuren.yourdomain.com）
3. 按照提示配置 DNS（添加 CNAME 記錄）
4. 等待 DNS 生效（通常 5-30 分鐘）

---

## 🎯 訪問系統

部署完成後，你可以訪問：

- **付款頁面**：`https://your-domain.com/`
- **起卦頁面**：`https://your-domain.com/divination.html`
- **管理後台**：`https://your-domain.com/admin.html`

---

## 🔧 測試系統

### 測試 PayPal 付款（Sandbox 模式）

1. 確保環境變量 `PAYPAL_SANDBOX=true`
2. 使用 PayPal Sandbox 測試賬號付款
3. 查看是否成功生成起卦碼

### 測試管理後台

1. 訪問 `https://your-domain.com/admin.html`
2. 使用密碼登入：`xxxxxxxxxxx`
3. 嘗試生成新起卦碼
4. 嘗試為現有碼增加次數

### 測試起卦功能

1. 在管理後台生成一個測試起卦碼
2. 訪問 `https://your-domain.com/`
3. 輸入起卦碼
4. 嘗試起卦

---

## ⚠️ 重要提醒

### 安全設置

1. **立即修改管理員密碼**
   - 編輯環境變量 `ADMIN_PASSWORD`
   - 設置一個強密碼（至少 16 位，包含大小寫字母、數字、符號）

2. **PayPal Webhook（可選，高級功能）**
   - 在 PayPal Developer 中設置 Webhook
   - 接收付款通知更加穩定

3. **定期備份數據**
   - Vercel KV 的數據是持久化的
   - 但建議定期導出重要數據

### 費用說明

- **Vercel**：免費方案足夠使用
- **Vercel KV**：免費 256MB（約可存儲 10 萬+ 記錄）
- **PayPal**：每筆交易收取 ~4.4% 手續費

---

## 📞 客戶聯絡方式

當客戶使用轉數快/PayMe 付款時，他們需要聯絡你：

- **轉數快號碼**：66381789 / 61883889
- **WhatsApp**：（請添加你的 WhatsApp 號碼）

收到付款截圖後，你可以：
1. 登入管理後台
2. 生成新起卦碼
3. 將起卦碼發送給客戶

---

## 🐛 常見問題

### Q: PayPal 付款失敗？
A: 檢查環境變量是否正確設置，確保 Client ID 和 Secret 匹配。

### Q: 起卦碼無法使用？
A: 在管理後台查詢起卦碼狀態，確認是否已過期或用完。

### Q: API 報錯 500？
A: 檢查 Vercel KV 是否已連接到項目。

### Q: 如何查看已生成的所有起卦碼？
A: 目前需要手動記錄或通過 Vercel KV 控制台查看。

---

## 📝 下一步優化建議

1. **添加郵件通知**：付款成功後自動發送起卦碼到客戶郵箱
2. **添加數據統計**：查看總收入、活躍碼數量等
3. **整合 Stripe**：支持更多信用卡付款
4. **客戶賬號系統**：允許客戶查看歷史訂單

---

## 💡 技術支持

如遇到問題，請檢查：
1. Vercel 部署日誌
2. 瀏覽器控制台錯誤
3. API 回應內容

---

**祝你部署順利！** 🎉
