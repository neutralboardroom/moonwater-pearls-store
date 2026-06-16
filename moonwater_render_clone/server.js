const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const { products, productByHandle } = require('./data/catalog');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const BRAND_PHONE = process.env.BRAND_PHONE || '1-800-363-4719';
const VERSION = '0.2.3';

function money(cents) {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`;
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function textOnly(html = '') {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function baseUrl(req) {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL.replace(/\/$/, '');
  const proto = req.headers['x-forwarded-proto'] || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host || `localhost:${PORT}`;
  return `${proto}://${host}`.replace(/\/$/, '');
}

function canonical(pathname, req) {
  return `${baseUrl(req)}${pathname}`;
}

function absoluteAssetUrl(req, src = '') {
  if (/^https?:\/\//i.test(src)) return src;
  const normalized = src.startsWith('/') ? src : `/${src}`;
  return `${baseUrl(req)}${normalized}`;
}

function send(res, status, body, type = 'text/html; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': type.includes('text/html') ? 'no-cache' : 'public, max-age=31536000, immutable' });
  res.end(body);
}

function redirect(res, location, status = 302) {
  res.writeHead(status, { Location: location });
  res.end();
}

const MIME = {
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8'
};

function tryStatic(req, res, pathname) {
  const safePath = path.normalize(decodeURIComponent(pathname)).replace(/^\.\.([/\\]|$)/, '');
  let filePath = path.join(PUBLIC_DIR, safePath);
  if (!filePath.startsWith(PUBLIC_DIR)) return false;
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) filePath = path.join(filePath, 'index.html');
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return false;
  const ext = path.extname(filePath).toLowerCase();
  send(res, 200, fs.readFileSync(filePath), MIME[ext] || 'application/octet-stream');
  return true;
}

