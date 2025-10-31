



// Safe scroll handler: resolve header element at runtime (some pages use id, others don't)
window.addEventListener("scroll", () => {
  const headerElement = document.getElementById('headerElement') || document.querySelector('header')
  if (!headerElement) return
  if (window.scrollY > 100) {
    headerElement.classList.add("scroll-down")
  } else {
    headerElement.classList.remove("scroll-down")
  }
})

// Simple cart implementation using localStorage
const CART_KEY = "dioura_cart"
const ORDERS_KEY = "dioura_orders"
const PRODUCTS_KEY = "dioura_products"
const COUPONS_KEY = "dioura_coupons"
const SEARCH_KEY = 'dioura_search'
const FILTER_KEY = 'dioura_filter'
const CATEGORIES_KEY = 'dioura_categories'

// default categories if none persisted yet (mirrors admin defaults)
const DEFAULT_CATEGORIES = {
  'ملابس': ['نسائي', 'ولادي', 'رجالي'],
  'احذية': ['رجالي', 'نسائي'],
  'اكسسوارات': ['ساعات', 'حقائب', 'اخرى']
}

function getProducts(){
  try{return JSON.parse(localStorage.getItem(PRODUCTS_KEY)||'[]')}catch(e){return[]}
}

function saveProducts(list){
  localStorage.setItem(PRODUCTS_KEY, JSON.stringify(list))
}

// Render products on the homepage if admin has added products
function renderProductsIfAny(){
  const container = document.querySelector('section.products.flex')
  if(!container) return
  const allProducts = getProducts()
  if(!allProducts || !allProducts.length) return // keep static HTML

  // create a shallow copy for filtering so we don't mutate the stored array
  let products = allProducts.slice()

  // apply search filter if any
  try{
    const raw = localStorage.getItem(SEARCH_KEY) || ''
    const q = (raw||'').toString().trim().toLowerCase()
    if(q){
      products = products.filter(p=> (((p.title||'') + ' ' + (p.description||'')).toLowerCase().indexOf(q) !== -1))
    }
  }catch(e){/* ignore search errors */}

  // apply category filter if any
  try{
    const rawF = localStorage.getItem(FILTER_KEY)
    if(rawF){
      const f = JSON.parse(rawF)
      if(f && f.group){
        products = products.filter(p => (p.group||'') === f.group && (!f.subcategory || (p.subcategory||'') === f.subcategory))
      }
    }
  }catch(e){/* ignore */}

  // apply sort if any
  try{
    const s = localStorage.getItem('dioura_sort') || 'default'
    if(s === 'price_asc'){
      products.sort((a,b)=> (Number(a.price||0) - Number(b.price||0)))
    } else if(s === 'price_desc'){
      products.sort((a,b)=> (Number(b.price||0) - Number(a.price||0)))
    } else if(s === 'newest'){
      // if products have createdAt use it, otherwise keep original order
      if(products.some(p=>p.createdAt)){
        products.sort((a,b)=> (new Date(b.createdAt||0)) - (new Date(a.createdAt||0)))
      }
    }
  }catch(e){/* ignore sort errors */}

  if(!products.length){
    const q = localStorage.getItem(SEARCH_KEY) || ''
    container.innerHTML = `<div style="padding:3rem;text-align:center;color:#777">لا توجد نتائج</div>`
    return
  }

  container.innerHTML = ''
  products.forEach((p, idx) => {
    const card = document.createElement('article')
    card.className = 'card'
    const imgSrc = (p.images && p.images[0])? p.images[0] : './images/placeholder.svg'
    // include data-index on the link so product-details page can load canonical product data
    const originalIdx = allProducts.findIndex(op => op === p)
    card.innerHTML = `
      <a href="/pages/product-details.html" data-index="${originalIdx}">
        <img src="${imgSrc}" alt="" />
      </a>
      <div class="content">
  <h1 class="title">${escapeHtml(p.title||'عنوان المنتج')}</h1>
  <p class="category">${escapeHtml((p.group||'') + (p.subcategory?(' / '+p.subcategory):''))}</p>
  <p class="description">${escapeHtml(p.description||'')}</p>
        <div class="flex" style="justify-content: space-between; padding-bottom: 0.7rem">
          <div class="price">${formatPrice(p.price || 0)}</div>
          <button class="add-to-cart flex"><i class="fa-solid fa-cart-plus"></i>أضف إلى السلة</button>
        </div>
      </div>
    `
    container.appendChild(card)
  })
}

