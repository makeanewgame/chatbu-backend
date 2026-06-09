# Widget Güvenlik Sistemi — Uygulama Checklist

## TAMAMLANDI ✅

### Backend — Veritabanı
- [x] `WidgetVisitor` modeli `prisma/schema.prisma`'ya eklendi
  - `visitorId`, `chatbotId`, `domain`, `fingerprintHash`, `ipHash`, `userAgentHash`
  - `messageCountToday`, `tokenUsageToday`, `riskScore`, `dailyResetAt`
  - `isBlocked`, `blockedReason`
  - İndeksler: `visitorId` (unique), `fingerprintHash+chatbotId`, `isBlocked`, `chatbotId`
- [x] `npx prisma db push` — tablo DB'ye uygulandı (`sslmode=disable` ile)
- [x] `npx prisma generate` — Prisma client yenilendi

### Backend — Widget Modülü (`src/widget/`)
- [x] `widget.module.ts` oluşturuldu (`PrismaModule`, `JwtModule`, `BotModule` import edildi)
- [x] `widget.controller.ts` oluşturuldu
  - `POST /api/widget/session` — IP throttle: 5 req/dk
  - `POST /api/widget/chat` — IP throttle: 20 req/dk
  - IP extraction: `x-forwarded-for` → socket → fallback
- [x] `widget.service.ts` oluşturuldu
  - **Session akışı:** embed JWT doğrula → bot aktif mi → domain whitelist → fingerprint hesapla → visitor bul/oluştur → isBlocked → sessionToken (2h) döndür
  - **Chat akışı:** session JWT doğrula → visitor yükle → isBlocked → günlük reset kontrolü → bot limitleri → `publicChatInternal` → sayaçları güncelle → risk skoru hesapla → otomatik block
  - **Fingerprint:** `SHA-256(ip|userAgent|acceptLanguage|botId)` — sunucu taraflı, localStorage bypass'ına karşı koruma
  - **Risk skoru:** mesaj uzunluğu + günlük limit yaklaşımı → 80+ puan = otomatik blok
  - **Cron:** her gece 00:00 UTC günlük sayaçları sıfırla (`messageCountToday`, `tokenUsageToday`, `riskScore`, `dailyResetAt`)
- [x] `app.module.ts`'ye `WidgetModule` import edildi

### Backend — Bot Servisi
- [x] `bot.service.ts`'e `publicChatInternal()` metodu eklendi (WidgetService'in kullanması için, JWT bypass'lı)

### Frontend — ChatFormPublic
- [x] `widgetVisitorId` ve `widgetSessionToken` state'leri eklendi
- [x] `initSession()` fonksiyonu eklendi (`POST /widget/session` çağrısı, localStorage'a visitorId yazar)
- [x] Sayfa yüklenirken `initSession()` otomatik çağrılıyor (tek sefer, `sessionInitRef` ile)
- [x] `sendMessage()` artık `POST /widget/chat` kullanıyor (`sessionToken` + `visitorId` + `message` + `chatId`)
- [x] 401 durumunda session otomatik yenileniyor (retry mekanizması)
- [x] 403/limit hatalarında `quotaExceeded` banner'ı gösteriliyor

---

## YAPILACAKLAR 🔲

### 1. Backend — TypeScript & Build Doğrulaması
- [x] `npx tsc --noEmit -p tsconfig.build.json` — sıfır hata (`test/` dosyasındaki supertest sorunu önceden mevcuttu)
- [x] `npm run build` — nest build başarılı
- [x] `npm run lint` — ESLint v9 config sorunu önceden mevcuttu, widget kodu temiz

### 2. Backend — Bot Settings DTO Güncellemesi
- [x] `updateSettingsRequest.ts` zaten `Record<string, any>` kullanıyor — ek DTO değişikliği gerekmeden destekleniyor

### 3. Frontend — Bot Ayarları UI
- [x] `Appearance` tipine `allowedDomains`, `maxMessagesPerDay`, `maxTokensPerDay` eklendi (`src/lib/types.ts`)
- [x] **Security** sekmesi `ChatbotAppearanceSettings.tsx`'e eklendi (domain whitelist tag-input + limit sayı inputları)
- [x] i18n: `public/locales/en/translation.json` ve `tr/translation.json` güncellendi

### 4. Frontend — TypeScript & Build Doğrulaması
- [x] `npx tsc` — strict mod, sıfır hata
- [x] `npm run build` — Vite build başarılı (6.34s)

### 6. Backend — Admin Panel: Visitor Yönetimi
- [x] `GET /api/admin/widget/visitors?botId=xxx` — sayfalı ziyaretçi listesi (`admin.service.ts` + `admin.controller.ts`)
- [x] `POST /api/admin/widget/visitors/:id/block` — manuel engelleme (opsiyonel reason)
- [x] `POST /api/admin/widget/visitors/:id/unblock` — engel kaldırma + riskScore sıfırlama
- [x] Frontend: `src/pages/admin/WidgetVisitors.tsx` — AG Grid tablosu (Bot ID arama, block/unblock modal, risk skoru chip, stats satırı)
- [x] Frontend: `adminServiceApi.ts` — 3 yeni endpoint + `WidgetVisitors` tagType
- [x] Frontend: `icons.tsx` — `WidgetVisitors` enum + `WidgetVisitorsIcon` SVG
- [x] Frontend: `SideBar.tsx` — icon case eklendi
- [x] Frontend: `UserRolesAuth.ts` — `/admin/widget-visitors` menü girişi (ADMIN only)
- [x] Frontend: `App.tsx` — import + `widget-visitors` getComponent case + Route
- [x] Frontend: i18n EN/TR — `menu.widget-visitors` anahtarı
- [x] Backend TS/build + Frontend TS/build — sıfır hata

### 7. K8s Secret Güncellemesi (Deployment)
- [x] `THROTTLE_TTL=60000` ve `THROTTLE_LIMIT=100` — `backend-secrets` (chatbu namespace) içinde mevcut, deploy'da ek değişiklik gerekmez
  - Widget endpoint'leri kendi `@Throttle()` decorator'larıyla override ediyor (session: 5 req/dk, chat: 20 req/dk)

---

## BAŞLAMA SIRASI

```
1 → Backend TS/Build doğrulaması (hata varsa önce düzelt)
2 → Backend DTO güncellemesi
3 → Frontend bot ayarları UI
4 → Frontend i18n anahtarları
5 → Frontend TS/Build doğrulaması
6 → (Opsiyonel) Admin visitor yönetimi
```