function layout({ title, description, body, req, path: pagePath = '/', scripts = '', schema = '' }) {
  const url = canonical(pagePath, req);
  const productData = JSON.stringify(products.map(p => ({ id: p.id, title: p.title, handle: p.handle, price: p.price, priceText: p.priceText, image: p.images[0]?.src, maxQuantity: p.maxQuantity, availability: p.availability })));
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${url}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${baseUrl(req)}/assets/hero.webp">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/styles.css">
  ${schema}
</head>
<body>
  <a class="skip" href="#MainContent">Skip to content</a>
  <div class="announcement">Free shipping on all orders in the USA</div>
  <header class="site-header" data-header>
    <div class="header-inner">
      <a class="brand" href="/" aria-label="Moonwater Pearls home">
        <span class="brand-mark">◌</span><span>Moonwater Pearls</span>
      </a>
      <nav class="main-nav" aria-label="Main navigation">
        <a href="/">Home</a>
        <a href="/collections/what-you-see-is-what-you-get">Shop</a>
        <a href="/pages/our-story">Our Story</a>
        <a href="/pages/contact">Contact</a>
      </nav>
      <div class="header-actions">
        <a href="/account/login" class="login-link">Log in</a>
        <button class="link-button" data-search-open>Search</button>
        <button class="cart-button" data-cart-open>Cart <span data-cart-count>0</span></button>
      </div>
    </div>
  </header>
  <main id="MainContent">${body}</main>
  ${footer()}
  ${cartDrawer()}
  ${searchModal()}
  <script>window.MWP_PRODUCTS=${productData};</script>
  <script src="/app.js" defer></script>
  ${scripts}
</body>
</html>`;
}

function footer() {
  return `<footer class="site-footer">
    <div class="footer-grid">
      <section><h2>Closer to the source. More personal to buy.</h2><p>Moonwater Pearls brings you closer to the source, the selection process, and the real character of each piece. Join our list for new exact-piece arrivals, sourcing updates, and carefully chosen pearls shown with honesty and care.</p></section>
      <section><h2>Quick links</h2><ul class="footer-links"><li><a href="/collections/what-you-see-is-what-you-get">Shop Exact Pieces</a></li><li><a href="/collections/necklaces">Necklaces</a></li><li><a href="/collections/earrings">Earrings</a></li><li><a href="/collections/bracelets">Bracelets</a></li><li><a href="/collections/rings">Rings</a></li><li><a href="/pages/our-story">Our Story</a></li><li><a href="/pages/contact">Contact</a></li><li><a href="/policies/shipping-policy">Shipping Policy</a></li><li><a href="/policies/refund-policy">Return and Refund Policy</a></li><li><a href="/policies/privacy-policy">Privacy Policy</a></li><li><a href="/policies/terms-of-service">Terms of Service</a></li><li><a href="/pages/pearl-size-fit-guide">Pearl Size & Fit Guide</a></li></ul></section>
      <section><h2>Follow new arrivals and sourcing updates</h2><form class="newsletter" method="post" action="/newsletter"><label>Email <input name="email" type="email" required placeholder="email@example.com"></label><button type="submit">Sign up</button></form></section>
    </div>
    <div class="footer-bottom">© 2026, <a href="/">Moonwater Pearls</a></div>
  </footer>`;
}

function cartDrawer() {
  return `<div class="cart-overlay" data-cart-overlay hidden></div><aside class="cart-drawer" data-cart-drawer aria-label="Shopping cart" aria-hidden="true"><div class="cart-head"><h2>Item added to your cart</h2><button class="icon-button" data-cart-close aria-label="Close cart">×</button></div><div data-cart-items class="cart-items"></div><div class="cart-summary"><div><span>Subtotal</span><strong data-cart-total>$0.00 USD</strong></div><p class="muted small">Free shipping in the USA. Taxes, if any, are handled at checkout.</p><form data-checkout-form action="/checkout" method="post"><input type="hidden" name="cart" data-cart-input><button class="button full" type="submit">Check out</button></form><a class="button secondary full" href="/cart">View cart</a><button class="link-button center" data-cart-close>Continue shopping</button></div></aside>`;
}

function searchModal() {
  return `<div class="search-modal" data-search-modal hidden><div class="search-panel"><button class="icon-button search-close" data-search-close aria-label="Close search">×</button><h2>Search</h2><form action="/search" method="get" class="search-form"><input name="q" type="search" placeholder="Search exact pearl pieces" autocomplete="off" data-search-input><button type="submit">Search</button></form><div data-search-results class="search-results"></div></div></div>`;
}

function productCard(p) {
  return `<article class="product-card" data-product-type="${escapeHtml(p.type)}" data-product-availability="${escapeHtml(p.availability || 'In stock')}" data-product-price="${p.price}"><a class="card-image" href="/products/${p.handle}"><img src="${p.images[0].src}" alt="${escapeHtml(p.images[0].alt)}" loading="lazy"></a><div class="card-copy"><h3><a href="/products/${p.handle}">${escapeHtml(p.title)}</a></h3><p class="price">Regular price ${p.priceText}</p><p class="price visually-hidden">Sale price ${p.priceText}</p></div></article>`;
}

function homePage(req) {
  const featured = ['freshwater-necklace', 'mixed-necklace', 'tahitian-necklace', 'akoya-earrings'].map(id => products.find(p => p.id === id)).filter(Boolean);
  const body = `<section class="hero"><div class="hero-media"><img src="/assets/hero.webp" alt="Freshwater pearls on soft beige fabric for Moonwater Pearls homepage banner"></div><div class="hero-copy"><h1>Directly sourced pearls, selected with care.</h1><p>Individually photographed pearl pieces and exact pairs, reserved for the buyer who chooses them—so what you see is what you receive.</p><div class="hero-actions"><a class="button" href="/collections/what-you-see-is-what-you-get">Shop Exact Pieces</a><a class="button secondary" href="/collections/pearl-stud-earrings">Shop Pearl Earrings</a></div></div></section>
  <section class="why"><h2>Why Moonwater feels different</h2><div class="why-grid"><article><h3>Selected with Care</h3><p>We work through real relationships with pearl farms and selected suppliers, then choose pearl pieces with care for luster, shape, balance, and overall beauty.</p></article><article><h3>Naturally Unique</h3><p>Pearls are naturally unique, and we believe that is part of their beauty. Variation in tone, shape, luster, and surface character gives each piece its own individual character.</p></article><article><h3>Shown honestly. Chosen with care.</h3><p>We believe pearls should be photographed, described, and presented in a way that helps customers understand what they are choosing. That means thoughtful imagery, honest explanation, and a clearer, more personal buying experience.</p></article></div></section>
  <section class="text-band"><h2>Real sourcing. A more personal way to buy.</h2><p>Moonwater Pearls is built around real sourcing, careful selection, and honest presentation. We work closer to pearl farms and selected suppliers, then show each piece individually so you can see its natural character before you choose it. That means a clearer, more personal way to buy pearls — closer to the source and closer to the actual piece.</p></section>
  <section class="text-band"><h2>What you see is what you get</h2><p>Moonwater Pearls focuses on exact pieces and exact pairs. Each necklace, pair of earrings, or other pearl piece shown on our website is photographed individually and reserved for the buyer who chooses it.</p><p>That means the piece or pair you see is the piece or pair you receive, with its natural tone, shape, luster, surface character, and overall presence shown as clearly as possible.</p></section>
  <section class="text-band"><h2>Exact Pieces, Two Fulfillment Paths</h2><p>Some Moonwater pieces ship from our U.S. inventory for faster delivery.</p><p>Other pieces, especially higher-value exact pieces, may ship from our Asia fulfillment location. These pieces may take longer to arrive, but this allows us to offer a wider selection of individually photographed pearl jewelry, selected closer to the source and reserved for the customer who chooses it.</p><p>Every product page clearly states how that specific piece ships, so you know what to expect before ordering.</p><p><a class="button secondary" href="/collections/what-you-see-is-what-you-get">Shop exact pieces</a></p></section>
  <section class="collection-preview"><h2>Available Exact Pieces</h2><p>Browse the exact pieces currently available. Each piece is photographed individually and reserved for one buyer, so the item shown is the item you receive. Natural tone, shape, luster, and surface character are shown as clearly as possible.</p><div class="product-grid four">${featured.map(productCard).join('')}</div></section>`;
  return layout({ title: 'Moonwater Pearls | Exact Piece Cultured Pearl Jewelry', description: 'Shop individually photographed cultured pearl jewelry from Moonwater Pearls. Exact pieces and exact pairs are shown clearly and reserved for one buyer.', body, req, path: '/' });
}

function collectionPage(req, { title, introHtml, collectionProducts, pagePath, description }) {
  const highest = Math.max(...collectionProducts.map(p => p.price), 0);
  const inStockCount = collectionProducts.filter(p => (p.availability || 'In stock') === 'In stock').length;
  const body = `<section class="collection-page"><h1>Collection: ${escapeHtml(title)}</h1><div class="rich-text">${introHtml}</div>
    <div class="collection-tools"><details class="filter-box"><summary>Filter:</summary><div class="filter-panel"><h2>Availability</h2><p>0 selected</p><label><input type="checkbox" data-filter-availability value="In stock"> In stock (${inStockCount})</label><label><input type="checkbox" data-filter-availability value="Out of stock"> Out of stock (0)</label><h2>Price</h2><p>The highest price is ${money(highest)}</p><label>$ From <input type="number" min="0" step="1" data-price-min></label><label>$ To <input type="number" min="0" step="1" data-price-max></label><button class="link-button" type="button" data-clear-filters>Remove all</button></div></details><label class="sort-label">Sort by:<select data-sort><option value="featured">Featured</option><option value="relevant">Most relevant</option><option value="best">Best selling</option><option value="az">Alphabetically, A-Z</option><option value="za">Alphabetically, Z-A</option><option value="low">Price, low to high</option><option value="high">Price, high to low</option><option value="old">Date, old to new</option><option value="new">Date, new to old</option></select></label></div>
    <p class="count"><span data-visible-count>${collectionProducts.length}</span> products</p><div class="product-grid" data-product-grid>${collectionProducts.map(productCard).join('') || '<p class="muted">No products found</p>'}</div></section>`;
  return layout({ title: `${title} | Moonwater Pearls`, description, body, req, path: pagePath });
}

function shopPage(req) {
  return collectionPage(req, {
    title: 'Exact Pearl Pieces',
    pagePath: '/collections/what-you-see-is-what-you-get',
    description: 'Shop individually photographed pearl pieces and exact pairs from Moonwater Pearls. Each exact item is reserved for one buyer.',
    collectionProducts: products,
    introHtml: '<p>Shop individually photographed pearl pieces and exact pairs from Moonwater Pearls. Each necklace, pair of earrings, ring, pendant, bracelet, strand, or other pearl piece is shown clearly and reserved for one buyer.</p><p>For Exact Piece Reserved and Exact Pair Reserved listings, the piece, pair, or pearl strand shown in the photographs is the exact item reserved for the buyer. Some necklace strands may be shown before final knotting or finishing, and the product page will clearly state how that piece is completed before shipment.</p><p>Pearls are naturally unique, and we show each exact piece carefully so you can choose with confidence.</p><p>Some pieces ship from our U.S. inventory for faster delivery. Other higher-value exact pieces may ship from our Asia fulfillment location, giving customers access to a wider selection of exact photographed pearl jewelry selected closer to the source.</p><p>Each product page clearly states how that specific piece ships before you order.</p>'
  });
}

function pearlStudEarringsPage(req) {
  const earringProducts = products.filter(p => p.type === 'Earrings');
  return collectionPage(req, {
    title: 'Pearl Stud Earrings',
    pagePath: '/collections/pearl-stud-earrings',
    description: 'Shop individually photographed pearl stud earrings from Moonwater Pearls.',
    collectionProducts: earringProducts,
    introHtml: '<p>Shop individually photographed pearl stud earrings from Moonwater Pearls.</p><p>Each pair is shown clearly and reserved for one buyer. For Exact Pair Reserved earrings, the pair shown in the photographs is the exact pair you will receive.</p><p>Pearls are naturally unique, and we show each exact pair carefully so you can choose with confidence.</p><p>Some pairs ship from U.S. inventory for faster delivery. Other higher-value exact pairs may ship from our Asia fulfillment location.</p><p>Each product page clearly states how that specific pair ships before you order.</p>'
  });
}

function productPage(req, product) {
  const imageThumbs = product.images.map((img, i) => `<button class="thumb ${i === 0 ? 'active' : ''}" data-thumb="${escapeHtml(img.src)}" data-thumb-alt="${escapeHtml(img.alt)}" type="button"><img src="${escapeHtml(img.src)}" alt="${escapeHtml(img.alt)}">${img.mediaType === 'video_thumbnail' ? '<span class="video-pill">Video</span>' : ''}</button>`).join('');
  const isInStock = (product.availability || 'In stock') === 'In stock';
  const schema = `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'Product', name: product.title, description: textOnly(product.descriptionHtml).slice(0, 600), image: product.images.map(i => absoluteAssetUrl(req, i.src)), brand: { '@type': 'Brand', name: 'Moonwater Pearls' }, offers: { '@type': 'Offer', priceCurrency: 'USD', price: (product.price / 100).toFixed(2), availability: isInStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock', url: `${baseUrl(req)}/products/${product.handle}` } })}</script>`;
  const stockNote = isInStock ? '<p class="sale-copy">Sale Sold out</p>' : '<p class="sale-copy">Sold out</p>';
  const buyBox = isInStock ? `<form data-add-product="${product.id}" class="buy-box"><label>Quantity <input type="number" min="1" max="${product.maxQuantity}" value="1" name="quantity"></label><button class="button full" type="submit">Add to cart</button></form>` : '<div class="notice">This exact piece is currently marked sold or unavailable.</div>';
  const body = `<section class="product-page"><div class="product-gallery"><div class="main-image-wrap"><img data-main-image src="${escapeHtml(product.images[0].src)}" alt="${escapeHtml(product.images[0].alt)}"></div><div class="thumbs">${imageThumbs}</div></div><div class="product-info"><p class="badge">Free shipping in the USA</p><h1>${escapeHtml(product.title)}</h1><p class="price large">Regular price ${product.priceText}</p>${stockNote}${buyBox}<p class="pickup">Couldn't load pickup availability<br><button class="link-button" type="button">Refresh</button></p><div class="product-description">${product.descriptionHtml}</div></div></section><section class="related"><h2>You may also like</h2><div class="product-grid four">${products.filter(p => p.id !== product.id).slice(0,4).map(productCard).join('')}</div></section>`;
  return layout({ title: `${product.title.replace(' — Exact Piece Reserved','').replace(' — Exact Pair Reserved','')} | Moonwater Pearls`, description: product.summary, body, req, path: `/products/${product.handle}`, schema });
}

function pageTemplate(req, title, description, contentHtml, pagePath) {
  return layout({ title, description, req, path: pagePath, body: `<section class="page narrow">${contentHtml}</section>` });
}

function accountLoginPage(req) {
  const content = `<h1>Log in</h1><p>Customer account login is not active on this lower-cost Moonwater Pearls replacement yet.</p><p>Checkout and payment will be handled through Stripe. If you need help with an order, please use the Contact page.</p><p><a href="/collections/what-you-see-is-what-you-get">Continue shopping</a></p>`;
  return pageTemplate(req, 'Log in – Moonwater Pearls', 'Moonwater Pearls account login information.', content, '/account/login');
}

function storyPage(req) {
  const content = `<h1>Our Story</h1><p>Moonwater Pearls began with a simple belief: pearls should feel personal, beautiful, and honestly presented.</p><p>We focus on real pearl pieces shown individually and reserved for the buyer who chooses them. That means the necklace, pair of earrings, pendant, bracelet, strand, or other pearl piece shown on the product page is the piece or pair reserved for you. The piece you see is the piece you receive.</p><p>For individual pearl pieces, we call this Exact Piece Reserved. For earrings, we call it Exact Pair Reserved. Together, they are our What You See Is What You Get promise — and they are central to how we believe pearls should be offered online.</p><p>Moonwater Pearls grew from time spent closer to the source: visiting pearl farms, building supplier relationships, walking pearl markets, and seeing pearls before they become anonymous catalog items. When pearls are selected this way, each piece feels less like a generic product and more like something with its own character.</p><p>We created Moonwater Pearls as a U.S.-based, New York City-rooted pearl brand to offer something more thoughtful than the typical jewelry store experience. Instead of relying only on wholesale catalogs and generic product feeds, we work closer to pearl farms, supplier markets, and selected suppliers so we can choose pieces with more care and present them more clearly.</p><p>Our sourcing work is shaped by travel through pearl regions and supplier markets across East Asia, Southeast Asia, and the wider Asia-Pacific pearl world. These places help us better understand how pearls are grown, selected, traded, and presented — and they remind us that the story of a pearl begins long before it appears on a jewelry page.</p><p>That closeness to the source matters.</p><p>It helps us pay attention to the qualities that make a pearl piece feel special: luster, shape, balance, surface character, tone, and overall presence. It also allows us to present pieces more honestly, describe them more clearly, and give customers a better sense of what they are actually buying.</p><p>Some Moonwater pieces are held in U.S. inventory and ship faster from within the United States. Other pieces, especially higher-value exact pieces, may ship from our Asia fulfillment location. This gives customers access to a wider selection of individually photographed pearl jewelry, selected closer to the source and reserved for the person who chooses it.</p><p>Each product page clearly states how that specific piece ships, so customers can understand the delivery path before ordering.</p><p>Moonwater Pearls is not built around mass sameness. It is built around real sourcing, careful selection, and honest presentation.</p><p>We also believe presentation matters. The way a piece is photographed, described, and shared should help you understand both what makes it special and what you are buying. For us, that means thoughtful photography, honest descriptions, and a genuine effort to show each piece in a way that feels both real and beautiful.</p><p>Pearls are naturally unique, and we believe that should be embraced, not hidden. Variation in tone, shape, luster, surface character, and overall presence is part of what gives each pearl piece its individual character.</p><p>Moonwater Pearls may offer freshwater pearls, saltwater pearls, and other selected pearl pieces when available. Each product page is written to identify the specific piece being offered, including details such as pearl type, size, length, clasp or post material, condition, fulfillment path, and other relevant specifications.</p><p>At its heart, Moonwater Pearls is about bringing people closer to the source, closer to the selection process, and closer to pearl pieces that feel carefully chosen rather than mass-produced.</p><p>Our goal is simple: to offer real pearls through real sourcing, careful selection, honest presentation, and a more personal buying experience.</p>`;
  return pageTemplate(req, 'Our Story | Exact Piece Pearl Jewelry | Moonwater Pearls', 'Moonwater Pearls is a U.S.-based, New York City-rooted pearl brand built around real sourcing and exact-piece presentation.', content, '/pages/our-story');
}

function contactPage(req, notice = '') {
  const content = `${notice}<h1>Contact Moonwater Pearls</h1><p>At Moonwater Pearls, we believe buying pearls should feel personal, clear, and thoughtful.</p><p>If you have a question about a piece, sourcing, your order, or anything else, please send us a message using the form below.</p><p>We do our best to respond with the same care we bring to our selection and presentation.</p><p>Please allow a little time for a reply, especially if your question is about a specific piece or product request.</p><h2>Call us: ${escapeHtml(BRAND_PHONE)}</h2><h2>Contact form</h2><form class="contact-form" method="post" action="/contact"><label>Name<input name="name" autocomplete="name"></label><label>Email *<input name="email" type="email" autocomplete="email" required></label><label>Phone number<input name="phone" autocomplete="tel"></label><label>Comment<textarea name="comment" rows="7" required></textarea></label><button class="button" type="submit">Send</button></form><p class="muted small">We will reply as soon as we can, especially for questions about a specific exact piece.</p>`;
  return pageTemplate(req, 'Contact Moonwater Pearls | Exact Pearl Jewelry Questions', 'Contact Moonwater Pearls about exact pearl pieces, sourcing, shipping, orders, and product questions.', content, '/pages/contact');
}

function shippingPolicy(req) {
  const content = `<h1>Shipping policy</h1><h2>Shipping Policy</h2><p>Moonwater Pearls currently ships to customers in the United States.</p><h2>Free U.S. Shipping</h2><p>We offer free tracked shipping on U.S. orders unless otherwise stated on the product page or at checkout.</p><h2>Two Ways Your Piece May Ship</h2><p>Moonwater Pearls uses two fulfillment paths depending on the specific piece.</p><p>Some pieces are held in U.S. inventory and ship directly from the United States for faster delivery.</p><p>Other pieces, especially higher-value exact pieces, may ship from our Asia fulfillment location. These pieces may take longer to arrive, but they allow us to offer a wider selection of individually photographed pearl jewelry selected closer to the source.</p><p>Each product page will clearly state whether the item ships from U.S. inventory or ships from our Asia fulfillment location.</p><h2>Estimated Delivery Times</h2><p>U.S.-shipped pieces usually arrive within 4–10 business days after order processing.</p><p>Pieces shipped from our Asia fulfillment location usually arrive within 10–20 business days after order processing.</p><p>Delivery times are estimates and may vary due to carrier delays, customs processing, holidays, weather, or other shipping conditions.</p><h2>Order Processing</h2><p>After your order is placed, the exact piece is reserved, checked, packed, and prepared for shipment.</p><h2>Tracking</h2><p>You will receive tracking information by email once your order has shipped.</p><h2>Why Some Pieces Ship from Asia</h2><p>Some Moonwater pieces ship from our Asia fulfillment location because this gives customers access to a wider selection of exact photographed pearl jewelry selected closer to the source.</p><p>This helps reduce unnecessary middle steps and traditional inventory markups while allowing the customer to choose the exact piece shown in the photographs.</p><h2>Customs, Duties, and Import Processing</h2><p>Shipments from our Asia fulfillment location may be subject to customs review or import processing. Any duties, taxes, carrier fees, or import charges that may apply are controlled by government and carrier rules, not by Moonwater Pearls.</p><h2>Questions</h2><p>If you have a question about shipping time for a specific exact piece, please contact us before ordering.</p>`;
  return pageTemplate(req, 'Shipping policy – Moonwater Pearls', 'Moonwater Pearls shipping policy, free U.S. shipping, and estimated delivery times for U.S. and Asia fulfillment pieces.', content, '/policies/shipping-policy');
}

function refundPolicy(req) {
  const content = `<h1>Refund policy</h1><h2>Return and Refund Policy</h2><p>Last updated: May 16, 2026</p><p>We want you to feel confident buying from Moonwater Pearls. Each pearl piece or exact pair is photographed and described carefully so you can understand what you are buying before placing an order.</p><h2>Returns</h2><p>We accept return requests within 14 days of delivery for eligible items.</p><p>To be eligible for a return, the item must be unused, unworn, undamaged, and returned in its original condition with any original packaging included.</p><p>Because Moonwater Pearls focuses on individually photographed pearl pieces and exact pairs, the returned item must be the same piece or pair that was originally shipped.</p><h2>Non-Returnable Items</h2><p>For hygiene reasons, earrings are final sale unless they arrive damaged, incorrect, or materially different from the product description or photographs.</p><p>Gift cards, if offered, are non-returnable.</p><h2>Pieces Shipped from Our Asia Fulfillment Location</h2><p>Some higher-value exact pieces may ship from our Asia fulfillment location.</p><p>Pieces shipped from our Asia fulfillment location may take longer to arrive than pieces shipped from U.S. inventory. The estimated delivery path and timing for each item should be stated on the product page before purchase.</p><p>A longer delivery time for a clearly labeled item shipped from our Asia fulfillment location is not considered a defect, incorrect item, or material misdescription, as long as the item is shipped within the stated process and the customer receives the correct piece described and photographed on the product page.</p><p>Approved returns should not be sent back to Asia. If a return is approved, we will provide return instructions for sending the item to our New York City return location.</p><h2>How to Start a Return</h2><p>To request a return, please contact us through our Contact page within 14 days of delivery. Please include your order number and the reason for the return.</p><p>Please do not send any item back before your return request is approved. Returns sent without approval may not be accepted.</p><p>If your return is accepted, we will provide instructions for where and how to send the item back.</p><h2>Return Shipping</h2><p>Customers are responsible for return shipping costs unless the item arrived damaged, incorrect, or there was a clear error on our side.</p><p>We recommend using a trackable shipping service, because we cannot issue a refund for a return that is not received.</p><h2>Damaged, Incorrect, or Materially Different Items</h2><p>Please inspect your order when it arrives.</p><p>If your item arrives damaged, incorrect, or materially different from the product description or photographs, please contact us as soon as possible and include your order number and photos of the item and packaging.</p><p>If the issue is approved, we will work with you on the appropriate next step, which may include a return, refund, replacement when available, or other resolution.</p><h2>Refunds</h2><p>Once an approved return is received and inspected, we will notify you whether the refund has been approved.</p><p>If approved, your refund will be issued to the original payment method. Please allow several business days for your bank, card issuer, or payment provider to process the refund after it is issued.</p><p>Original shipping costs, if any, may not be refundable unless the item arrived damaged, incorrect, or there was a clear error on our side.</p><h2>Exchanges</h2><p>We do not currently offer direct exchanges through the website.</p><p>If a return is approved and you would like a different item, you may place a new order separately.</p><h2>Natural Pearl Characteristics</h2><p>Pearls are natural and may show variation in tone, shape, luster, surface character, size, and overall presence. These natural characteristics are not considered defects when they are shown in the photographs or described on the product page.</p><h2>Exact Piece and Exact Pair Promise</h2><p>For Exact Piece Reserved items, the pearl piece shown in the photographs is the piece you receive.</p><p>For Exact Pair Reserved earrings, the pair shown in the photographs is the pair you receive.</p><p>Because each piece or pair is photographed individually, the product photographs and description are an important part of the listing. Please review them carefully before ordering.</p><h2>Questions</h2><p>If you have a question about a return, refund, shipping path, or specific exact piece, please contact us through our Contact page before placing an order.</p>`;
  return pageTemplate(req, 'Refund policy – Moonwater Pearls', 'Moonwater Pearls return and refund policy for exact pieces and exact pairs.', content, '/policies/refund-policy');
}

function privacyPolicy(req) {
  const content = `<h1>Privacy policy</h1><p>Last updated: April 13, 2026</p><p>Moonwater Pearls operates this store and website, including related information, content, features, tools, products, and services, in order to provide customers with a curated shopping experience.</p><p>This Privacy Policy describes how we collect, use, and disclose personal information when customers visit, use, make a purchase, or otherwise communicate with Moonwater Pearls.</p><h2>Personal Information We Collect or Process</h2><p>Depending on how you interact with the website, we may collect contact details, shipping and billing details, transaction details, communications with us, device information, usage information, and payment-related information processed through our payment provider.</p><h2>How We Use Your Personal Information</h2><p>We use personal information to operate the store, process payments, fulfill orders, provide customer support, communicate about orders, improve the website, prevent fraud, comply with legal obligations, and send marketing communications when permitted.</p><h2>How We Disclose Personal Information</h2><p>We may disclose personal information to service providers that help us operate the website, process payments, ship products, provide support, analyze website use, or comply with law. Payment information is handled through the payment provider used at checkout.</p><h2>Third-Party Websites and Links</h2><p>The website may link to third-party websites or platforms. Moonwater Pearls is not responsible for the privacy practices, security, or content of third-party websites.</p><h2>Children's Data</h2><p>The website is not intended for children, and we do not knowingly collect personal information from children under the age of majority in their jurisdiction.</p><h2>Security and Retention</h2><p>No security measures are perfect, but we take reasonable steps to protect personal information and retain it only as needed to operate the business, comply with legal obligations, resolve disputes, and enforce agreements.</p><h2>Your Rights and Choices</h2><p>Depending on where you live, you may have rights to access, delete, correct, or request a copy of personal information we maintain, and to opt out of certain marketing communications.</p><h2>Changes to This Privacy Policy</h2><p>We may update this Privacy Policy from time to time by posting a revised version on this website.</p><h2>Contact</h2><p>For privacy questions, please call us at ${escapeHtml(BRAND_PHONE)} or use the contact form on our Contact page.</p>`;
  return pageTemplate(req, 'Privacy policy – Moonwater Pearls', 'Moonwater Pearls privacy policy for the independent replacement site.', content, '/policies/privacy-policy');
}

function termsPolicy(req) {
  const content = `<h1>Terms of service</h1><p>Last updated: May 16, 2026</p><p>This website is operated by Moonwater Pearls. By visiting our site, using our website, or purchasing from us, you agree to these Terms of Service and any other policies posted on our website, including our Shipping Policy, Return and Refund Policy, and Privacy Policy.</p><h2>Products</h2><p>Moonwater Pearls sells pearl jewelry and related items as described on our website.</p><p>Moonwater Pearls focuses on real pearl pieces shown individually and reserved for the buyer who chooses them. For individual pearl pieces, we may use the term Exact Piece Reserved. For earrings, we may use the term Exact Pair Reserved.</p><p>For Exact Piece Reserved items, the item shown in the product photographs is the exact piece you will receive.</p><p>For Exact Pair Reserved earrings, the pair shown in the product photographs is the exact pair you will receive.</p><p>Many of our pieces are made with cultured pearls. When a product page identifies a pearl type, such as freshwater pearl, Akoya pearl, Tahitian pearl, South Sea pearl, or another type, that description applies to that specific product.</p><p>Because pearls are natural materials, each piece may show natural variation in tone, shape, luster, surface character, size, and overall appearance. We do our best to photograph and describe each piece clearly and honestly, but colors may appear slightly different depending on lighting, photography, screen settings, and device display.</p><h2>Product Descriptions, Measurements, and Photographs</h2><p>We make reasonable efforts to provide accurate product descriptions, photographs, measurements, materials, fulfillment details, and other product information.</p><p>Measurements are approximate unless otherwise stated.</p><p>Product photographs are intended to show the actual piece or pair being offered, but lighting, close-up photography, and screen display settings may affect how color, scale, and surface details appear.</p><p>Because our pieces are photographed individually, customers should review all product photographs, descriptions, measurements, and listed details before placing an order.</p><h2>Fulfillment and Shipping Paths</h2><p>Moonwater Pearls uses two fulfillment paths depending on the specific piece.</p><p>Some pieces are held in U.S. inventory and ship directly from within the United States.</p><p>Other pieces, especially higher-value exact pieces, may ship from our Asia fulfillment location. These pieces may take longer to arrive, but they allow us to offer a wider selection of individually photographed pearl jewelry selected closer to the source.</p><p>Each product page should state how that specific item ships before purchase. Customers should review the fulfillment information on the product page before placing an order.</p><h2>Shipping</h2><p>Moonwater Pearls currently focuses on shipping to customers in the United States.</p><p>Shipping times, methods, costs, and delivery estimates are described in our Shipping Policy, on the product page, or at checkout.</p><p>U.S.-shipped pieces and pieces shipped from our Asia fulfillment location may have different estimated delivery times. Delivery estimates are not guarantees unless expressly stated.</p><p>Pieces shipped from our Asia fulfillment location may take longer than U.S.-shipped items due to international carrier handling, customs processing, holidays, weather, or other shipping conditions.</p><p>Shipments from our Asia fulfillment location may be subject to customs review or import processing. Any duties, taxes, carrier fees, or import charges that may apply are controlled by government and carrier rules, not by Moonwater Pearls.</p><p>If we are unable to ship within the stated or expected timeframe, we may contact you with updated information or cancel and refund the order when appropriate.</p><p>Please review our Shipping Policy for more details.</p><h2>Pricing and Availability</h2><p>All prices are listed in U.S. dollars.</p><p>We reserve the right to change product pricing, availability, descriptions, photographs, promotions, fulfillment details, or website content at any time without notice.</p><p>Because some items are one-of-a-kind or limited in quantity, availability is not guaranteed until an order is accepted and processed.</p><h2>Orders</h2><p>We reserve the right to refuse, cancel, or limit any order at our discretion, including orders affected by pricing errors, inventory errors, fulfillment issues, suspected fraud, payment issues, shipping limitations, or other problems.</p><p>If an order is canceled after payment has been authorized or collected, we will issue a refund to the original payment method for the canceled item or order.</p><p>An order confirmation email does not guarantee final acceptance of an order. We may contact you if additional information is needed to process your order.</p><h2>Payment</h2><p>Payment must be completed through the payment methods available at checkout.</p><p>By placing an order, you confirm that the payment information you provide is accurate and that you are authorized to use the selected payment method.</p><h2>Taxes</h2><p>Applicable taxes, if any, may be calculated and added at checkout based on the shipping address, product type, and applicable law.</p><h2>Returns and Refunds</h2><p>Please review our Return and Refund Policy for details about returns, final sale items, damaged items, incorrect items, materially misdescribed items, refund eligibility, and the return process.</p><p>Because Exact Piece Reserved items and Exact Pair Reserved earrings are photographed individually and reserved for a specific buyer, return eligibility may differ from ordinary mass-inventory products.</p><h2>Website Errors and Accuracy</h2><p>We do our best to keep the website accurate and up to date. However, errors may occasionally occur, including errors in pricing, product descriptions, availability, shipping information, fulfillment information, photographs, measurements, or other content.</p><p>We reserve the right to correct errors, update information, cancel affected orders, or refuse orders based on inaccurate information.</p><h2>Intellectual Property</h2><p>All content on this site, including text, photographs, branding, logos, product images, design elements, and other materials, belongs to Moonwater Pearls unless otherwise stated.</p><p>You may not copy, reproduce, distribute, modify, sell, or use our content without written permission.</p><h2>Personal Use of Website</h2><p>You agree not to misuse this website, interfere with its operation, attempt unauthorized access, copy content without permission, or use the website for unlawful purposes.</p><h2>Limitation of Liability</h2><p>To the fullest extent permitted by law, Moonwater Pearls shall not be liable for indirect, incidental, special, consequential, or punitive damages arising from the use of this website, the inability to use this website, or the purchase, delivery, delay, or use of products from this website.</p><p>Nothing in these Terms is intended to limit rights that cannot be limited under applicable law.</p><h2>Changes to These Terms</h2><p>We may update these Terms of Service from time to time by posting a revised version on this website. The updated version will apply once posted, unless otherwise stated.</p><h2>Contact</h2><p>For questions about these Terms of Service, please contact us through the contact information provided on our website.</p>`;
  return pageTemplate(req, 'Terms of service – Moonwater Pearls', 'Moonwater Pearls terms of service for exact-piece pearl jewelry purchases.', content, '/policies/terms-of-service');
}

function sizeGuide(req) {
  const content = `<h1>Pearl Size & Fit Guide</h1><p>Choosing pearl jewelry online should feel clear and comfortable.</p><p>Our Pearl Size & Fit Guide is here to help you better understand how different pearl sizes and necklace lengths may look when worn. Because real pearls can feel different in person than they do in photos, this guide is meant to make shopping easier and more confident.</p><h2>Earring Size Guide</h2><p>Pearl sizes are generally measured in millimeters (mm). Even a small change in size can create a noticeably different look, especially in stud earrings and necklaces.</p><h3>Small Pearls (about 5mm to 6mm)</h3><p>Smaller pearls feel delicate, understated, and easy for everyday wear. They offer a softer, more subtle look and are ideal for customers who prefer refined simplicity.</p><h3>Medium Pearls (about 6mm to 8mm)</h3><p>This is the classic range for pearl jewelry and one of the most versatile. Medium pearls feel balanced, elegant, and easy to wear for both everyday and more dressed-up occasions.</p><h3>Larger Pearls (about 8mm and above)</h3><p>Larger pearls make more of a statement. They feel more noticeable on the ear or neckline and are often chosen by customers who want a bolder, more distinctive pearl look.</p><h2>How Pearl Stud Sizes May Look</h2><p>Pearl stud earrings can appear very different depending on ear size, personal style, and hairstyle. In general:</p><ul><li>5–6mm feels delicate and understated</li><li>6–7mm feels classic and balanced</li><li>7–8mm feels more visible and slightly dressier</li><li>8mm and above feels more prominent and statement-making</li></ul><p>If you are unsure, the 6–7mm range is often a strong starting point for a timeless everyday pearl stud.</p><h2>Necklace Length Guide</h2><p>Necklace length can affect both comfort and style.</p><p>A shorter pearl necklace sits closer to the neck and feels classic and refined. A slightly longer necklace offers a bit more room and layering flexibility.</p><p>Our necklace lengths may vary by style, but common lengths include:</p><ul><li>42cm: a classic close-to-the-neck pearl length</li><li>45cm: a slightly longer and very versatile everyday length</li><li>Adjustable styles: added flexibility depending on neckline and preference</li></ul><p>If you prefer a neater, more classic fit, choose the shorter option. If you want a bit more breathing room or styling flexibility, a slightly longer or adjustable length may feel better.</p><h2>A Note About Real Pearls</h2><p>Real pearls are naturally unique. This means size, shape, surface character, tone, and luster can vary slightly from piece to piece. That natural variation is part of what makes pearl jewelry personal and beautiful.</p><p>If you ever have questions about sizing, feel free to contact us before ordering. We want your piece to feel beautiful, comfortable, and right for you.</p>`;
  return pageTemplate(req, 'Pearl Size & Fit Guide | Moonwater Pearls', 'Moonwater Pearls pearl size and necklace fit guide for online buyers.', content, '/pages/pearl-size-fit-guide');
}

function cartPage(req) {
  const content = `<h1>Your cart</h1><div data-cart-page-items class="cart-page-items"></div><div class="cart-summary page-summary"><div><span>Subtotal</span><strong data-cart-total>$0.00 USD</strong></div><form data-checkout-form action="/checkout" method="post"><input type="hidden" name="cart" data-cart-input><button class="button" type="submit">Check out</button></form><p><a href="/collections/what-you-see-is-what-you-get">Continue shopping</a></p></div>`;
  return pageTemplate(req, 'Cart – Moonwater Pearls', 'Moonwater Pearls shopping cart.', content, '/cart');
}

function searchPage(req, q) {
  const query = (q || '').trim().toLowerCase();
  const results = query ? products.filter(p => `${p.title} ${p.type} ${p.summary}`.toLowerCase().includes(query)) : [];
  const content = `<h1>Search</h1><form action="/search" method="get" class="search-form page-search"><input name="q" type="search" value="${escapeHtml(q || '')}" placeholder="Search exact pearl pieces"><button type="submit">Search</button></form>${query ? `<p>${results.length} result${results.length === 1 ? '' : 's'} for “${escapeHtml(q)}”.</p><div class="product-grid">${results.map(productCard).join('') || '<p>No products matched that search.</p>'}</div>` : '<p>Enter a search term to find exact pearl pieces.</p>'}`;
  return pageTemplate(req, 'Search – Moonwater Pearls', 'Search exact pearl pieces and exact pearl pairs from Moonwater Pearls.', content, `/search${q ? `?q=${encodeURIComponent(q)}` : ''}`);
}

function health(req) {
  return JSON.stringify({ ok: true, service: 'moonwater-pearls', version: VERSION, products: products.length, stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY), emailConfigured: Boolean(process.env.RESEND_API_KEY && process.env.CONTACT_TO_EMAIL), baseUrl: baseUrl(req) }, null, 2);
}