// ensure categories exist in localStorage; used by the sidebar UI
function initCategories(){
  try{
    const raw = localStorage.getItem(CATEGORIES_KEY)
    if(!raw){
      localStorage.setItem(CATEGORIES_KEY, JSON.stringify(DEFAULT_CATEGORIES))
    }
  }catch(e){/* ignore */}
}

// Build and manage the floating categories panel
function initCategorySidebar(){
  const toggle = document.getElementById('categoriesToggle')
  const panel = document.getElementById('categoriesPanel')
  const list = document.getElementById('categoriesList')
  if(!toggle || !panel || !list) return

  // basic open/close (no dim overlay)
  toggle.addEventListener('click', ()=>{
    panel.classList.toggle('open')
    const opened = panel.classList.contains('open')
    toggle.setAttribute('aria-expanded', opened ? 'true' : 'false')
    panel.setAttribute('aria-hidden', opened ? 'false' : 'true')
  })

  panel.querySelector('.close')?.addEventListener('click', ()=>{
    panel.classList.remove('open')
    toggle.setAttribute('aria-expanded','false')
    panel.setAttribute('aria-hidden','true')
  })

  // close with Escape key for accessibility
  document.addEventListener('keydown', (e)=>{
    if(e.key === 'Escape' && panel.classList.contains('open')){
      panel.classList.remove('open')
      toggle.setAttribute('aria-expanded','false')
      panel.setAttribute('aria-hidden','true')
    }
  })

  // load categories
  let cats = DEFAULT_CATEGORIES
  try{ cats = JSON.parse(localStorage.getItem(CATEGORIES_KEY) || JSON.stringify(DEFAULT_CATEGORIES)) }catch(e){ cats = DEFAULT_CATEGORIES }
  list.innerHTML = ''

  // top controls: search + sort
  const controls = document.createElement('div')
  controls.className = 'categories-controls'
  controls.innerHTML = `
    <input id="categoriesSearch" class="categories-search" placeholder="ابحث في المجموعات..." />
    <select id="categoriesSort" class="categories-sort">
      <option value="default">ترتيب افتراضي</option>
      <option value="newest">الأحدث</option>
      <option value="price_asc">السعر: الأقل أولاً</option>
      <option value="price_desc">السعر: الأعلى أولاً</option>
    </select>
  `
  list.appendChild(controls)

  // show clear filter option
  const allBtn = document.createElement('button')
  allBtn.className = 'cat-all'
  allBtn.textContent = 'عرض الكل'
  allBtn.addEventListener('click', ()=>{
    localStorage.removeItem(FILTER_KEY)
    renderProductsIfAny()
    panel.classList.remove('open')
    try{ updateFilterLabel() }catch(e){}
  })
  list.appendChild(allBtn)

  // simple icon map for groups (uses Font Awesome classes). Falls back to a generic tag icon.
  const ICON_MAP = {
    'ملابس': 'fa-solid fa-shirt',
    'احذية': 'fa-solid fa-shoe-prints',
    'اكسسوارات': 'fa-solid fa-gem'
  }

  Object.keys(cats).forEach(group => {
    const gEl = document.createElement('div')
    gEl.className = 'cat-group'

    // create a small card showing icon + title (more modern)
    const card = document.createElement('div')
    card.className = 'cat-card'

    const iconWrap = document.createElement('div')
    iconWrap.className = 'cat-icon'
    const iconClass = ICON_MAP[group] || 'fa-solid fa-tags'
    iconWrap.innerHTML = `<i class="${iconClass}" aria-hidden="true"></i>`

    const titleWrap = document.createElement('div')
    const title = document.createElement('div')
    title.className = 'cat-title'
    title.textContent = group
    titleWrap.appendChild(title)

    card.appendChild(iconWrap)
    card.appendChild(titleWrap)
    gEl.appendChild(card)

    const subs = document.createElement('div')
    subs.className = 'cat-subs'
    ;(cats[group]||[]).forEach(sub => {
      const b = document.createElement('button')
      b.className = 'cat-sub'
      b.textContent = sub
      b.addEventListener('click', ()=>{
        localStorage.setItem(FILTER_KEY, JSON.stringify({ group: group, subcategory: sub }))
        renderProductsIfAny()
        panel.classList.remove('open')
        // scroll to products
        try{ updateFilterLabel() }catch(e){}
        if(window.location.pathname.endsWith('index.html') || window.location.pathname === '/' || window.location.pathname === ''){
          window.location.hash = 'products'
        } else {
          window.location.href = '/index.html#products'
        }
      })
      subs.appendChild(b)
    })
    gEl.appendChild(subs)
    list.appendChild(gEl)
  })

  // categories search: filter visible groups/subs
  const searchInput = document.getElementById('categoriesSearch')
  if(searchInput){
    searchInput.addEventListener('input', ()=>{
      const q = (searchInput.value||'').trim().toLowerCase()
      const groups = list.querySelectorAll('.cat-group')
      groups.forEach(g=>{
        // prefer the newer .cat-title (used by JS-rendered groups), fall back to older h4 if present
        const titleEl = g.querySelector('.cat-title') || g.querySelector('h4')
        const title = (titleEl?.textContent||'').toLowerCase()
        const subs = Array.from(g.querySelectorAll('.cat-sub')).map(n=>n.textContent.toLowerCase())
        const match = title.indexOf(q) !== -1 || subs.some(s=> s.indexOf(q) !== -1)
        g.style.display = match ? '' : 'none'
      })
    })
  }

  // sort select: persist and re-render
  const sortSel = document.getElementById('categoriesSort')
  if(sortSel){
    // restore previous selection
    try{ sortSel.value = localStorage.getItem('dioura_sort') || 'default' }catch(e){}
    sortSel.addEventListener('change', ()=>{
      try{ localStorage.setItem('dioura_sort', sortSel.value) }catch(e){}
      renderProductsIfAny()
      panel.classList.remove('open')
      try{ updateFilterLabel() }catch(e){}
    })
  }
}

