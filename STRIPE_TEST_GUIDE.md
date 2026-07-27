# Stripe Entegrasyonu ve Test Rehberi

## 🎯 Genel Bakış

Bu dokümantasyon, uygulamaya entegre edilen Stripe ödeme sistemini test etmek için gereken tüm adımları içermektedir.

## 📋 Sistem Özellikleri

### İki Katmanlı Üyelik Sistemi

#### 1. **FREE (Ücretsiz) Üyelik**
- **Bot Limiti**: 1 bot
- **Token Limiti**: 100,000 token (toplam, ömür boyu)
- **Özellikler**: Temel chat özellikleri
- **Kısıtlamalar**: 
  - Token limiti dolduğunda sistem tamamen engellenir
  - Email bildirim gönderilir
  - Chat'te kibar bir uyarı mesajı gösterilir
  - Yeni bot eklenemez

#### 2. **PREMIUM (Ücretli) Üyelik**
- **Aylık Ücret**: $29.99/ay
- **Bot Limiti**: 10 bot
- **Aylık Token Allocation**: 2,000,000 token (her ay yenilenir)
- **Ek Token Satın Alma**: Mevcut
- **Token Fiyatı**: $0.002 / 1,000 token
- **Spending Limit**: Ayarlanabilir üst limit
- **Özellikler**:
  - Otomatik aylık yenileme
  - Ek token satın alabilme
  - Öncelikli destek

## 🚀 Stripe Kurulumu ve Yapılandırma

### Adım 1: Stripe Hesabı Oluşturma