async function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 1_000_000) reject(new Error('Body too large'));
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function parseForm(body) {
  return Object.fromEntries(new URLSearchParams(body));
}

async function notifyOwner(subject, text) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_TO_EMAIL;
  if (!apiKey || !to) return false;
  const from = process.env.CONTACT_FROM_EMAIL || 'Moonwater Pearls <onboarding@resend.dev>';
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ from, to: [to], subject, text })
    });
    if (!response.ok) {
      console.error('Resend email error', await response.text());
      return false;
    }
    return true;
  } catch (error) {
    console.error('Email notification failed', error);
    return false;
  }
}

async function handleCheckout(req, res) {
  const body = await readBody(req);
  const form = parseForm(body);
  let cart;
  try { cart = JSON.parse(form.cart || '[]'); } catch { cart = []; }
  if (!Array.isArray(cart) || cart.length === 0) return send(res, 400, pageTemplate(req, 'Cart empty – Moonwater Pearls', 'Your cart is empty.', '<h1>Your cart is empty</h1><p><a href="/collections/what-you-see-is-what-you-get">Continue shopping</a></p>', '/cart'));
  const validItems = [];
  for (const item of cart) {
    const product = products.find(p => p.id === item.id);
    if (!product) continue;
    const qty = Math.max(1, Math.min(product.maxQuantity || 1, Number(item.quantity) || 1));
    validItems.push({ product, qty });
  }
  if (validItems.length === 0) return send(res, 400, 'No valid cart items.');
  if (!process.env.STRIPE_SECRET_KEY) {
    const content = `<h1>Checkout is not configured yet</h1><p>The replacement site is working, but Stripe checkout needs a Render environment variable named <code>STRIPE_SECRET_KEY</code> before live orders can be paid online.</p><p>Your cart is still saved in this browser. You can also contact Moonwater Pearls about the exact piece.</p><p><a class="button" href="/pages/contact">Contact Moonwater Pearls</a></p>`;
    return send(res, 503, pageTemplate(req, 'Checkout setup needed – Moonwater Pearls', 'Stripe checkout needs to be configured.', content, '/checkout'));
  }
  const params = new URLSearchParams();
  params.append('mode', 'payment');
  params.append('success_url', `${baseUrl(req)}/checkout/success?session_id={CHECKOUT_SESSION_ID}`);
  params.append('cancel_url', `${baseUrl(req)}/cart`);
  params.append('shipping_address_collection[allowed_countries][]', 'US');
  params.append('billing_address_collection', 'auto');
  params.append('phone_number_collection[enabled]', 'true');
  validItems.forEach(({ product, qty }, i) => {
    params.append(`line_items[${i}][price_data][currency]`, 'usd');
    params.append(`line_items[${i}][price_data][unit_amount]`, String(product.price));
    params.append(`line_items[${i}][price_data][product_data][name]`, product.title);
    params.append(`line_items[${i}][price_data][product_data][description]`, product.summary.slice(0, 500));
    params.append(`line_items[${i}][price_data][product_data][images][]`, absoluteAssetUrl(req, product.images[0].src));
    params.append(`line_items[${i}][quantity]`, String(qty));
  });
  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params
  });
  const json = await response.json();
  if (!response.ok || !json.url) {
    console.error('Stripe checkout error', json);
    return send(res, 502, pageTemplate(req, 'Checkout error – Moonwater Pearls', 'There was a checkout setup error.', '<h1>Checkout error</h1><p>Stripe returned an error. Please check the Render logs and Stripe key.</p><p><a href="/cart">Return to cart</a></p>', '/checkout'));
  }
  redirect(res, json.url, 303);
}