// Listen for storage changes so admin edits (products/categories) update the UI live
window.addEventListener('storage', ()=>{
  try{ initCategories(); initCategorySidebar(); renderProductsIfAny(); updateFilterLabel() }catch(e){}
})

// Update visible label showing current filter on the page header
function updateFilterLabel(){
  const el = document.getElementById('currentFilterLabel')
  if(!el) return
  try{
    const raw = localStorage.getItem(FILTER_KEY)
    if(!raw){ el.textContent = 'عرض: الكل'; return }
    const f = JSON.parse(raw)
    if(f && f.group){
      el.textContent = f.subcategory ? `عرض: ${f.group} / ${f.subcategory}` : `عرض: ${f.group}`
    } else {
      el.textContent = 'عرض: الكل'
    }
  }catch(e){ el.textContent = 'عرض: الكل' }
}

function escapeHtml(s){return (s||'').toString().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}

function getCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY) || "[]")
  } catch (e) {
    return []
  }
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart))
}

function addToCart(item) {
  const cart = getCart()
  // check if same product exists (by title + price)
  const idx = cart.findIndex(
    (p) => p.title === item.title && p.price === item.price
  )
  if (idx > -1) {
    cart[idx].quantity += item.quantity || 1
  } else {
    cart.push(Object.assign({ quantity: 1 }, item))
  }
  saveCart(cart)
  renderCartBadge()
}

function clearCart() {
  localStorage.removeItem(CART_KEY)
  renderCartBadge()
}

function renderCartBadge() {
  const cart = getCart()
  const totalItems = cart.reduce((s, p) => s + (p.quantity || 1), 0)
  const totalPrice = cart.reduce((s, p) => s + ((p.price || 0) * (p.quantity || 1)), 0)

  // update small numeric badge (item count)
  const badge = document.querySelector(".products-number")
  if (badge) badge.textContent = totalItems

  // update the cart link text to show total price (keeps the icon and badge)
  const cartLink = document.querySelector('.cart')
  if (cartLink) {
    // preserve href and replace inner content with icon + price + badge
    const href = cartLink.getAttribute('href') || './pages/cart.html'
    cartLink.innerHTML = `<i class="fa-solid fa-cart-shopping"></i> ${formatPrice(totalPrice)} <span class="products-number">${totalItems}</span>`
    cartLink.setAttribute('href', href)
  }
}

function formatPrice(v) {
  // Show Syrian Pound without decimals and with thousand separators
  // Use en-US locale to display comma separators (e.g. 1,000,000 ل.س)
  const n = Number(v) || 0
  return n.toLocaleString('en-US') + " ل.س"
}

// Attach add-to-cart handlers across the site
document.addEventListener("click", (e) => {
  const btn = e.target.closest(".add-to-cart")
  if (!btn) return

  // product card (index) structure
  const card = btn.closest(".card")
  if (card) {
    const title = card.querySelector(".title")?.textContent?.trim() || "Product"
    const priceText = card.querySelector(".price")?.textContent || "0"
    const price = priceText.replace(/[^0-9.]/g, "") || "0"
    const img = card.querySelector("img")?.getAttribute("src") || ""
    addToCart({ title, price: Number(price), img })
    alert(`تمت إضافة ${title} إلى سلة المشتريات`)
    return
  }

  // product details page
  const details = btn.closest("main")
  if (details) {
    const title = details.querySelector("h2")?.textContent?.trim() || details.querySelector(".title")?.textContent?.trim() || "Product"
    const priceText = details.querySelector(".price")?.textContent || "0"
    const price = priceText.replace(/[^0-9.]/g, "") || "0"
    const img = details.querySelector("img")?.getAttribute("src") || ""
    // quantity from details page
    let qty = 1
    const qtyInput = details.querySelector('#productQuantity')
    if (qtyInput) qty = Math.max(1, Number(qtyInput.value||1))
    addToCart({ title, price: Number(price), img, quantity: qty })
    alert(`تمت إضافة ${title} إلى سلة المشتريات`)
    return
  }
})

