# Banana Shop IAP — manual setup

## 1. App Store Connect (iOS)

1. Paid Apps Agreement + banking active
2. Create **Consumable** products:
   - `banana_tickets_25` — ฿99 (or your tier)
   - `banana_tickets_70` — ฿199

## 2. Google Play Console (Android)

1. Monetize → Products → In-app products
2. Create consumables with the **same product IDs** as iOS

## 3. RevenueCat

1. Create project at [revenuecat.com](https://www.revenuecat.com)
2. Add iOS + Android apps (bundle / package name)
3. Import both products
4. Create Offering `default` with packages for each product
5. Copy **public SDK keys** (iOS + Android)
6. Settings → Integrations → Webhooks:
   - URL: `https://<your-api-domain>/purchases/revenuecat-webhook`
   - Authorization header value → set as `REVENUECAT_WEBHOOK_AUTH` on Railway

## 4. Flutter run / release

```bash
flutter run \
  --dart-define=REVENUECAT_IOS_KEY=appl_xxx \
  --dart-define=REVENUECAT_ANDROID_KEY=goog_xxx
```

## 5. API deploy

```bash
npx prisma migrate deploy
```

Set `REVENUECAT_WEBHOOK_AUTH` in Railway variables.

## Product catalog (server)

| Product ID | Bananas |
|------------|---------|
| `banana_tickets_25` | 25 |
| `banana_tickets_70` | 70 |

Defined in `src/purchases/product-catalog.ts`.
