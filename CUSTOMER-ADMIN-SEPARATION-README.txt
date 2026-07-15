APNAFINDS V7 — CUSTOMER AND ADMIN ARE SEPARATED
================================================

CUSTOMER PAGES
--------------
Home:
http://localhost:3000

Products:
http://localhost:3000/products.html

Shipping information:
http://localhost:3000/shipping.html

Track Order:
http://localhost:3000/track-order.html

Returns / Refund request:
http://localhost:3000/returns-center.html

Customer Account:
http://localhost:3000/account.html


ADMIN PAGES
-----------
Admin Login:
http://localhost:3000/admin-login.html

Dashboard and Products:
http://localhost:3000/admin.html

Orders:
http://localhost:3000/admin-management.html#orders

Customer Management:
http://localhost:3000/admin-customers.html

Returns and Refund Management:
http://localhost:3000/admin-returns.html

Payments:
http://localhost:3000/admin-payments.html

Logistics:
http://localhost:3000/admin-logistics.html

Seller Account:
http://localhost:3000/admin-seller.html


IMPORTANT SEPARATION
--------------------
- Customer Track Order is not linked inside the Admin portal.
- Customer Shipping is not linked inside the Admin portal.
- Customer Returns Centre is not linked inside the Admin portal.
- Admin Returns Management is a separate protected page.
- Admin Logistics is only for courier, AWB, pickup and reverse-pickup operations.
- Customer pages contain no Admin links.
- Your exact index.html was not changed.

CUSTOMER RETURN FLOW
--------------------
1. Customer opens returns-center.html.
2. Customer enters Order ID and registered phone/email.
3. Customer submits cancellation, return or replacement.
4. The request is saved to the server.

ADMIN RETURN FLOW
-----------------
1. Administrator opens admin-returns.html.
2. Administrator reviews the request.
3. Administrator updates status and adds a note.
4. Administrator creates reverse pickup when required.
5. Refund status is updated by the administrator.

Real refunds require a connected payment gateway or verified manual payout.
Demo mode updates records but does not transfer actual money.
