# Delete Account Feature - GDPR Compliant Implementation

## Overview
GDPR uyumlu hesap silme özelliği. Kullanıcılar hesaplarını silebilir ve 30 gün içinde geri alabilirler (soft delete).

## Features

### ✅ Implemented

1. **Soft Delete with Grace Period**
   - 30 günlük geri alma süresi
   - Hesap hemen deaktive edilir
   - 30 gün içinde login yaparak geri alınabilir

2. **Deletion Eligibility Checks**
   - Team ownership kontrolü (başka üyeleri olan team'ler varsa silme engellenir)
   - Pending invitation kontrolü
   - Tüm blocker'lar kullanıcıya gösterilir

3. **User Confirmation Flow**
   - İki aşamalı onay sistemi
   - "DELETE" yazarak onaylama
   - Tüm veriler hakkında detaylı bilgilendirme

4. **Automatic Cleanup**
   - Her gün saat 02:00'da cron job çalışır
   - Grace period'u dolmuş hesaplar otomatik silinir
   - Cascade delete ile tüm ilişkili veriler temizlenir

5. **Account Recovery**
   - 30 gün içinde login yaparak hesap geri alınabilir
   - Otomatik restore işlemi

## Database Schema

```prisma
model User {
  // ... existing fields
  isDeleted            Boolean   @default(false)
  deletedAt            DateTime?
  deletionScheduledFor DateTime?  // NEW FIELD
}
```

## API Endpoints

### GET /auth/deletion-eligibility
Kullanıcının hesabını silmeye uygun olup olmadığını kontrol eder.

**Response:**
```json
{
  "eligible": true,
  "blockers": []
}
```

veya

```json
{
  "eligible": false,
  "blockers": [
    {
      "type": "TEAM_OWNERSHIP",
      "message": "You must transfer ownership or remove members from team...",
      "teamId": "...",
      "teamName": "...",
      "memberCount": 3
    }
  ]
}
```

### POST /auth/request-deletion
Hesap silme talebini başlatır (soft delete).

**Response:**
```json
{
  "success": true,
  "message": "Account deletion scheduled successfully",
  "deletionScheduledFor": "2025-01-24T...",
  "daysUntilDeletion": 30
}
```

### POST /auth/cancel-deletion
Planlanmış hesap silme işlemini iptal eder.

**Response:**
```json
{
  "success": true,
  "message": "Account deletion cancelled successfully"
}
```

## Frontend Components

### DeleteAccountModal
- İki aşamalı modal sistemi
- Eligibility check'ler
- Blocker'ları gösterme
- "DELETE" confirmation input
- Loading states

### Settings Page
- Delete Account butonu
- Modal tetikleme
- Logout after deletion

## Workflow

```
User clicks "Delete Account"
    ↓
Modal açılır - Warning Step
    ↓
Backend'den eligibility check yapılır
    ↓
[IF NOT ELIGIBLE]
    → Blocker'lar gösterilir
    → User düzeltmeli
    
[IF ELIGIBLE]
    ↓
User "Continue to Delete" tıklar
    ↓
Confirmation Step
    ↓
User "DELETE" yazar
    ↓
Backend'e deletion request gönderilir
    ↓
User soft-deleted (isDeleted=true, deletionScheduledFor=NOW+30days)
    ↓
User logout edilir
    ↓
[WITHIN 30 DAYS]
    → User login yaparsa hesap restore edilir
    
[AFTER 30 DAYS]
    → Cron job hesabı permanent siler
```

## GDPR Compliance

✅ **Right to be Forgotten**: User can delete account
✅ **Data Retention**: 30-day grace period
✅ **Transparency**: Clear explanation of what will be deleted
✅ **User Control**: Can cancel deletion within grace period
✅ **Automatic Cleanup**: Old data is automatically purged

## Cron Job

**Schedule**: Daily at 2 AM
**Service**: `AccountCleanupService`
**Method**: `cleanupDeletedAccounts()`

### What it does:
1. Finds users with `isDeleted=true` and `deletionScheduledFor <= NOW`
2. For each user:
   - Deletes owned teams (if no other members)
   - Removes team memberships
   - Deletes user record (cascade deletes related data)
3. Logs all actions

## Testing Checklist

- [ ] User can request deletion
- [ ] Blocker gösteriliyor (team ownership)
- [ ] Blocker gösteriliyor (pending invitations)
- [ ] Confirmation flow çalışıyor
- [ ] Soft delete yapılıyor
- [ ] User logout ediliyor
- [ ] 30 gün içinde login ile restore
- [ ] Cron job çalışıyor
- [ ] Cascade delete çalışıyor
- [ ] Email notifications (TODO)

## Future Improvements

1. **Email Notifications**
   - Deletion confirmation email
   - Reminder emails (7 days before, 1 day before)
   - Cancellation confirmation email

2. **Admin Panel**
   - Manual deletion trigger
   - View scheduled deletions
   - Force delete option

3. **Invoice Integration**
   - Block deletion if unpaid invoices
   - Keep financial records as required by law

4. **Data Export**
   - GDPR requires option to export data before deletion
   - Generate JSON/ZIP of user data

## Dependencies

```json
{
  "@nestjs/schedule": "^4.x.x"
}
```

## Files Modified/Created

### Backend
- ✅ `prisma/schema.prisma` - Added deletionScheduledFor field
- ✅ `authentication.service.ts` - Added deletion methods
- ✅ `authentication.controller.ts` - Added endpoints
- ✅ `account-cleanup.service.ts` - NEW - Cron job service
- ✅ `authentication.module.ts` - Registered cleanup service
- ✅ `app.module.ts` - Added ScheduleModule

### Frontend
- ✅ `redux/service/authServiceApi.ts` - Added mutations/queries
- ✅ `components/DeleteAccountModal.tsx` - NEW - Modal component
- ✅ `pages/Settings.tsx` - Added delete button and modal

## Migration

```bash
npx prisma migrate dev --name add_deletion_scheduled_for
npx prisma generate
```

## Notes

- Fatura sistemi henüz yok, gelecekte eklenecek
- Email template'leri oluşturulmalı
- Data export özelliği GDPR için önemli (henüz yok)
- Vergi kanunu gereği fatura kayıtları 7-10 yıl saklanmalı (future implementation)

## Gelecek İyileştirmeler
- Email notifications (deletion confirmation, reminders)
- Invoice integration (ödenmemiş fatura kontrolü)
- Data export (GDPR right to data portability)
- Admin panel (manuel deletion yönetimi)
