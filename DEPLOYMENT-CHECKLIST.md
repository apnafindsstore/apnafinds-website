# Production Deployment Checklist

- Change every admin credential and secret in `.env`.
- Set `LOGISTICS_MODE=live` only after Shiprocket KYC and pickup setup.
- Test one low-value real order before accepting normal orders.
- Configure the public HTTPS Shiprocket webhook.
- Confirm parcel dimensions and weight.
- Connect a payment gateway and its refund API for prepaid refunds.
- Replace `data/db.json` with a production database.
- Back up orders, customers, shipments and returns.
- Review privacy, returns, shipping and terms pages with a qualified professional.
- Never expose `.env` through static hosting.
