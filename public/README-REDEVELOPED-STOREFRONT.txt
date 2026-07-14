APNAFINDS REDEVELOPED STOREFRONT
================================

REPLACED PAGES
--------------
index.html
products.html
product.html
wishlist.html

SHARED FILES
------------
css/storefront.css
js/products.js
js/wishlist.js
js/app.js
images/products/*.svg

CONNECTED FEATURES
------------------
- Home, Products, Product Details and Wishlist use one product catalogue.
- Cart quantity is shown as - 0 +, - 1 +, - 2 + and remains saved.
- The same cart is used by cart.html and checkout.html through apnafinds_cart.
- Heart buttons save products under apnafinds_wishlist.
- Wishlist drawer is available from every rebuilt page.
- Full wishlist page links to account.html#wishlist.
- Saved wishlist popup appears once per browser session.
- Product links open product.html?id=<product id>.
- Category links open products.html?category=<category>.
- Search opens products.html?q=<search>.
- Admin products from adminProducts are merged into the default catalogue.
- Random remote image services are ignored.
- All default product images are local.
- Missing product images fall back to images/products/apnafinds-product.svg.
- Product cards use an animated gold travelling border.
- These pages do not use Tailwind, so the Tailwind CDN warning is removed.

INSTALLATION
------------
Extract the small update ZIP into a temporary folder.

Copy these into your existing APNAFINDS02 folder:
index.html
products.html
product.html
wishlist.html
css/storefront.css
js/products.js
js/wishlist.js
js/app.js
images/products/

Choose Replace for the HTML/JS/CSS files.
Choose Merge for images/products.

OPEN CORRECTLY
--------------
Right-click index.html in VS Code and choose Open with Live Server.

Use an address such as:
http://127.0.0.1:5500/index.html

Do not open with file:/// because browser storage may not stay shared
between pages when the website is opened directly from the file system.
