# Stripe Product ve Price Yapılandırması

## Gerekli Stripe Ürünleri

Sistemde **tek bir Product** olacak ve altında **2 adet Price** tanımlı olacak:

### 1. Premium Subscription Product

**Product Details:**
- Name: `ChatBu Premium`
- Description: `Premium subscription with included tokens and usage-based billing`

**Price 1 - Flat Recurring (Sabit Aylık Ücret):**
- Price ID: `price_premium_monthly_base`
- Type: `recurring`
- Amount: `899 TRY` (veya tercih edilen para birimi)
- Interval: `month`
- Usage Type: `licensed`

**Price 2 - Metered Recurring (Token Aşımı):**
- Price ID: `price_premium_token_overage`
- Type: `recurring`
- Interval: `month`
- Usage Type: `metered`
- Billing Scheme: `per_unit`
- Unit Amount: `0.01 TRY` per 1000 tokens (ayarlanabilir)

## Stripe Dashboard'da Kurulum

### Adım 1: Product Oluşturma
```
1. Stripe Dashboard → Products → Create product
2. Name: "ChatBu Premium"
3. Description: "Premium subscription with included tokens"
4. Save product
```

### Adım 2: Base Price Oluşturma
```
1. Yeni oluşturulan product'a tıkla
2. Add another price
3. Type: Recurring
4. Billing period: Monthly
5. Pricing model: Standard pricing
6. Price: 899 TRY (veya istenen miktar)
7. Price ID: price_premium_monthly_base
8. Save
```

### Adım 3: Metered Price Oluşturma
```
1. Aynı product'a Add another price
2. Type: Recurring
3. Billing period: Monthly
4. Pricing model: Usage-based
5. Usage Type: Metered
6. Aggregation usage: Sum
7. Unit amount: 0.01 TRY per 1000 tokens
8. Price ID: price_premium_token_overage
9. Save
```

## Environment Variables

`.env` dosyanıza ekleyin:

```env
# Stripe Product/Price IDs
STRIPE_PREMIUM_BASE_PRICE_ID=price_premium_monthly_base
STRIPE_PREMIUM_METERED_PRICE_ID=price_premium_token_overage

# Token Limits
FREE_TOKEN_LIMIT=100000
PREMIUM_BASE_TOKEN_LIMIT=2000000
TOKEN_PRICE_PER_1000=0.01

# Existing Stripe Keys
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

## Subscription Yapısı

Yeni bir premium subscription oluşturulduğunda:

```javascript
{
  customer: "cus_xxx",
  items: [
    {
      price: "price_premium_monthly_base",  // Base fee
      quantity: 1
    },
    {
      price: "price_premium_token_overage", // Usage-based
      // No quantity - will be reported via usage records
    }
  ]
}
```

## Usage Reporting

Token kotası aşıldığında backend:

```javascript
stripe.subscriptionItems.createUsageRecord(
  subscriptionItemId,  // metered price'ın item ID'si
  {
    quantity: Math.ceil(overageTokens / 1000),
    timestamp: now,
    action: 'increment'
  }
)
```

## Fatura Döngüsü

1. **Billing Period Start:**
   - Backend: `tokensUsedThisMonth = 0`
   - Stripe: Yeni fatura dönemi başlar

2. **Kullanım Sırasında:**
   - Backend: Token kullanımını track eder
   - Aşım olursa: Stripe'a usage record gönderir

3. **Billing Period End:**
   - Stripe: Base fee + usage charges'ı toplar
   - Stripe: Invoice oluşturur ve payment collect eder
   - Webhook: `invoice.payment_succeeded`
   - Backend: Token sayaçlarını resetler

## Not

⚠️ **ÖNEMLİ:** Bu yapılandırma tamamlandıktan sonra, yukarıdaki Price ID'leri `.env` dosyanıza ekleyin ve backend'i yeniden başlatın.
