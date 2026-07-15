APNAFINDS RETURNS & REFUNDS FIX V6
=================================

WHAT WAS FIXED
--------------
- Returns now search the Node.js server first.
- Browser orders are used only as a fallback.
- Refund, Return, Returns Center and return.html all open the same working page.
- Existing request status is displayed from the server.
- Cancellation selects the whole order automatically.
- Return and replacement select individual products and quantities.
- Submitted requests appear in Admin Management.
- Reverse pickup continues automatically in demo mode.
- Demo return/refund status advances automatically.
- Cancellation refund status is connected to the order/payment record.
- Your exact Index page was not changed.

INSTALL THE PATCH
-----------------
Copy the patch files into the root of your current ApnaFinds V5 project.
Choose Replace and Merge when Windows asks.

Or use the complete V6 ZIP in a new folder.

OPEN
----
1. Double-click START-APNAFINDS.bat.
2. Keep the black window open.
3. Open:
   http://localhost:3000/returns-center.html

You may also double-click:
OPEN-RETURNS-REFUNDS.bat

TEST RULES
----------
- Order placed / Confirmed / Packed: cancellation is available.
- Delivered: return and replacement are available.
- Shipped / In transit: self-service cancellation or return is unavailable.

ADMIN
-----
Open:
http://localhost:3000/admin-management.html#returns

Real refunds require a payment provider or verified manual payout.
Demo mode changes status but does not transfer real money.