// When a product card link is clicked, store its data so the product-details page can show the same price
document.addEventListener('click', (e) => {
  const a = e.target.closest('a')
  if (!a) return
  const href = a.getAttribute('href') || ''
  // detect product details link (relative paths)
  if (href.endsWith('product-details.html') || href.indexOf('product-details.html') !== -1) {
    // Prefer storing the canonical product object by index (if available)
    const idxAttr = a.getAttribute('data-index')
    if (idxAttr) {
      const products = getProducts()
      const prod = products[Number(idxAttr)]
      if (prod) {
        // store the full images array so the details page can show a gallery
        const selected = { title: prod.title||'', price: Number(prod.price)||0, images: (prod.images||[]), img: (prod.images && prod.images[0])||'', desc: prod.description||'', discount: prod.discount || 0 }
        localStorage.setItem('dioura_selected_product', JSON.stringify(selected))
        return
      }
    }
    // Fallback: extract from DOM (for compatibility with other card markup)
    const card = a.closest('.card') || a.closest('.product') || a.closest('article')
    if (card) {
      const title = card.querySelector('.title')?.textContent?.trim() || card.querySelector('h1')?.textContent?.trim() || ''
      let priceText = card.querySelector('.price')?.textContent || ''
      // extract numeric part
      const priceNum = Number((priceText + '').replace(/[^0-9.]/g, '')) || 0
      const img = card.querySelector('img')?.getAttribute('src') || ''
      const desc = card.querySelector('.description')?.textContent?.trim() || ''
      const selected = { title, price: priceNum, img, desc }
      localStorage.setItem('dioura_selected_product', JSON.stringify(selected))
    }
  }
})

// Populate product-details page from selected product saved earlier
function populateProductDetailsFromStorage() {
  try {
    const raw = localStorage.getItem('dioura_selected_product')
    if (!raw) return
    const data = JSON.parse(raw)
    const main = document.querySelector('main')
    if (!main) return
    const titleEl = main.querySelector('h2') || main.querySelector('.title')
    const priceEl = main.querySelector('.price')
    const descEl = main.querySelector('.description')
    if (titleEl && data.title) titleEl.textContent = data.title
    if (priceEl && typeof data.price !== 'undefined') priceEl.textContent = formatPrice(data.price)
    if (descEl && data.desc) descEl.textContent = data.desc

    // render gallery if images array provided
    const mainImg = document.getElementById('productMainImage') || main.querySelector('img')
    const thumbs = document.getElementById('productThumbnails')
    if (Array.isArray(data.images) && data.images.length) {
      if (mainImg) mainImg.setAttribute('src', data.images[0])
      if (thumbs) {
        thumbs.innerHTML = ''
        data.images.forEach((src, i) => {
          const t = document.createElement('img')
          t.src = src
          t.dataset.index = i
          // set accessible alt
          t.alt = `صورة ${i + 1}`
          t.className = i === 0 ? 'active' : ''
          t.addEventListener('click', () => {
            if (mainImg) mainImg.setAttribute('src', src)
            // update active class
            Array.from(thumbs.querySelectorAll('img')).forEach(x => x.classList.remove('active'))
            t.classList.add('active')
          })
          thumbs.appendChild(t)
        })
      }
    } else {
      // fallback to single image
      const imgEl = main.querySelector('img')
      if (imgEl && data.img) imgEl.setAttribute('src', data.img)
    }

    // quantity controls (increase/decrease) handlers
    const qtyInput = document.getElementById('productQuantity')
    const incBtn = document.getElementById('qtyIncrease')
    const decBtn = document.getElementById('qtyDecrease')
    if (incBtn && qtyInput) incBtn.addEventListener('click', ()=>{ qtyInput.value = Math.max(1, Number(qtyInput.value||1)+1) })
    if (decBtn && qtyInput) decBtn.addEventListener('click', ()=>{ qtyInput.value = Math.max(1, Number(qtyInput.value||1)-1) })

    // update discount badge if any
    const discountBadge = document.getElementById('discountBadge')
    if (discountBadge) {
      if (typeof data.discount !== 'undefined' && data.discount) {
        discountBadge.style.display = 'inline-block'
        discountBadge.textContent = `-${data.discount}%`
      } else {
        discountBadge.style.display = 'none'
      }
    }

    // buy now button: add selected qty to cart then go to checkout
    const buyNowBtn = document.getElementById('buyNow')
    const addToCartBtn = document.getElementById('addToCartBtn')
    if (buyNowBtn) {
      buyNowBtn.addEventListener('click', ()=>{
        const qty = Number((document.getElementById('productQuantity')||{value:1}).value||1)
        addToCart({ title: data.title||titleEl?.textContent||'Product', price: Number(data.price||0), img: (data.images && data.images[0])||data.img||'', quantity: Math.max(1, qty) })
        // go to checkout page
        window.location.href = '/pages/checkout.html'
      })
    }
    // ensure addToCartBtn has accessible attribute (delegated handler will pick it up as well)
    if (addToCartBtn) addToCartBtn.setAttribute('aria-label','أضف المنتج إلى السلة')
  } catch (err) {
    // ignore
  }
}

