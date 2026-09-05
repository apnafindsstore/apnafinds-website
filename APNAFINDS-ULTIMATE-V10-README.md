# ApnaFinds Ultimate v10

This is the consolidated master project prepared from the working Premium OTP + Guest Checkout V9 backend and the premium storefront, contextual WhatsApp support, social links, Commerce Hub, and catalog import/export upgrades.

## Official business emails

- Customer support: `support@apnafinds.com`
- Orders and delivery: `orders@apnafinds.com`
- General enquiries: `hello@apnafinds.com`
- Returns and refunds: `returns@apnafinds.com`
- Business and partnerships: `business@apnafinds.com`
- Automated OTP/system sender: `noreply@apnafinds.com` (not displayed as a support inbox)

All aliases may arrive in the main Zoho mailbox according to your Zoho alias/forwarding setup.

## Included

- Working customer registration/login/email OTP and guest checkout backend
- Orders, tracking, returns, admin, COD advance, and logistics foundation
- Premium homepage and customer storefront
- Contextual WhatsApp support
- Instagram and Facebook links
- Commerce Hub with separate Website, Amazon, Meesho, Flipkart and supplier workspaces
- Single and bulk product management
- CSV and JSON catalog import/export foundation
- Supplier catalog/PDF intake foundation

## Important integration status

The Website backend works as included. Amazon, Meesho, Flipkart, Razorpay, Shiprocket, and dropshipping suppliers require approved accounts and their official API credentials before live synchronization can operate. Keep all API keys in Railway Variables or `.env`; never place keys in HTML or client-side JavaScript.

## Local test

```powershell
npm.cmd install
npm.cmd run check
npm.cmd start
```

Open `http://localhost:3000`.

## Railway

Push the project to the connected GitHub repository only after local tests pass. Configure SMTP and other secrets in Railway Variables. Do not upload `.env`.
