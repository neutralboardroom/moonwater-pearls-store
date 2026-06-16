(function(){
  const products = window.MWP_PRODUCTS || [];
  const byId = new Map(products.map(p => [p.id, p]));
  const cartKey = 'mwp_cart';
  const money = cents => `$${(cents/100).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})} USD`;
  const readCart = () => { try { return JSON.parse(localStorage.getItem(cartKey) || '[]'); } catch { return []; } };
  const writeCart = cart => { localStorage.setItem(cartKey, JSON.stringify(cart)); renderCart(); };
  function addItem(id, quantity){
    const p = byId.get(id); if(!p) return;
    const cart = readCart();
    const existing = cart.find(i => i.id === id);
    const max = p.maxQuantity || 1;
    if(existing) existing.quantity = Math.min(max, existing.quantity + quantity);
    else cart.push({ id, quantity: Math.min(max, quantity) });
    writeCart(cart); openCart();
  }
  function removeItem(id){ writeCart(readCart().filter(i => i.id !== id)); }
  function renderCart(){
    const cart = readCart().filter(i => byId.has(i.id));
    const count = cart.reduce((n,i)=>n+i.quantity,0);
    document.querySelectorAll('[data-cart-count]').forEach(el => el.textContent = count);
    const total = cart.reduce((sum,i)=>sum+(byId.get(i.id).price*i.quantity),0);
    document.querySelectorAll('[data-cart-total]').forEach(el => el.textContent = money(total));
    document.querySelectorAll('[data-cart-input]').forEach(el => el.value = JSON.stringify(cart));
    const html = cart.length ? cart.map(i => lineHtml(byId.get(i.id), i.quantity)).join('') : '<p class="muted">Your cart is empty.</p>';
    document.querySelectorAll('[data-cart-items], [data-cart-page-items]').forEach(el => { el.innerHTML = html; });
  }
  function lineHtml(p, q){
    return `<div class="cart-line"><img src="${p.image}" alt=""><div><h3>${escapeHtml(p.title)}</h3><p>${money(p.price)} × ${q}</p><button type="button" data-remove-item="${p.id}">Remove</button></div><strong>${money(p.price*q)}</strong></div>`;
  }
  function escapeHtml(s){ return String(s).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
  function openCart(){ const d=document.querySelector('[data-cart-drawer]'), o=document.querySelector('[data-cart-overlay]'); if(d){d.classList.add('open');d.setAttribute('aria-hidden','false')} if(o){o.hidden=false;o.classList.remove('hidden');} }
  function closeCart(){ const d=document.querySelector('[data-cart-drawer]'), o=document.querySelector('[data-cart-overlay]'); if(d){d.classList.remove('open');d.setAttribute('aria-hidden','true')} if(o){o.hidden=true;o.classList.add('hidden');} }
  document.addEventListener('submit', e => {
    const form = e.target.closest('[data-add-product]');
    if(form){ e.preventDefault(); addItem(form.dataset.addProduct, Number(new FormData(form).get('quantity') || 1)); }
  });
  document.addEventListener('click', e => {
    const remove = e.target.closest('[data-remove-item]'); if(remove){ removeItem(remove.dataset.removeItem); }
    if(e.target.closest('[data-cart-open]')) openCart();
    if(e.target.closest('[data-cart-close]') || e.target.matches('[data-cart-overlay]')) closeCart();
    const thumb = e.target.closest('[data-thumb]');
    if(thumb){ document.querySelectorAll('.thumb').forEach(t=>t.classList.remove('active')); thumb.classList.add('active'); const main=document.querySelector('[data-main-image]'); if(main){ main.src=thumb.dataset.thumb; if(thumb.dataset.thumbAlt) main.alt=thumb.dataset.thumbAlt; } }
    if(e.target.closest('[data-search-open]')) openSearch();
    if(e.target.closest('[data-search-close]') || e.target.matches('[data-search-modal]')) closeSearch();
  });
  function openSearch(){ const m=document.querySelector('[data-search-modal]'); if(m){ m.hidden=false; m.classList.remove('hidden'); const input=m.querySelector('[data-search-input]'); if(input) setTimeout(()=>input.focus(),50); renderSearch(''); } }
  function closeSearch(){ const m=document.querySelector('[data-search-modal]'); if(m){ m.hidden=true; m.classList.add('hidden'); } }
  document.addEventListener('keydown', e => { if(e.key === 'Escape'){ closeSearch(); closeCart(); } });
  const searchInput = document.querySelector('[data-search-input]');
  if(searchInput) searchInput.addEventListener('input', e => renderSearch(e.target.value));
  function renderSearch(q){ const box=document.querySelector('[data-search-results]'); if(!box)return; const term=(q||'').toLowerCase().trim(); const matches=term?products.filter(p => (p.title+' '+p.priceText).toLowerCase().includes(term)):products.slice(0,5); box.innerHTML = matches.map(p=>`<a class="search-result" href="/products/${p.handle}"><img src="${p.image}" alt=""><span>${escapeHtml(p.title)}<br><strong>${p.priceText}</strong></span></a>`).join(''); }
  const productGrid = document.querySelector('[data-product-grid]');
  const sort = document.querySelector('[data-sort]');
  const availabilityChecks = Array.from(document.querySelectorAll('[data-filter-availability]'));
  const priceMin = document.querySelector('[data-price-min]');
  const priceMax = document.querySelector('[data-price-max]');
  const clearFilters = document.querySelector('[data-clear-filters]');
  function applyFilters(){
    if(!productGrid)return;
    const activeAvailability = availabilityChecks.filter(c=>c.checked).map(c=>c.value);
    const min = priceMin && priceMin.value !== '' ? Number(priceMin.value) * 100 : null;
    const max = priceMax && priceMax.value !== '' ? Number(priceMax.value) * 100 : null;
    const cards = Array.from(productGrid.children).filter(c => c.classList && c.classList.contains('product-card'));
    cards.forEach(card => {
      const price = Number(card.dataset.productPrice || 0);
      const availability = card.dataset.productAvailability || 'In stock';
      const hideByAvailability = activeAvailability.length && !activeAvailability.includes(availability);
      const hideByMin = min !== null && price < min;
      const hideByMax = max !== null && price > max;
      card.style.display = (hideByAvailability || hideByMin || hideByMax) ? 'none' : '';
    });
    const visible = cards.filter(c => c.style.display !== 'none').length;
    document.querySelectorAll('[data-visible-count]').forEach(el=>el.textContent=visible);
    if(sort){
      const value=sort.value;
      const sorted=cards.sort((a,b)=>{
        if(value==='low') return Number(a.dataset.productPrice)-Number(b.dataset.productPrice);
        if(value==='high') return Number(b.dataset.productPrice)-Number(a.dataset.productPrice);
        const at=a.textContent.trim(), bt=b.textContent.trim();
        if(value==='za') return bt.localeCompare(at);
        if(value==='az') return at.localeCompare(bt);
        return 0;
      });
      sorted.forEach(c=>productGrid.appendChild(c));
    }
  }
  availabilityChecks.forEach(c=>c.addEventListener('change',applyFilters));
  [priceMin, priceMax].filter(Boolean).forEach(input=>input.addEventListener('input', applyFilters));
  if(clearFilters) clearFilters.addEventListener('click', () => { availabilityChecks.forEach(c=>c.checked=false); if(priceMin) priceMin.value=''; if(priceMax) priceMax.value=''; applyFilters(); });
  if(sort)sort.addEventListener('change',applyFilters);
  document.querySelectorAll('[data-checkout-form]').forEach(form => form.addEventListener('submit', e => { const cart=readCart(); if(!cart.length){ e.preventDefault(); openCart(); } }));
  renderCart();
})();
