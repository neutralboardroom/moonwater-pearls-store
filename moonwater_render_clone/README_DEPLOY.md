# Moonwater Pearls replacement site v0.2.3

This is a low-cost Shopify-style replacement for Moonwater Pearls that can run on Render as a Node web service on the free plan while sales are being tested.

## What is included

- Current Moonwater Pearls homepage, shop, story, contact, size guide, shipping, refund, privacy, and terms pages recreated from the live site
- Same public URL paths where practical, including `/products/...`, `/collections/what-you-see-is-what-you-get`, `/collections/all`, `/pages/our-story`, `/pages/contact`, and policy pages
- 9 exact-piece products in the current live collection order
- Product galleries expanded to match the live storefront media counts, including video-preview thumbnails where Shopify currently shows product videos
- Collection/category grouping for necklaces, earrings, bracelets, rings, freshwater pearls, Tahitian pearls, South Sea pearls, Akoya pearls, and pearl stud earrings
- Shopify-style cart drawer and cart page with one-item quantity limits for exact pieces
- Stripe Checkout Session support through `STRIPE_SECRET_KEY`
- Contact form and newsletter signup saved to local JSONL files under `/submissions`, with optional Resend email notifications
- SEO metadata, product schema, sitemap, robots.txt, Google Merchant CSV feed, XML product feed, `/catalog.json`, and Shopify-like `/products.json`

## Render setup

Create a new Render Web Service from this repo or upload. Use:

- Build command: `npm install --omit=dev`
- Start command: `npm start`
- Node version: 22

Environment variables:

- `PUBLIC_BASE_URL=https://moonwaterpearls.com`
- `STRIPE_SECRET_KEY=sk_live_...` when ready for live checkout
- `BRAND_PHONE=1-800-363-4719`
- `CONTACT_TO_EMAIL=reachrgnow@gmail.com` or the email address that should receive contact/newsletter notifications
- `RESEND_API_KEY=re_...` if you want the contact and newsletter forms to email you
- `CONTACT_FROM_EMAIL=Moonwater Pearls <hello@moonwaterpearls.com>` after the sending domain is verified in Resend

The app works without Stripe, but checkout will show a setup message until `STRIPE_SECRET_KEY` is configured. Contact and newsletter forms still show a thank-you page without Resend, but Render free-plan local file storage should not be treated as permanent.

## Media preservation note

Some supplemental gallery images and video-preview thumbnails are referenced from the current public Shopify CDN so the replacement storefront does not visually lose product media during the transition. See `MEDIA_MANIFEST.md`.

Before canceling Shopify permanently, download or export the original product images/videos and replace any remote Shopify CDN URLs with local files under `public/assets/products`. This will make the replacement fully independent of Shopify-hosted media.

## Before canceling Shopify

Do not cancel Shopify until:

1. The Render site is live.
2. The domain is pointed to the new Render service.
3. Product pages, photos, gallery counts, collection grouping, cart, and checkout setup are verified.
4. Stripe checkout is tested with a small test order or Stripe test key.
5. Google Merchant links are updated to the new feed URLs.
6. You export or preserve any Shopify order/customer/product/media data you want to keep.

## Manual inventory

Each exact piece has `maxQuantity: 1`. When a piece sells, edit `data/catalog.js` and change `availability` from `In stock` to `Out of stock`, then redeploy. Checkout automatically skips products marked out of stock.

## Policy note

The old Shopify privacy policy was Shopify-specific. This build keeps the same policy structure but changes the privacy language to fit the independent site. Review it before launch once the final checkout, analytics, email, and hosting tools are confirmed.
