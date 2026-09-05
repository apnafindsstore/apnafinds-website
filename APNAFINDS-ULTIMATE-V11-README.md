# ApnaFinds Ultimate V11

Production-base project with the existing OTP, guest checkout, orders, Zoho mailer, premium storefront, Commerce Hub, supplier catalog tools, contextual WhatsApp support, official business emails, and Razorpay **Test Mode** foundation.

## Razorpay Test Mode
Set `RAZORPAY_MODE=test`, `RAZORPAY_KEY_ID`, and `RAZORPAY_KEY_SECRET` in `.env` locally or Railway Variables. Never commit secrets. The server creates Razorpay orders and verifies payment signatures. The checkout marks an order paid only after successful verification.

## Not live-connected yet
Amazon, Meesho, Flipkart, Shiprocket and supplier APIs require approved accounts and platform-specific credentials. Their dashboard areas are foundations, not simulated live connections.

## Checks
Run `npm.cmd install`, then `npm.cmd run check`. Test OTP, COD, Razorpay Test Mode, checkout, order tracking, returns, admin and catalog import locally before pushing.
