const { server, products } = require('../server');
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const PORT = 3219;
const base = `http://127.0.0.1:${PORT}`;

const expectedMediaCounts = {
  'freshwater-necklace': 7,
  'tahitian-necklace': 5,
  'floral-earrings': 4,
  'mixed-necklace': 7,
  'mixed-bracelet': 5,
  'edison-ring': 7,
  'tahitian-baroque': 4,
  'akoya-earrings': 8,
  'edison-necklace': 5
};

async function fetchText(route){
  const res = await fetch(base + route);
  assert(res.status < 400, `${route} returned ${res.status}`);
  const text = await res.text();
  assert(text.length > 20, `${route} returned short content`);
  return text;
}

async function main(){
  await new Promise(resolve => server.listen(PORT, resolve));
  const paths = [
    '/', '/shop', '/collections/all', '/collections/what-you-see-is-what-you-get',
    '/collections/pearl-stud-earrings', '/collections/necklaces', '/collections/earrings',
    '/collections/bracelets', '/collections/rings', '/collections/tahitian-pearls',
    '/collections/south-sea-pearls', '/collections/freshwater-pearls', '/collections/akoya-pearls',
    '/account/login', '/pages/our-story', '/pages/contact', '/policies/shipping-policy',
    '/policies/refund-policy', '/policies/privacy-policy', '/policies/terms-of-service',
    '/pages/pearl-size-fit-guide', '/cart', '/search?q=Akoya', '/sitemap.xml', '/robots.txt',
    '/google-merchant-feed.csv', '/product-feed.xml', '/catalog.json', '/products.json', '/health'
  ];
  for (const product of products) {
    paths.push(`/products/${product.handle}`);
    assert.strictEqual((product.images || []).length, expectedMediaCounts[product.id], `${product.id} should match live media count`);
    for (const image of product.images || []) {
      if (!image.src.startsWith('/')) continue;
      const imagePath = path.join(__dirname, '..', 'public', image.src.replace(/^\//, ''));
      assert(fs.existsSync(imagePath), `Missing local image file ${image.src}`);
      assert(fs.statSync(imagePath).size > 1000, `Image file too small ${image.src}`);
    }
  }
  assert(fs.existsSync(path.join(__dirname, '..', 'public', 'assets', 'hero.webp')), 'Missing homepage hero image');
  for (const route of paths) await fetchText(route);

  const health = await (await fetch(base + '/health')).json();
  assert.strictEqual(health.ok, true);
  assert.strictEqual(health.version, '0.2.3');
  assert.strictEqual(health.products, products.length);
  assert.strictEqual(products.length, 9, 'Expected 9 live products from the current Shopify collection');
  assert(products.some(p => p.handle === '9-11mm-natural-deep-purple-edison-pearl-necklace'), 'Missing live Edison pearl necklace product');
  assert(products.some(p => p.handle === '8-11mm-tahitian-baroque-pearl-necklace-exact-piece-reserved' && p.priceText === '$695.00 USD'), 'Tahitian baroque necklace price should match live site');

  const collection = await fetchText('/collections/what-you-see-is-what-you-get');
  assert(collection.includes('<span data-visible-count>9</span> products'), 'Exact pieces collection should show 9 products');
  assert(collection.includes('9–11mm Natural Deep Purple Edison Pearl Necklace'), 'Exact pieces collection should include Edison necklace');
  assert(collection.indexOf('7–10mm White Freshwater Pearl Strand') < collection.indexOf('9–13mm Graduated Tahitian'), 'Exact pieces order should start like live Shopify collection');
  assert(collection.indexOf('8–11mm Graduated Tahitian Baroque Pearl Necklace') < collection.indexOf('8–9mm White Akoya Pearl Stud Earrings'), 'Exact pieces order should match live Shopify ordering near bottom');

  const earrings = await fetchText('/collections/pearl-stud-earrings');
  assert(earrings.includes('8–9mm White Akoya Pearl Stud Earrings'), 'Earrings collection should include Akoya studs');
  assert(earrings.includes('6–7mm Baroque Freshwater Pearl Floral Earrings'), 'Earrings collection should include floral earrings');
  const feed = await fetchText('/google-merchant-feed.csv');
  assert(feed.includes('tahitian-baroque') && feed.includes('$695.00 USD'), 'Merchant feed should include corrected Tahitian baroque price');
  const catalog = JSON.parse(await fetchText('/catalog.json'));
  assert.strictEqual(catalog.products.length, 9, 'Catalog JSON should include all products');
  console.log(`Checked ${paths.length} routes and ${products.length} products.`);
  await new Promise(resolve => server.close(resolve));
}

main().catch(async err => { console.error(err); try { await new Promise(resolve => server.close(resolve)); } catch {} process.exit(1); });