// Search helpers
function initSearch(){
  const input = document.getElementById('productSearch')
  const btn = document.getElementById('searchBtn')
  if(!input) return
  // restore previous query
  const prev = localStorage.getItem(SEARCH_KEY) || ''
  input.value = prev

  function doSearch(){
    const q = (input.value || '').toString().trim()
    if(q) localStorage.setItem(SEARCH_KEY, q)
    else localStorage.removeItem(SEARCH_KEY)
    // re-render products (will show filtered list)
    try{ renderProductsIfAny() }catch(e){}
    // navigate to products section
    if(window.location.pathname.endsWith('index.html') || window.location.pathname === '/' || window.location.pathname === ''){
      window.location.hash = 'products'
    } else {
      window.location.href = '/index.html#products'
    }
  }

  input.addEventListener('keydown', (ev)=>{ if(ev.key === 'Enter') doSearch() })
  if(btn) btn.addEventListener('click', doSearch)
}

// CART PAGE RENDERING
function renderCartPage() {
  const container = document.getElementById("cartItems")
  if (!container) return
  const cart = getCart()
  container.innerHTML = ""
  if (!cart.length) {
    container.innerHTML = `<p>سلة التسوق فارغة.</p>`
    document.querySelector(".checkout")?.setAttribute("disabled", "true")
    return
  }
  const list = document.createElement("div")
  list.className = "cart-list"
  let total = 0
  cart.forEach((p, i) => {
    total += (p.price || 0) * (p.quantity || 1)
    const item = document.createElement("div")
    item.className = "cart-item flex"
    item.innerHTML = `
      <button data-index="${i}" class="remove-item"><i class="fa-solid fa-trash-can"></i></button>
      <p class="price">${formatPrice(p.price)}</p>
      <div class="flex quantity-controls">
        <button class="decrease" data-index="${i}">-</button>
        <div class="quantity flex">${p.quantity || 1}</div>
        <button class="increase" data-index="${i}">+</button>
      </div>
      <p class="title">${p.title}</p>
      <img width="70" height="70" src="${p.img}" />
    `
    list.appendChild(item)
  })
  container.appendChild(list)
  const summary = document.getElementById("cartSummary")
  if (summary) {
    summary.innerHTML = `
      <div class="flex"><p class="Subtotal">المجموع</p><p>${formatPrice(total)}</p></div>
      <button class="checkout">إتمام الطلب</button>
    `
    const checkoutBtn = summary.querySelector('.checkout')
    checkoutBtn.addEventListener('click', () => {
      // navigate to checkout page
      window.location.href = './checkout.html'
    })
  }
}

// cart item controls (increase/decrease/remove)
document.addEventListener('click', (e) => {
  const inc = e.target.closest('.increase')
  const dec = e.target.closest('.decrease')
  const rem = e.target.closest('.remove-item')
  if (inc || dec || rem) {
    const idx = Number((inc||dec||rem).dataset.index)
    const cart = getCart()
    if (!cart[idx]) return
    if (inc) cart[idx].quantity = (cart[idx].quantity||1) + 1
    if (dec) {
      cart[idx].quantity = Math.max(1, (cart[idx].quantity||1) - 1)
    }
    if (rem) cart.splice(idx,1)
    saveCart(cart)
    renderCartBadge()
    renderCartPage()
  }
})