async function handleContact(req, res) {
  const body = await readBody(req);
  const form = parseForm(body);
  const submission = { at: new Date().toISOString(), name: form.name || '', email: form.email || '', phone: form.phone || '', comment: form.comment || '' };
  const dir = path.join(__dirname, 'submissions');
  fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(path.join(dir, 'contact.jsonl'), JSON.stringify(submission) + '\n');
  const sent = await notifyOwner('Moonwater Pearls contact form', `Name: ${submission.name}\nEmail: ${submission.email}\nPhone: ${submission.phone}\n\n${submission.comment}`);
  return send(res, 200, contactPage(req, `<div class="notice">Thank you. Your message has been ${sent ? 'sent' : 'received'}.</div>`));
}

async function handleNewsletter(req, res) {
  const body = await readBody(req);
  const form = parseForm(body);
  const submission = { at: new Date().toISOString(), email: form.email || '' };
  const dir = path.join(__dirname, 'submissions');
  fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(path.join(dir, 'newsletter.jsonl'), JSON.stringify(submission) + '\n');
  await notifyOwner('Moonwater Pearls newsletter signup', `Email: ${submission.email}`);
  return send(res, 200, pageTemplate(req, 'Thank you – Moonwater Pearls', 'Newsletter signup received.', '<h1>Thank you</h1><p>Your email has been received for Moonwater Pearls updates.</p><p><a href="/collections/what-you-see-is-what-you-get">Continue shopping</a></p>', '/newsletter'));
}

