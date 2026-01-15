# Faturalama Mimarisi - Stripe Premium + Metered Billing

## 🎯 Mimari Prensipler

### Stripe = Fiyatlandırma & Faturalama
- Tüm faturalar Stripe'da oluşur ve saklanır
- Stripe otomatik ödeme toplar ve fatura gönderir
- Stripe metered billing ile token aşımlarını faturalar

### Backend = Token Sayımı & Erişim Kontrolü
- Ücretsiz token kotası backend'de yönetilir
- Token kullanımı her chat'te sayılır ve loglanır
- Harcama limitleri backend'de enforce edilir
- Kota aşıldığında kullanıcı engellenir

## 📦 Stripe Product Yapısı

### Tek Product: "ChatBu Premium"

**Price 1 - Base Subscription (Flat Recurring):**
- Price ID: `STRIPE_PREMIUM_BASE_PRICE_ID` 
- Type: `recurring` - `licensed`
- Interval: `month`
- Amount: 899 TRY (sabit aylık ücret)

**Price 2 - Token Overage (Metered Recurring):**
- Price ID: `STRIPE_PREMIUM_METERED_PRICE_ID`
- Type: `recurring` - `metered`
- Interval: `month`
- Unit Amount: 0.01 TRY per 1000 tokens
- Aggregation: `sum`

## 🔄 Subscription Lifecycle

### 1. Yeni Premium Üyelik
```typescript
stripe.checkout.sessions.create({
  line_items: [
    { price: STRIPE_PREMIUM_BASE_PRICE_ID, quantity: 1 },
    { price: STRIPE_PREMIUM_METERED_PRICE_ID }
  ]
})
```

Backend'de:
```typescript
{
  tier: 'PREMIUM',
  status: 'ACTIVE',
  monthlyTokenAllocation: 2000000,  // Ücretsiz token
  tokensUsedThisMonth: 0,
  spendingLimit: null  // Opsiyonel
}
```

### 2. Token Kullanımı

Her chat mesajında:
```typescript
1. Token sayısı hesaplanır
2. subscription.tokensUsedThisMonth += tokens
3. TokenUsageLog oluşturulur (cost hesaplanır)
4. Eğer ücretsiz kota aşıldıysa:
   - Stripe'a usage record gönderilir
   - Harcama limiti kontrol edilir
```

### 3. Fatura Dönemi Bitişi

Stripe webhook: `invoice.payment_succeeded`
```typescript
Backend:
- tokensUsedThisMonth = 0
- additionalTokensPurchased = 0
- currentPeriodStart = yeni period
- currentPeriodEnd = yeni period
- Hesabı unblock et (varsa)
```

### 4. Ödeme Başarısız

Stripe webhook: `invoice.payment_failed`
```typescript
Backend:
- accountBlocked = true
- subscription.status = 'PAST_DUE'
- Email gönder
```

## 💰 Token Aşımı ve Faturalama

### Senaryo: Kullanıcı ayda 2.5M token kullandı

**Ücretsiz Kota:** 2M token (dahil)
**Aşım:** 500K token

**Backend:**
```typescript
const baseAllocation = 2000000;
const overageTokens = 2500000 - 2000000; // 500K

if (overageTokens > 0) {
  const cost = (overageTokens / 1000) * 0.01; // 5 TRY
  
  // Spending limit kontrolü
  if (subscription.spendingLimit && cost > limit) {
    throw Error('Spending limit exceeded');
  }
  
  // Stripe'a bildir
  stripe.subscriptionItems.createUsageRecord({
    quantity: Math.ceil(overageTokens / 1000), // 500 units
    action: 'increment'
  });
}
```

**Stripe Faturası:**
- Base Fee: 899 TRY
- Token Overage (500 units × 0.01): 5 TRY
- **Toplam: 904 TRY**

## 🚨 Edge Cases

### 1. Webhook Gecikmesi
- Token kullanımı her zaman `TokenUsageLog`'a yazılır
- Stripe'a rapor gönderilemezse bile log kayıtlı kalır
- Fatura dönemi bitişinde Stripe'dan gelen period ile senkronize edilir

### 2. Payment Failed
- Hesap anında bloke edilir
- Kullanıcı chat yapamaz
- Email ile bilgilendirilir
- Ödeme yapılınca otomatik açılır

### 3. Subscription Cancel
- `cancel_at_period_end = true`
- Dönem sonuna kadar kullanabilir
- Token sayımı devam eder
- Dönem bitince FREE'ye düşer

