# 🧮 大六壬智慧排盤 - 付費起卦系統

Victor AI 主理的專業六壬起卦服務，支持 PayPal 和轉數快付款。

---

## ✨ 功能特點

### 💰 多種付款方式
- **PayPal / 信用卡**：即時自動發碼
- **轉數快 FPS**：手動發碼
- **PayMe**：手動發碼

### 🎯 核心功能
- ✅ 付費起卦系統（HKD 1,000 / 5次）
- ✅ 起卦碼管理（生成、驗證、扣除）
- ✅ Victor AI 專業分析
- ✅ 管理後台（手動發碼、增加次數）
- ✅ 自動次數扣除
- ✅ 起卦碼過期管理

### 🔐 安全特性
- 起卦碼加密存儲
- 管理員密碼保護
- PayPal 安全驗證
- API 請求驗證

---

## 📁 文件結構

```
/
├── index.html              # 付款選擇頁面
├── divination.html         # 起卦頁面（需起卦碼）
├── admin.html              # 管理後台
├── api/
│   ├── check-quota.js      # 檢查起卦碼剩餘次數
│   ├── use-quota.js        # 扣除起卦次數
│   ├── create-code.js      # 生成新起卦碼（管理員）
│   ├── add-quota.js        # 增加起卦次數（管理員）
│   ├── paypal-create-order.js   # 創建 PayPal 訂單
│   └── paypal-capture-order.js  # 處理 PayPal 付款
├── package.json            # 依賴配置
├── vercel.json             # Vercel 配置
├── DEPLOYMENT.md           # 部署指南（詳細）
└── README.md               # 本文件
```

---

## 🚀 快速開始

### 1. 克隆項目

```bash
git clone <your-repo-url>
cd liuren-divination
```

### 2. 安裝依賴

```bash
npm install
```

### 3. 配置環境變量

創建 `.env.local` 文件：

```env
ADMIN_PASSWORD=your-secure-password
PAYPAL_CLIENT_ID=your-paypal-client-id
PAYPAL_CLIENT_SECRET=your-paypal-secret
PAYPAL_SANDBOX=true  # 測試環境用 true，正式環境用 false
```

### 4. 本地測試

```bash
vercel dev
```

訪問 `http://localhost:3000`

### 5. 部署到 Vercel

```bash
vercel --prod
```

**詳細部署步驟請查看 [DEPLOYMENT.md](./DEPLOYMENT.md)**

---

## 💡 使用說明

### 客戶端流程

1. **付款**
   - 訪問首頁選擇付款方式
   - PayPal 付款 → 立即獲得起卦碼
   - 轉數快/PayMe → WhatsApp 聯絡獲取起卦碼

2. **起卦**
   - 輸入起卦碼進入起卦頁面
   - 填寫占問事項和時間
   - 開始排盤與 AI 分析

3. **查看報告**
   - 獲得永久報告連結
   - 可隨時與 AI 追問

### 管理員流程

1. **登入後台**
   - 訪問 `/admin.html`
   - 輸入管理員密碼

2. **生成起卦碼**
   - 手動為客戶生成起卦碼
   - 選擇次數（5/10/20/50次）
   - 可選填客戶郵箱

3. **增加次數**
   - 為現有起卦碼增加次數
   - 適用於續費客戶

4. **查詢狀態**
   - 查看起卦碼剩餘次數
   - 檢查使用記錄

---

## 🛠️ 技術棧

- **前端**：HTML + TailwindCSS + JavaScript
- **後端**：Vercel Serverless Functions (Node.js)
- **數據庫**：Vercel KV (Redis)
- **付款**：PayPal REST API
- **AI 分析**：Claude-Sonnet-4.5 (via Poe API)

---

## 💰 定價設置

當前定價：
- **HKD 1,000** = 5次起卦（3次 + 新客送2次）

修改價格：
1. 編輯 `api/paypal-create-order.js` 第 40 行
2. 編輯 `index.html` 第 252 行（顯示價格）
3. 編輯 `index.html` 第 283 行（轉數快金額）

---

## 🔒 安全建議

1. **立即修改管理員密碼**
   - 在 Vercel 環境變量中設置強密碼
   - 至少 16 位，包含大小寫字母、數字、符號

2. **使用 HTTPS**
   - Vercel 自動提供 SSL 證書
   - 確保所有頁面使用 HTTPS

3. **定期備份數據**
   - 可通過 Vercel KV API 導出數據
   - 建議每月備份一次

4. **監控 API 使用**
   - 在 Vercel Dashboard 查看 API 調用量
   - 設置異常告警

---

## 📞 聯絡方式

**轉數快 / PayMe 付款後請聯絡：**
- 轉數快號碼：66381789 / 61883889
- PayPal：viclau41@hotmail.com

---

## 📄 授權

© 2025 Victor AI 主理 · 版權所有

---

## 🙏 致謝

- **六壬計算 API**：liuren-api.vercel.app
- **AI 分析**：Poe API (Claude-Sonnet-4.5)
- **付款處理**：PayPal
- **託管平台**：Vercel

---

**祝生意興隆！** 🎉
