#!/bin/bash
set -e

# DATABASE_URL kontrolü
if [ -z "$DATABASE_URL" ]; then
  echo "❌ DATABASE_URL environment variable is not set!"
  exit 1
fi

# ?schema=... parametresini temizle
CLEAN_DB_URL=$(echo "$DATABASE_URL" | sed 's/?schema=.*//')

# PostgreSQL'in hazır olmasını bekle
echo "⏳ PostgreSQL'in hazır olması bekleniyor..."
MAX_RETRIES=30
RETRY_COUNT=0
until pg_isready -h $(echo "$CLEAN_DB_URL" | sed -E 's|.*@([^:/]+).*|\1|') -p $(echo "$CLEAN_DB_URL" | sed -E 's|.*:([0-9]+)/.*|\1|' || echo "5432") -U $(echo "$CLEAN_DB_URL" | sed -E 's|.*://([^:]+):.*|\1|') 2>/dev/null; do
  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
    echo "❌ PostgreSQL $MAX_RETRIES deneme sonrasında hazır olmadı!"
    exit 1
  fi
  echo "⏳ PostgreSQL bekleniyor... ($RETRY_COUNT/$MAX_RETRIES)"
  sleep 2
done
echo "✅ PostgreSQL hazır!"

echo "⚙️  Prisma generate"
npx prisma generate

echo "🚀 Schema değişiklikleri veritabanına uygulanıyor (db push)..."
npx prisma db push --accept-data-loss || {
  echo "⚠️  prisma db push başarısız oldu, migrate deploy deneniyor..."
  npx prisma migrate deploy || echo "⚠️  migrate deploy de başarısız oldu"
}

echo "🔄 Trigger dosyası yükleniyor..."
psql "$CLEAN_DB_URL" -f ./prisma/triggers.sql || echo "⚠️  Trigger dosyası yüklenirken bazı hatalar oluştu (tablolar henüz oluşmamış olabilir)"

echo "🏗️  Build başlatılıyor..."
npm run build

echo "🔍 Build çıktısını kontrol ediyoruz..."
if [ -f "dist/main.js" ]; then
  MAIN_FILE="dist/main.js"
elif [ -f "dist/src/main.js" ]; then
  MAIN_FILE="dist/src/main.js"
else
  echo "❌ main.js dosyası bulunamadı!"
  echo "dist/ klasör içeriği:"
  ls -la dist/
  exit 1
fi

echo "🟢 Uygulama başlatılıyor: $MAIN_FILE"
pm2-runtime "$MAIN_FILE"