### 4. Downgrade to FREE
- Stripe subscription silinir
- Backend: `tier = FREE`, `monthlyTokenAllocation = 100K`
- Premium özelliklere erişim kapanır

### 5. Spending Limit
- Backend'de enforce edilir
- Limit aşılırsa yeni token kullanımı engellenir
- Stripe'a usage report gönderilmez
- Kullanıcı bilgilendirilir

## 📊 Database Models

### Subscription (Backend)
```prisma
model Subscription {
  userId                    String   @unique
  tier                      SubscriptionTier   // FREE | PREMIUM
  status                    SubscriptionStatus // ACTIVE | PAST_DUE | ...
  stripeCustomerId          String?
  stripeSubscriptionId      String?
  stripePriceId             String?
  currentPeriodStart        DateTime?
  currentPeriodEnd          DateTime?
  monthlyTokenAllocation    Int      // Ücretsiz token kotası
  tokensUsedThisMonth       Int      // Bu ay kullanılan
  additionalTokensPurchased Int      // Manuel alınan (deprecated)
  spendingLimit             Float?   // Maksimum aylık harcama
  tokenUsageLogs            TokenUsageLog[]
}
```

### TokenUsageLog (Backend)
```prisma
model TokenUsageLog {
  subscriptionId String
  teamId         String?
  botId          String?
  chatId         String?
  tokensUsed     Int
  cost           Float    // Sadece overage için
  createdAt      DateTime
}
```

### Invoice (Stripe - Yerel DB'de YOK)
- Tüm faturalar Stripe'da
- `GET /subscription/invoices` → Stripe API'den çeker
- Frontend direkt Stripe faturalarını gösterir

## 🔧 Yapılandırma

### Environment Variables
```env
# Stripe Keys
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Price IDs (Stripe Dashboard'dan al)
STRIPE_PREMIUM_BASE_PRICE_ID=price_...
STRIPE_PREMIUM_METERED_PRICE_ID=price_...

# Token Limits
FREE_TOKEN_LIMIT=100000
PREMIUM_BASE_TOKEN_LIMIT=2000000
TOKEN_PRICE_PER_1000=0.01
```

### SystemSettings (Database)
```sql
INSERT INTO "SystemSettings" (key, value, description) VALUES
('FREE_TOKEN_LIMIT', '100000', 'Free tier monthly token limit'),
('PREMIUM_MONTHLY_TOKEN_LIMIT', '2000000', 'Premium tier included tokens'),
('TOKEN_PRICE_PER_1K', '0.01', 'Price per 1000 tokens overage');
```

## 📝 API Endpoints

### Subscription
- `POST /subscription/create-checkout` - Premium üyelik başlat
- `POST /subscription/checkout-success` - Ödeme sonrası aktivasyon
- `GET /subscription` - Mevcut subscription bilgisi
- `POST /subscription/cancel` - Aboneliği iptal et

### Invoices
- `GET /subscription/invoices` - Stripe faturalarını getir

### Webhooks
- `POST /subscription/webhook` - Stripe event'leri
  - `invoice.payment_succeeded` → Token reset
  - `invoice.payment_failed` → Hesap bloke
  - `customer.subscription.updated` → Period güncelle
  - `customer.subscription.deleted` → FREE'ye düş

## ✅ Avantajlar

1. **Tek Kaynak**: Tüm faturalar Stripe'da
2. **Otomatik**: Stripe ödeme toplar, email gönderir
3. **Şeffaf**: Kullanıcı Stripe dashboard'dan görebilir
4. **Ölçeklenebilir**: Usage-based billing otomatik
5. **Güvenli**: Harcama limitleri backend'de kontrol
6. **Audit Trail**: TokenUsageLog ile detaylı raporlama

## 🎬 İlk Kurulum

1. **Stripe Dashboard'da Product/Price oluştur**
   - Dokümantasyon: `STRIPE_PRODUCT_SETUP.md`

2. **Environment variables ekle**
   - `.env` dosyasına price ID'leri

3. **Database push**
   ```bash
   npx prisma db push
   ```

4. **Backend başlat**
   ```bash
   npm run start:dev
   ```

5. **Webhook dinle** (test için)
   ```bash
   stripe listen --forward-to localhost:3000/subscription/webhook
   ```

## 📚 Referanslar

- Stripe Metered Billing: https://stripe.com/docs/billing/subscriptions/usage-based
- Stripe Webhooks: https://stripe.com/docs/webhooks
- Product Setup: `STRIPE_PRODUCT_SETUP.md`