// clear cart button
document.addEventListener('click', (e) => {
  if (e.target.closest('#clearCartBtn')) {
    if (confirm('هل تريد تفريغ سلة التسوق؟')) {
      clearCart()
      renderCartPage()
    }
  }
})

// Checkout page logic: handle form submit
function initCheckoutPage() {
  const form = document.getElementById('checkoutForm')
  if (!form) return
  const cart = getCart()
  const itemsContainer = document.getElementById('checkoutItems')
  const totalEl = document.getElementById('checkoutTotal')
  const discountEl = document.getElementById('checkoutDiscount')
  const finalEl = document.getElementById('checkoutFinalTotal')
  const couponInput = document.getElementById('couponCode')
  const applyBtn = document.getElementById('applyCoupon')
  const couponMsg = document.getElementById('couponMessage')
  if (itemsContainer) {
    itemsContainer.innerHTML = ''
    let total = 0
    cart.forEach((p) => {
      total += (p.price||0)*(p.quantity||1)
      const div = document.createElement('div')
      div.className = 'checkout-line flex'
      div.innerHTML = `<p>${p.title} x${p.quantity||1}</p><p>${formatPrice((p.price||0)*(p.quantity||1))}</p>`
      itemsContainer.appendChild(div)
    })
    // initial values
    if (totalEl) totalEl.textContent = formatPrice(total)
    if (discountEl) discountEl.textContent = '- ' + formatPrice(0)
    if (finalEl) finalEl.textContent = formatPrice(total)
    // state for applied coupon
    let appliedCoupon = null

    // helper to update totals when coupon applied/removed
    function updateTotalsWithCoupon(coupon){
      const subtotal = total
      let discountValue = 0
      if (coupon && coupon.active){
        if (coupon.type === 'percent'){
          discountValue = Math.round(subtotal * (Number(coupon.value||0)/100))
        } else {
          discountValue = Number(coupon.value||0)
        }
        // don't allow discount greater than subtotal
        discountValue = Math.min(discountValue, subtotal)
      }
      const final = Math.max(0, subtotal - discountValue)
      if (discountEl) discountEl.textContent = '- ' + formatPrice(discountValue)
      if (finalEl) finalEl.textContent = formatPrice(final)
      // show/hide discount line
      const discLine = document.querySelector('.discount-line')
      if (discLine) discLine.style.display = (discountValue>0)? 'flex' : 'none'
      return {subtotal, discountValue, final}
    }

    // apply button handler (validate against admin coupons stored in localStorage)
    if (applyBtn && couponInput){
      applyBtn.addEventListener('click', ()=>{
        const code = (couponInput.value||'').toString().trim()
        couponMsg.textContent = ''
        if (!code) { couponMsg.textContent = 'الرجاء إدخال كود الكوبون.'; return }
        let coupons = []
        try{ coupons = JSON.parse(localStorage.getItem('dioura_coupons')||'[]') }catch(e){ coupons = [] }
        const found = coupons.find(c => (c.code||'').toString().toLowerCase() === code.toLowerCase() && c.active)
        if (!found){ couponMsg.textContent = 'الكود غير صالح أو غير مفعل.'; appliedCoupon = null; updateTotalsWithCoupon(null); return }
        appliedCoupon = found
        couponMsg.style.color = '#28a745'
        couponMsg.textContent = `تم تطبيق الكوبون: ${escapeHtml(found.code)}.`
        updateTotalsWithCoupon(found)
      })
    }
  }

  form.addEventListener('submit', (ev) => {
    ev.preventDefault()
    const data = new FormData(form)
    const name = data.get('name')?.toString().trim()
    const phone = data.get('phone')?.toString().trim()
    const email = data.get('email')?.toString().trim()
    const governorate = data.get('governorate')
    const address = data.get('address')?.toString().trim()
    const payment = data.get('payment')
    if (!name) {
      alert('الرجاء إدخال اسم الزبون')
      return
    }
    if (!phone) {
      alert('الرجاء إدخال رقم الهاتف')
      return
    }
    // simple email check if provided
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      alert('الرجاء إدخال بريد إلكتروني صالح أو تركه فارغاً')
      return
    }
    if (!governorate) {
      alert('الرجاء اختيار المحافظة')
      return
    }
    if (!address) {
      alert('الرجاء إدخال العنوان')
      return
    }
    if (!payment) {
      alert('الرجاء اختيار طريقة الدفع')
      return
    }

    const orders = JSON.parse(localStorage.getItem(ORDERS_KEY) || '[]')
    const orderId = 'ORD-' + Date.now().toString(36)
    // include coupon info and totals if a coupon was applied
    const couponCodeEl = document.getElementById('couponCode')
    const appliedCode = couponCodeEl ? (couponCodeEl.value||'').toString().trim() : ''
    // determine final totals using same logic as above
    let subtotal = 0
    cart.forEach(p=> subtotal += (p.price||0)*(p.quantity||1))
    let couponObj = null
    try{ couponObj = JSON.parse(localStorage.getItem('dioura_coupons')||'[]').find(c => (c.code||'').toString().toLowerCase() === (appliedCode||'').toLowerCase() && c.active) }catch(e){ couponObj = null }
    let discountValue = 0
    if (couponObj){
      if (couponObj.type === 'percent') discountValue = Math.round(subtotal * (Number(couponObj.value||0)/100))
      else discountValue = Number(couponObj.value||0)
      discountValue = Math.min(discountValue, subtotal)
    }
    const finalTotal = Math.max(0, subtotal - discountValue)

    const order = {
      id: orderId,
      name: name,
      phone, email, governorate, address, payment,
      items: cart,
      coupon: couponObj ? { code: couponObj.code, type: couponObj.type, value: couponObj.value } : null,
      discount: discountValue,
      subtotal: subtotal,
      total: finalTotal,
      createdAt: new Date().toISOString()
    }
    orders.push(order)
    localStorage.setItem(ORDERS_KEY, JSON.stringify(orders))
    clearCart()
    // show confirmation
    const result = document.getElementById('checkoutResult')
    if (result) {
      result.innerHTML = `<h2>تم استلام الطلب</h2><p>رقم الطلب: <strong>${orderId}</strong></p><p>الزبون: <strong>${escapeHtml(name)}</strong></p><p>سنتواصل معك على الرقم ${escapeHtml(phone)}${email?(' أو عبر البريد '+escapeHtml(email)):''} لتأكيد الطلب.</p>`
      form.style.display = 'none'
      itemsContainer.style.display = 'none'
      totalEl.style.display = 'none'
    } else {
      alert('تم تقديم الطلب. رقم الطلب: ' + orderId)
      window.location.href = '/' 
    }
  })
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
  // initialize search input and handlers
  try{ initSearch() }catch(e){}
  try{ initCategories(); initCategorySidebar() }catch(e){}
  // if there are admin-provided products, render them
  try{ renderProductsIfAny() }catch(e){}
  try{ updateFilterLabel() }catch(e){}
  renderCartBadge()
  renderCartPage()
  initCheckoutPage()
  populateProductDetailsFromStorage()

  // Mobile search toggle: collapse input to icon and open overlay when tapped
  try{
    const searchWrap = document.querySelector('.search-wrap')
    const searchBtn = document.getElementById('searchBtn')
    const searchInput = document.getElementById('productSearch')
    if(searchWrap && searchBtn && searchInput){
      searchBtn.addEventListener('click', (ev)=>{
        if(window.innerWidth <= 600){
          // when on small screens toggle open state instead of direct submit
          ev.preventDefault()
          searchWrap.classList.toggle('open')
          if(searchWrap.classList.contains('open')){
            // focus input after a short delay so mobile keyboards appear
            setTimeout(()=>{ try{ searchInput.focus() }catch(e){} }, 60)
          }
        }
      })

      // click outside to close mobile search overlay
      document.addEventListener('click', (e)=>{
        if(window.innerWidth <= 600 && searchWrap.classList.contains('open')){
          if(!searchWrap.contains(e.target) && e.target.id !== 'searchBtn'){
            searchWrap.classList.remove('open')
          }
        }
      })
    }
  }catch(e){}
})