function collectionDefinitions() {
  return {
    'necklaces': { title: 'Necklaces', description: 'Exact pearl necklaces and strands from Moonwater Pearls.', intro: '<p>Exact pearl necklaces and strands currently available from Moonwater Pearls.</p>' },
    'earrings': { title: 'Earrings', description: 'Exact pearl earring pairs from Moonwater Pearls.', intro: '<p>Exact pearl earring pairs currently available from Moonwater Pearls.</p>' },
    'rings': { title: 'Rings', description: 'Exact pearl rings from Moonwater Pearls.', intro: '<p>Exact pearl rings currently available from Moonwater Pearls.</p>' },
    'bracelets': { title: 'Bracelets', description: 'Exact pearl bracelets from Moonwater Pearls.', intro: '<p>Exact pearl bracelets currently available from Moonwater Pearls.</p>' },
    'pearl-stud-earrings': { title: 'Pearl Stud Earrings', description: 'Exact pearl stud earrings and exact earring pairs from Moonwater Pearls.', intro: '<p>Shop pearl stud earrings and exact earring pairs from Moonwater Pearls.</p>' },
    'tahitian-pearls': { title: 'Tahitian Pearls', description: 'Tahitian pearl exact pieces from Moonwater Pearls.', intro: '<p>Exact pieces featuring Tahitian cultured pearls, including dark tones, baroque character, and mixed pearl designs.</p>' },
    'south-sea-pearls': { title: 'South Sea Pearls', description: 'South Sea pearl exact pieces from Moonwater Pearls.', intro: '<p>Exact pieces featuring South Sea pearls, including white and golden South Sea tones in mixed baroque designs.</p>' },
    'freshwater-pearls': { title: 'Freshwater Pearls', description: 'Freshwater and Edison freshwater pearl exact pieces from Moonwater Pearls.', intro: '<p>Exact freshwater pearl and Edison freshwater pearl pieces currently available from Moonwater Pearls.</p>' },
    'akoya-pearls': { title: 'Akoya Pearls', description: 'Akoya pearl exact pieces from Moonwater Pearls.', intro: '<p>Exact Akoya pearl pieces currently available from Moonwater Pearls.</p>' }
  };
}

