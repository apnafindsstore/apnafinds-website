# ApnaFinds Full Automatic Admin & Logistics — Version 2

This package combines the complete ApnaFinds storefront with a Node.js backend, server-backed administrator login, automatic courier processing, customer tracking, returns, reverse pickup and management pages.

## Start on Windows

1. Install Node.js 18 or newer.
2. Extract the ZIP.
3. Double-click `START-APNAFINDS.bat`.
4. Keep the black server window open.
5. The admin login opens automatically.

Do not open the pages with `file:///` and do not use VS Code Live Server. The website must run through `http://localhost:3000`.

## First local admin login

The first-run values are copied from `.env.example` into `.env`:

- Email: `admin@apnafinds.local`
- Password: `ApnaFinds@123`

Change these values in `.env` before putting the website online:

```env
ADMIN_NAME=Your Name
ADMIN_EMAIL=your-admin-email@example.com
ADMIN_PASSWORD=create-a-long-password
ADMIN_SESSION_SECRET=create-a-long-random-secret
ADMIN_API_TOKEN=create-a-different-long-random-token
```

## Important pages

- Store: `http://localhost:3000`
- Customer tracking: `http://localhost:3000/track-order.html`
- Admin login: `http://localhost:3000/admin-login.html`
- Admin dashboard: `http://localhost:3000/admin.html`
- Admin management: `http://localhost:3000/admin-management.html`
- Logistics automation: `http://localhost:3000/admin-logistics.html`

## Automatic process

### New order

1. Checkout saves the order in the customer browser.
2. Checkout sends the order to `POST /api/orders`.
3. The server validates the customer, items and six-digit PIN code.
4. The order is stored in `data/db.json`.
5. When `AUTO_BOOK_SHIPMENTS=true`, courier booking starts automatically.
6. The server creates the courier order, AWB and pickup request.
7. Customer tracking immediately displays the courier and AWB.
8. Failed or queued bookings are retried by the background worker.

### Demo mode

The package starts in `LOGISTICS_MODE=demo`, so it works without a Shiprocket account.

The automatic demo stages are:

`Confirmed → Packed → Shipped → In transit → Out for delivery → Delivered`

The background worker advances the demo status automatically. Pressing **Refresh Tracking** also advances one demo stage.

Adjust the demo speed in `.env`:

```env
AUTOMATION_INTERVAL_SECONDS=20
DEMO_ORDER_STAGE_SECONDS=45
DEMO_RETURN_STAGE_SECONDS=60
```

### Returns and replacements

1. A delivered order can create a return, refund or replacement request.
2. In demo mode, reverse pickup is created automatically.
3. Return progress is shown in Admin Management and Admin Logistics.
4. Demo return statuses advance automatically.
5. In live mode, the admin controls approval and refund status unless a payment gateway automation is added.

## Test the complete workflow

1. Start the server with `START-APNAFINDS.bat`.
2. Double-click `CREATE-DEMO-ORDER.bat`.
3. Copy the generated order ID.
4. Open Customer Tracking.
5. Enter the generated order ID and phone `9666337370`.
6. Open Admin Management and Admin Logistics to see the same order.

## Live Shiprocket setup

After completing Shiprocket KYC, wallet/plan and pickup-address configuration, edit `.env`:

```env
LOGISTICS_MODE=live
AUTO_BOOK_SHIPMENTS=true
SHIPROCKET_EMAIL=your-api-user-email
SHIPROCKET_PASSWORD=your-api-password
SHIPROCKET_PICKUP_LOCATION=Primary
SHIPROCKET_PICKUP_POSTCODE=500072
SHIPROCKET_COURIER_ID=
```

Review package dimensions carefully:

```env
DEFAULT_PACKAGE_LENGTH_CM=20
DEFAULT_PACKAGE_BREADTH_CM=15
DEFAULT_PACKAGE_HEIGHT_CM=10
DEFAULT_PACKAGE_WEIGHT_KG=0.5
```

For live tracking updates, configure your hosted webhook URL to:

`POST /api/logistics/webhook/shiprocket`

Send the secret using `x-apnafinds-webhook-secret`, matching `LOGISTICS_WEBHOOK_SECRET` in `.env`.

## Admin features

- Server-backed admin email/password login
- Expiring browser session
- Dashboard and product management
- Server order management
- Customer activation/blocking
- Return and refund status updates
- Automatic courier booking/retry
- AWB and courier display
- Tracking refresh
- Order cancellation
- Reverse pickup
- CSV export
- Activity log
- Demo automatic status progression
- Live Shiprocket adapter and webhook

## Important limitations

The code automates the software workflow. A real courier account is still required to collect and transport products. Real prepaid refunds require the refund API of your connected payment gateway. For production scale, replace the JSON file database with PostgreSQL, MySQL, MongoDB or another managed database and use HTTPS on a publicly hosted Node.js server.