// Utility: clear all products from localStorage (for testing)
window.clearAllProducts = function(){
  try{
    localStorage.removeItem(PRODUCTS_KEY)
    // re-render the products area and update UI
    try{ renderProductsIfAny() }catch(e){}
    try{ updateFilterLabel() }catch(e){}
    try{ renderCartBadge() }catch(e){}
    alert('All products removed from localStorage (dioura_products).')
  }catch(err){ console.error('clearAllProducts failed', err); alert('Failed to clear products. See console.') }
}

// Quick trigger: visiting the site with ?clear_products=1 will clear products automatically
try{
  if(window.location && window.location.search && window.location.search.indexOf('clear_products=1') !== -1){
    // perform clear automatically (useful for testing)
    window.clearAllProducts()
  }
}catch(e){}

// --- Admin access: long-press footer to open login modal ---
// default credentials stored in localStorage under 'dioura_admin' as {user, pass}
// Hash helper using Web Crypto
async function hashString(input){
  try{
    const enc = new TextEncoder().encode(input)
    const buf = await crypto.subtle.digest('SHA-256', enc)
    const h = Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('')
    return h
  }catch(e){
    // fallback: simple (insecure) hash if Web Crypto unavailable
    let hash = 0; for(let i=0;i<input.length;i++){ hash = ((hash<<5)-hash)+input.charCodeAt(i); hash |= 0 }
    return String(Math.abs(hash))
  }
}