1. [Stripe Dashboard](https://dashboard.stripe.com/register)'a gidin
2. Yeni bir hesap oluşturun
3. Email adresinizi doğrulayın

### Adım 2: API Anahtarlarını Alma

1. Stripe Dashboard'da **Developers → API Keys** bölümüne gidin
2. **Test Mode** aktif olduğundan emin olun (sağ üst köşe)
3. Aşağıdaki anahtarları kopyalayın:
   - **Publishable key** (pk_test_...)
   - **Secret key** (sk_test_...)

### Adım 3: Backend .env Yapılandırması

```bash
# Backend (.env dosyasına ekleyin)
STRIPE_SECRET_KEY=sk_test_YOUR_SECRET_KEY_HERE
STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_PUBLISHABLE_KEY_HERE
STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET_HERE
```

### Adım 4: Webhook Kurulumu

#### Yerel Test için Stripe CLI Kurulumu

```bash
# Mac
brew install stripe/stripe-cli/stripe

# Windows
scoop install stripe

# Linux
wget https://github.com/stripe/stripe-cli/releases/latest/download/stripe_X.X.X_linux_x86_64.tar.gz
tar -xvf stripe_X.X.X_linux_x86_64.tar.gz
sudo mv stripe /usr/local/bin/
```

#### Stripe CLI ile Giriş

```bash
stripe login
```

#### Webhook'ları Dinleme

```bash
# Backend sunucunuzu çalıştırın (port 3000'de)
npm run start:dev

# Başka bir terminal'de webhook'ları yönlendirin
stripe listen --forward-to localhost:3000/subscription/webhook
```

Bu komut size bir `whsec_` ile başlayan webhook secret verecek. Bunu `.env` dosyanıza ekleyin.

## 🔧 Sistem Ayarlarını Başlatma

### 1. Database Migration

```bash
cd chatbu-backend
npx prisma migrate dev
```

### 2. Default Ayarları Yükleme

Backend çalıştıktan sonra, bu endpoint'i çağırın (ADMIN olarak giriş yapmanız gerekir):

```bash
curl -X GET http://localhost:3000/admin/settings/init \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

Bu ayarları elle de değiştirebilirsiniz:

| Setting Key | Default Value | Açıklama |
|------------|---------------|-----------|
| FREE_TOKEN_LIMIT | 100000 | Free tier toplam token limiti |
| PREMIUM_MONTHLY_TOKEN_LIMIT | 2000000 | Premium aylık token allocation |
| TOKEN_PRICE_PER_1K | 0.002 | 1000 token başına fiyat (USD) |
| PREMIUM_MONTHLY_PRICE | 29.99 | Premium aylık abonelik ücreti (USD) |
| FREE_BOT_LIMIT | 1 | Free tier bot limiti |
| PREMIUM_BOT_LIMIT | 2 | Premium tier bot limiti |

## 🧪 Test Senaryoları

### Senaryo 1: Free User Token Limiti

1. Free bir kullanıcı olarak giriş yapın
2. Bot oluşturun
3. Chat'te 100,000 token'a yakın mesaj gönderin
4. Token limiti dolduğunda:
   - ✅ Email bildirimi almalısınız
   - ✅ Chat'te "Token limitiniz doldu" mesajı görmelisiniz
   - ✅ Yeni mesaj gönderememelisiniz
   - ✅ Subscription sayfasında upgrade popup'ı açılmalı

### Senaryo 2: Premium'a Upgrade

1. Free kullanıcı olarak `/subscriptions` sayfasına gidin
2. "Upgrade to Premium" butonuna tıklayın
3. Fatura bilgilerini doldurun:
   - First Name: Test
   - Last Name: User
   - Email: test@example.com
   - Address: 123 Test St
   - Country: United States
   - State/Region: CA
   - City: San Francisco
   - Zip Code: 94102
   - VAT Number: (opsiyonel)

4. Test kartı bilgilerini girin:
   ```
   Card Number: 4242 4242 4242 4242
   Expiry: 12/34
   CVC: 123
   ZIP: 12345
   ```

5. ✅ Subscription başarıyla oluşturulmalı
6. ✅ 2,000,000 token allocation görmelisiniz
7. ✅ 10 bot oluşturabilmelisiniz

### Senaryo 3: Ek Token Satın Alma (Premium User)

1. Premium kullanıcı olarak giriş yapın
2. `/subscriptions` sayfasında "Purchase Additional Tokens" butonuna tıklayın
3. Token miktarı girin (örn: 1,000,000)
4. Tahmini maliyet gösterilmeli: $2.00
5. ✅ Token satın alımı başarılı olmalı
6. ✅ Toplam available tokens artmalı

### Senaryo 4: Ödeme Hatası Simülasyonu

Test için başarısız ödeme kartı:
```
Card Number: 4000 0000 0000 0341
```

1. Bu kartla subscription oluşturun
2. ✅ Ödeme başarısız olmalı
3. ✅ Hesap bloke edilmeli
4. ✅ Email bildirimi gönderilmeli
5. ✅ Chat kullanımı engellenmeliChat kullanımı engellenecek
6. ✅ Login olduğunuzda uyarı göreceksiniz

### Senaryo 5: Subscription İptal

1. Premium kullanıcı olarak "Cancel Subscription" butonuna tıklayın
2. ✅ "Will be cancelled at period end" mesajı görmelisiniz
3. ✅ Mevcut period sonuna kadar kullanım devam etmeli
4. ✅ Period bitiminde FREE'ye dönmelisiniz

### Senaryo 6: Spending Limit Kontrolü

1. Premium kullanıcı olarak spending limit ayarlayın (örn: $10)
2. $10'lık token kullanımına ulaşana kadar chat yapın
3. ✅ Limit dolduğunda uyarı almalısınız
4. ✅ Daha fazla token satın alamazsınız
5. ✅ Ay sonunda fatura kesilir

## 🎴 Stripe Test Kartları

### Başarılı Ödemeler
```
4242 4242 4242 4242  - Visa (başarılı)
5555 5555 5555 4444  - Mastercard (başarılı)
```

### Hatalı Ödemeler
```
4000 0000 0000 0002  - Card declined
4000 0000 0000 9995  - Insufficient funds
4000 0000 0000 0341  - Attachment required (3D Secure)
```

### 3D Secure Test
```
4000 0027 6000 3184  - 3D Secure 2 authentication required
```

## 📊 Admin Panel Test

1. Admin kullanıcısı olarak `/admin-settings` sayfasına gidin
2. Ayarları değiştirin:
   - FREE_TOKEN_LIMIT: 50000
   - PREMIUM_MONTHLY_PRICE: 19.99
3. "Save Changes" butonuna tıklayın
4. ✅ Ayarlar güncellenmiş olmalı
5. Yeni kayıt olan kullanıcılar yeni limitleri görecek

## 🔍 Webhook Event'leri İzleme

```bash
# Stripe CLI ile webhook event'lerini izleyin
stripe listen --forward-to localhost:3000/subscription/webhook --print-json
```

Kontrol edilmesi gereken event'ler:
- `invoice.payment_succeeded` - Ödeme başarılı
- `invoice.payment_failed` - Ödeme başarısız
- `customer.subscription.updated` - Subscription güncellendi
- `customer.subscription.deleted` - Subscription silindi

## 📧 Email Bildirimleri Test

Sistem aşağıdaki durumlarda email gönderir:

1. **Token Limiti Doldu** (`sendTokenLimitReachedEmail`)
   - Free user token limitini doldurduğunda

2. **Ödeme Başarısız** (`sendPaymentFailedEmail`)
   - Premium subscription ödemesi başarısız olduğunda

3. **Ödeme Hatırlatması** (`sendPaymentReminderEmail`)
   - Ödeme tarihinden 5 gün önce

## 🐛 Sorun Giderme

### 1. Webhook Çalışmıyor

```bash
# Webhook secret'ı kontrol edin
echo $STRIPE_WEBHOOK_SECRET

# Stripe CLI log'larını kontrol edin
stripe listen --forward-to localhost:3000/subscription/webhook --log-level debug
```

### 2. Subscription Oluşturulamıyor

- Stripe API anahtarlarını kontrol edin
- Backend console log'larına bakın
- Stripe Dashboard → Events bölümünde hataları kontrol edin

### 3. Token Tracking Çalışmıyor

```sql
-- Database'de subscription'ı kontrol edin
SELECT * FROM "Subscription" WHERE "userId" = 'YOUR_USER_ID';

-- Token usage log'larını kontrol edin
SELECT * FROM "TokenUsageLog" WHERE "subscriptionId" = 'YOUR_SUBSCRIPTION_ID';
```

## 📝 Production'a Geçiş

Production'a geçerken:

1. ✅ Test Mode'dan Live Mode'a geçin
2. ✅ Live API anahtarlarını kullanın
3. ✅ Gerçek webhook endpoint'i kaydedin
4. ✅ SSL sertifikası olduğundan emin olun
5. ✅ Stripe Dashboard'da production webhook'ları yapılandırın

### Production Webhook Endpoint
```
https://yourdomain.com/subscription/webhook
```

## 🔐 Güvenlik Kontrol Listesi

- ✅ API anahtarları `.env` dosyasında ve `.gitignore`'a eklenmiş
- ✅ Webhook signature doğrulaması aktif
- ✅ CORS ayarları yapılmış
- ✅ Rate limiting uygulanmış
- ✅ Input validation mevcut
- ✅ SQL injection koruması (Prisma kullanımı)
- ✅ XSS koruması

## 📚 Ek Kaynaklar

- [Stripe Documentation](https://stripe.com/docs)
- [Stripe Testing Guide](https://stripe.com/docs/testing)
- [Stripe Webhooks](https://stripe.com/docs/webhooks)
- [Stripe CLI](https://stripe.com/docs/stripe-cli)

## 💡 İpuçları

1. **Test Mode**: Tüm testleri test mode'da yapın
2. **Webhooks**: Mutlaka webhook'ları test edin
3. **Error Handling**: Tüm hata senaryolarını test edin
4. **Logs**: Backend ve Stripe dashboard log'larını takip edin
5. **Database**: Düzenli olarak database'i kontrol edin

## 📞 Destek

Sorun yaşarsanız:
1. Backend console log'larını kontrol edin
2. Stripe Dashboard → Events bölümünü kontrol edin
3. Browser console'unu kontrol edin
4. Webhook log'larını inceleyin