function namedCollectionPage(req, slug) {
  const definitions = collectionDefinitions();
  const def = definitions[slug];
  if (!def) return null;
  const collectionProducts = products.filter(p => (p.collections || []).includes(slug));
  return collectionPage(req, { title: def.title, introHtml: def.intro, collectionProducts, pagePath: `/collections/${slug}`, description: def.description });
}

function merchantFeed(req) {
  const rows = [['id','title','description','link','image_link','availability','price','brand','condition','product_type','google_product_category']];
  for (const p of products) {
    const availability = (p.availability || 'In stock') === 'In stock' ? 'in_stock' : 'out_of_stock';
    rows.push([p.id, p.title, textOnly(p.descriptionHtml).slice(0, 4500), `${baseUrl(req)}/products/${p.handle}`, absoluteAssetUrl(req, p.images[0].src), availability, p.priceText.replace(' USD',' USD'), 'Moonwater Pearls', 'new', `Apparel & Accessories > Jewelry > ${p.type}`, 'Apparel & Accessories > Jewelry']);
  }
  return rows.map(row => row.map(cell => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n');
}

function productFeed(req) {
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:g="http://base.google.com/ns/1.0"><channel><title>Moonwater Pearls Products</title><link>${baseUrl(req)}</link><description>Exact piece pearl jewelry</description>${products.map(p => {
    const availability = (p.availability || 'In stock') === 'In stock' ? 'in_stock' : 'out_of_stock';
    return `<item><g:id>${escapeHtml(p.id)}</g:id><title>${escapeHtml(p.title)}</title><description>${escapeHtml(textOnly(p.descriptionHtml).slice(0, 4500))}</description><link>${baseUrl(req)}/products/${p.handle}</link><g:image_link>${escapeHtml(absoluteAssetUrl(req, p.images[0].src))}</g:image_link><g:availability>${availability}</g:availability><g:price>${(p.price/100).toFixed(2)} USD</g:price><g:brand>Moonwater Pearls</g:brand><g:condition>new</g:condition><g:product_type>Apparel &amp; Accessories &gt; Jewelry &gt; ${escapeHtml(p.type)}</g:product_type><g:google_product_category>Apparel &amp; Accessories &gt; Jewelry</g:google_product_category></item>`;
  }).join('')}</channel></rss>`;
}

function catalogJson() {
  return JSON.stringify({ version: VERSION, products: products.map(p => ({ id: p.id, title: p.title, handle: p.handle, price: p.price, priceText: p.priceText, type: p.type, availability: p.availability, maxQuantity: p.maxQuantity, collections: p.collections || [], images: p.images, summary: p.summary })) }, null, 2);
}

function shopifyProductsJson(req) {
  return JSON.stringify({ products: products.map(p => ({ id: p.id, title: p.title, handle: p.handle, body_html: p.descriptionHtml, vendor: 'Moonwater Pearls', product_type: p.type, tags: (p.collections || []).join(','), variants: [{ id: `${p.id}-default`, title: 'Default Title', price: (p.price / 100).toFixed(2), available: (p.availability || 'In stock') === 'In stock' }], images: p.images.map((img, index) => ({ id: `${p.id}-${index + 1}`, src: absoluteAssetUrl(req, img.src), alt: img.alt })) })) }, null, 2);
}

function sitemap(req) {
  const collectionUrls = ['/collections/all', '/collections/what-you-see-is-what-you-get', ...Object.keys(collectionDefinitions()).map(slug => `/collections/${slug}`)];
  const urls = ['/', '/shop', ...collectionUrls, '/pages/our-story', '/pages/contact', '/account/login', '/policies/shipping-policy', '/policies/refund-policy', '/policies/privacy-policy', '/policies/terms-of-service', '/pages/pearl-size-fit-guide', '/cart', '/search', '/catalog.json', '/products.json', '/google-merchant-feed.csv', '/product-feed.xml', ...products.map(p => `/products/${p.handle}`)];
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(u => `<url><loc>${baseUrl(req)}${u}</loc></url>`).join('')}</urlset>`;
}

function robots(req) {
  return `User-agent: *\nAllow: /\nSitemap: ${baseUrl(req)}/sitemap.xml\n`;
}

const server = http.createServer(async (req, res) => {
  try {
    const parsed = new URL(req.url, baseUrl(req));
    const pathname = parsed.pathname.replace(/\/$/, '') || '/';

    if (req.method === 'GET' && tryStatic(req, res, parsed.pathname)) return;
    if (req.method === 'GET' && pathname === '/health') return send(res, 200, health(req), 'application/json; charset=utf-8');
    if (req.method === 'GET' && pathname === '/robots.txt') return send(res, 200, robots(req), 'text/plain; charset=utf-8');
    if (req.method === 'GET' && pathname === '/sitemap.xml') return send(res, 200, sitemap(req), 'application/xml; charset=utf-8');
    if (req.method === 'GET' && pathname === '/google-merchant-feed.csv') return send(res, 200, merchantFeed(req), 'text/csv; charset=utf-8');
    if (req.method === 'GET' && pathname === '/product-feed.xml') return send(res, 200, productFeed(req), 'application/xml; charset=utf-8');
    if (req.method === 'GET' && pathname === '/catalog.json') return send(res, 200, catalogJson(), 'application/json; charset=utf-8');
    if (req.method === 'GET' && pathname === '/products.json') return send(res, 200, shopifyProductsJson(req), 'application/json; charset=utf-8');
    if (req.method === 'GET' && pathname === '/') return send(res, 200, homePage(req));
    if (req.method === 'GET' && (pathname === '/shop' || pathname === '/collections/all' || pathname === '/collections/what-you-see-is-what-you-get')) return send(res, 200, shopPage(req));
    if (req.method === 'GET' && pathname.startsWith('/collections/')) {
      const page = namedCollectionPage(req, pathname.split('/').pop());
      if (page) return send(res, 200, page);
    }
    if (req.method === 'GET' && pathname === '/account/login') return send(res, 200, accountLoginPage(req));
    if (req.method === 'GET' && pathname === '/pages/our-story') return send(res, 200, storyPage(req));
    if (req.method === 'GET' && pathname === '/pages/contact') return send(res, 200, contactPage(req));
    if (req.method === 'GET' && pathname === '/policies/shipping-policy') return send(res, 200, shippingPolicy(req));
    if (req.method === 'GET' && pathname === '/policies/refund-policy') return send(res, 200, refundPolicy(req));
    if (req.method === 'GET' && pathname === '/policies/privacy-policy') return send(res, 200, privacyPolicy(req));
    if (req.method === 'GET' && pathname === '/policies/terms-of-service') return send(res, 200, termsPolicy(req));
    if (req.method === 'GET' && pathname === '/pages/pearl-size-fit-guide') return send(res, 200, sizeGuide(req));
    if (req.method === 'GET' && pathname === '/cart') return send(res, 200, cartPage(req));
    if (req.method === 'GET' && pathname === '/search') return send(res, 200, searchPage(req, parsed.searchParams.get('q') || ''));
    if (req.method === 'GET' && pathname === '/checkout/success') return send(res, 200, pageTemplate(req, 'Order received – Moonwater Pearls', 'Your checkout was completed.', '<h1>Thank you</h1><p>Your checkout was completed. Moonwater Pearls will confirm and prepare your exact piece.</p><script>localStorage.removeItem("mwp_cart");</script>', '/checkout/success'));
    if (req.method === 'POST' && pathname === '/checkout') return await handleCheckout(req, res);
    if (req.method === 'POST' && pathname === '/contact') return await handleContact(req, res);
    if (req.method === 'POST' && pathname === '/newsletter') return await handleNewsletter(req, res);
    if (req.method === 'GET' && pathname.startsWith('/products/')) {
      const handle = pathname.split('/').pop();
      const product = productByHandle.get(handle);
      if (product) {
        if (handle !== product.handle) return redirect(res, `/products/${product.handle}`, 301);
        return send(res, 200, productPage(req, product));
      }
    }
    send(res, 404, pageTemplate(req, 'Page not found – Moonwater Pearls', 'Page not found.', '<h1>Page not found</h1><p><a href="/collections/what-you-see-is-what-you-get">Shop exact pieces</a></p>', pathname));
  } catch (error) {
    console.error(error);
    send(res, 500, '<h1>Server error</h1><p>Please try again.</p>');
  }
});

if (require.main === module) {
  server.listen(PORT, () => console.log(`Moonwater Pearls running on http://localhost:${PORT}`));
}

module.exports = { server, products };