// load admin credentials; returns {user, passHash}
async function loadAdminCreds(){
  try{
    const raw = localStorage.getItem('dioura_admin')
    if(!raw) {
      // default user Ali with default pass Ali123 (hash computed)
      return { user: 'Ali', passHash: await hashString('Ali123') }
    }
    const obj = JSON.parse(raw)
    // migration: if legacy 'pass' exists in plaintext, convert to passHash
    if(obj.pass && !obj.passHash){
      const h = await hashString(obj.pass)
      const migrated = { user: obj.user||'Ali', passHash: h }
      localStorage.setItem('dioura_admin', JSON.stringify(migrated))
      return migrated
    }
    return { user: obj.user||'Ali', passHash: obj.passHash || await hashString('Ali123') }
  }catch(e){
    return { user: 'Ali', passHash: await hashString('Ali123') }
  }
}

function setAdminCreds(obj){
  // expects obj to contain {user, passHash}
  localStorage.setItem('dioura_admin', JSON.stringify(obj))
}

// create and show login modal; on success set session and redirect to admin page
window.showAdminLoginModal = async function(){
  // if already authenticated, go to admin
  if (sessionStorage.getItem('dioura_admin_auth') === '1'){
    window.location.href = '/pages/admin.html'
    return
  }
  // build modal
  const overlay = document.createElement('div')
  overlay.id = 'adminLoginOverlay'
  overlay.style.position = 'fixed'
  overlay.style.inset = '0'
  overlay.style.background = 'rgba(0,0,0,0.5)'
  overlay.style.display = 'flex'
  overlay.style.alignItems = 'center'
  overlay.style.justifyContent = 'center'
  overlay.style.zIndex = '9999'

  const box = document.createElement('div')
  box.style.background = '#fff'
  box.style.padding = '1rem'
  box.style.borderRadius = '6px'
  box.style.width = '320px'
  box.style.boxShadow = '0 6px 24px rgba(0,0,0,0.2)'

  box.innerHTML = `
    <h3 style="margin:0 0 .5rem">دخول لوحة الإدارة</h3>
    <div style="display:flex;flex-direction:column;gap:.5rem">
      <input id="adminUserInput" placeholder="اسم المستخدم" style="padding:.5rem;border:1px solid #ddd;border-radius:4px" />
      <input id="adminPassInput" placeholder="كلمة المرور" type="password" style="padding:.5rem;border:1px solid #ddd;border-radius:4px" />
      <div style="display:flex;gap:.5rem;justify-content:flex-end;margin-top:.5rem">
        <button id="adminCancelBtn" style="padding:.45rem .7rem;border-radius:4px;border:0;background:#eee">إلغاء</button>
        <button id="adminLoginBtn" style="padding:.45rem .7rem;border-radius:4px;border:0;background:#ff7a00;color:#fff">تسجيل</button>
      </div>
    </div>
  `

  overlay.appendChild(box)
  document.body.appendChild(overlay)

  const creds = await loadAdminCreds()

  overlay.querySelector('#adminCancelBtn').addEventListener('click',()=>{overlay.remove()})
  overlay.querySelector('#adminLoginBtn').addEventListener('click', async ()=>{
    const u = document.getElementById('adminUserInput').value.trim()
    const p = document.getElementById('adminPassInput').value
    const ph = await hashString(p)
    if(u === creds.user && ph === creds.passHash){
      sessionStorage.setItem('dioura_admin_auth','1')
      overlay.remove()
      // redirect to admin dashboard
      window.location.href = '/pages/admin.html'
    } else {
      alert('اسم المستخدم أو كلمة المرور خاطئان')
    }
  })
}

// long-press detection on footer-bottom
;(function(){
  let timer = null
  const el = document.querySelector('.footer-bottom')
  if(!el) return
  function start(e){
    if (timer) clearTimeout(timer)
    timer = setTimeout(()=>{ window.showAdminLoginModal() }, 900)
  }
  function cancel(){ if(timer) clearTimeout(timer); timer = null }
  el.addEventListener('mousedown', start)
  el.addEventListener('touchstart', start)
  el.addEventListener('mouseup', cancel)
  el.addEventListener('mouseleave', cancel)
  el.addEventListener('touchend', cancel)
  el.addEventListener('touchcancel', cancel)
})()




