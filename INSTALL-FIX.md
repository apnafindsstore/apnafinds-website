# ApnaFinds Tracking, Logistics and Admin Management Fix

This package fixes and connects:

- `track-order.html` — customer order tracking
- `admin-logistics.html` — courier booking, AWB, tracking and reverse pickup
- `admin-management.html` — orders, customers, returns, refunds and activity
- the Node.js APIs required by those pages

## Important: do not use `file:///`

These pages use the Node.js server and APIs.

Start the website with:

```text
START-APNAFINDS.bat
```

Then open:

```text
Customer tracking:
http://localhost:3000/track-order.html

Admin logistics:
http://localhost:3000/admin-logistics.html

Admin management:
http://localhost:3000/admin-management.html
```

## Admin API Token

Open `.env` and set a private token:

```text
ADMIN_API_TOKEN=your-private-admin-token
```

Enter that exact value in the token field on both admin pages.

The default `.env.example` contains:

```text
ADMIN_API_TOKEN=change-this-admin-api-token
```

Change it before publishing.

## Demo logistics

Keep this while testing:

```text
LOGISTICS_MODE=demo
AUTO_BOOK_SHIPMENTS=true
```

Demo mode creates a test courier, AWB and pickup status without charging money.

## Live Shiprocket

Before changing to live mode, complete:

1. Shiprocket account registration and KYC.
2. Pickup address and pickup PIN-code verification.
3. Wallet or billing setup.
4. API user credentials.
5. Parcel weight and dimensions.

Then configure `.env`:

```text
LOGISTICS_MODE=live
SHIPROCKET_EMAIL=
SHIPROCKET_PASSWORD=
SHIPROCKET_PICKUP_LOCATION=Primary
SHIPROCKET_PICKUP_POSTCODE=
```

The live adapter was not tested with your private Shiprocket account. Test one real order first.

## How customer tracking gets an order

Orders created by the checkout page are sent to the server and saved in:

```text
data/db.json
```

When old orders exist only in the browser, use:

```text
Admin Logistics → Import Browser Orders
```

or:

```text
Admin Management → Import Orders
```

Each imported order needs:

- Order ID
- Customer name
- Phone or email
- At least one item
- A six-digit shipping PIN code

## Quick test

1. Start `START-APNAFINDS.bat`.
2. Double-click `CREATE-DEMO-ORDER.bat`.
3. Open customer tracking.
4. Enter:

```text
Order ID: APNA-DEMO-1001
Phone: 9666337370
```

5. Open Admin Logistics and enter the Admin API Token.
6. Click **Book / Retry** to generate a demo AWB.
7. Return to the tracking page and click **Refresh tracking**.

## Files changed

```text
server.js
server/lib/storage.js

public/track-order.html
public/admin-logistics.html
public/admin-management.html

public/css/customer-tracking.css
public/css/admin-control.css

public/js/backend-client.js
public/js/customer-tracking.js
public/js/admin-logistics.js
public/js/admin-management.js
```

## Tested

The following were tested locally with Node.js:

- Server health endpoint
- Static loading of all three HTML pages
- Create order API
- Customer order lookup
- Customer tracking refresh
- Admin management API
- Order status update
- Customer list and block/activate action
- Demo shipment booking and AWB generation
- Customer cancellation
- JavaScript syntax checks
