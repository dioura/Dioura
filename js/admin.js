// Admin scripts: manage products, orders, coupons in localStorage
(function(){
  try{
  const PRODUCTS_KEY = 'dioura_products'
  const COUPONS_KEY = 'dioura_coupons'
  const ORDERS_KEY = 'dioura_orders'

  // Category structure: groups and their subcategories (default)
  const CATEGORIES = {
    'ملابس': ['نسائي', 'ولادي', 'رجالي'],
    'احذية': ['رجالي', 'نسائي'],
    'اكسسوارات': ['ساعات', 'حقائب', 'اخرى']
  }

  function getProducts(){
    try{return JSON.parse(localStorage.getItem(PRODUCTS_KEY)||'[]')}catch(e){return[]}
  }
  function saveProducts(list){localStorage.setItem(PRODUCTS_KEY,JSON.stringify(list))}

  function getCoupons(){try{return JSON.parse(localStorage.getItem(COUPONS_KEY)||'[]')}catch(e){return[]}}
  function saveCoupons(list){localStorage.setItem(COUPONS_KEY,JSON.stringify(list))}

  // render products table
  function renderProducts(){
    const tbody = document.querySelector('#productsTable tbody')
    if(!tbody) return
    const products = getProducts()
    tbody.innerHTML = ''
    products.forEach((p,i)=>{
      const tr = document.createElement('tr')
      const img = (p.images && p.images.length)?`<img src="${p.images[0]}" />`:'-'
      tr.innerHTML = `
        <td>${img}</td>
        <td>${escapeHtml(p.title||'')}</td>
        <td>${escapeHtml((p.group||'') + (p.subcategory?(' / '+p.subcategory):''))}</td>
        <td>${formatPrice(p.price||0)}</td>
        <td>${p.discount? (p.discount+'%') : '-'}</td>
        <td>${p.published? '<span class="published-yes">نعم</span>':'<span class="published-no">لا</span>'}</td>
        <td>
          <button data-index="${i}" class="btn-small btn-edit actions-btn">تعديل</button>
          <button data-index="${i}" class="btn-small btn-delete actions-btn">حذف</button>
        </td>
      `
      tbody.appendChild(tr)
    })
  }

  function formatPrice(v){const n=Number(v)||0; return n.toLocaleString('en-US')+' ل.س'}
  function escapeHtml(s){return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}

  function bindProductForm(){
    const form = document.getElementById('productForm')
    if(!form) return
    form.addEventListener('submit', async (ev)=>{
      ev.preventDefault()
      try{
        const fd = new FormData(form)
        const index = fd.get('index')
        const title = fd.get('title')?.toString().trim()
        const description = fd.get('description')?.toString().trim()
        const price = Number(fd.get('price')||0)
        const discount = Number(fd.get('discount')||0)
        const published = !!fd.get('published')

        // handle files input (multiple). If files provided, read as data URLs.
        const fileInput = form.querySelector('input[name="images"]')
        let images = []
        if(fileInput && fileInput.files && fileInput.files.length){
          const files = Array.from(fileInput.files)
          images = await Promise.all(files.map(f => new Promise((res, rej)=>{
            const reader = new FileReader()
            reader.onload = ()=>res(reader.result)
            reader.onerror = rej
            reader.readAsDataURL(f)
          })))
        } else {
          // no new files: if editing keep existing images, otherwise empty
          if(index){
            const existing = getProducts()[Number(index)]
            images = (existing && existing.images) ? existing.images : []
          } else {
            images = []
          }
        }

        console.log('admin: saving product', {index, title, price, images, discount, published})
  const products = getProducts()
  // read selected group/subcategory from the form
  const group = (fd.get('group')||'').toString()
  const subcategory = (fd.get('subcategory')||'').toString()
  // preserve createdAt when editing, otherwise set it now
  let createdAt = new Date().toISOString()
  if(index){
    const existing = products[Number(index)] || {}
    if(existing.createdAt) createdAt = existing.createdAt
  }
  const item = {title,description,images,price,discount,published, group, subcategory, createdAt}
        if(index){
          products[Number(index)] = item
        } else {
          products.push(item)
        }
        saveProducts(products)
        console.log('admin: products now', products)
        form.reset()
        // clear preview
        const preview = document.getElementById('imagePreview')
        if(preview) preview.innerHTML = ''
        renderProducts()
        alert('تم حفظ المنتج')
        // notify main script to re-render if it listens to storage changes
        window.dispatchEvent(new Event('storage'))
      }catch(err){
        console.error('Error saving product', err)
        alert('خطأ أثناء حفظ المنتج: ' + (err && err.message ? err.message : String(err)))
      }
    })

  const clearBtn = document.getElementById('clearProductForm')
  if(clearBtn) clearBtn.addEventListener('click',()=>form.reset())

  // edit / delete buttons
  const productsTbody = document.querySelector('#productsTable tbody')
  if(productsTbody) productsTbody.addEventListener('click',(e)=>{
      const edit = e.target.closest('.btn-edit')
      const del = e.target.closest('.btn-delete')
      if(edit){
        const i = Number(edit.dataset.index)
        const p = getProducts()[i]
        if(!p) return
        const f = form
        f.index.value = i
        f.title.value = p.title||''
        f.description.value = p.description||''
        // show existing images as preview; uploading new files will replace them
        const preview = document.getElementById('imagePreview')
        if(preview){
          preview.innerHTML = ''
          ;(p.images||[]).forEach(src => {
            const img = document.createElement('img')
            img.src = src
            img.style.height = '60px'
            img.style.marginRight = '6px'
            preview.appendChild(img)
          })
        }
        f.price.value = p.price||0
        f.discount.value = p.discount||0
        f.published.checked = !!p.published
        // populate group/subcategory selects
        const groupSel = document.getElementById('productGroup')
        const subSel = document.getElementById('productSubcategory')
        if(groupSel) groupSel.value = p.group || ''
        // rebuild subcategories for chosen group
        if(groupSel) {
          const ev = new Event('change')
          groupSel.dispatchEvent(ev)
        }
        if(subSel) subSel.value = p.subcategory || ''
      }
      if(del){
        if(!confirm('هل تريد حذف هذا المنتج؟')) return
        const i = Number(del.dataset.index)
        const products = getProducts()
        products.splice(i,1)
        saveProducts(products)
        renderProducts()
      }
    })
  }

  // render orders table
  function renderOrders(){
    const tbody = document.querySelector('#ordersTable tbody')
    if(!tbody) return
    const orders = JSON.parse(localStorage.getItem(ORDERS_KEY)||'[]')
    tbody.innerHTML = ''
    orders.slice().reverse().forEach(o=>{
      const tr = document.createElement('tr')
      const itemsText = (o.items||[]).map(i=>escapeHtml(i.title)+' x'+(i.quantity||1)).join('<br>')
      const total = (o.items||[]).reduce((s,p)=>s + ((p.price||0)*(p.quantity||1)),0)
      tr.innerHTML = `
        <td>${escapeHtml(o.id||'')}</td>
        <td>${escapeHtml(o.name||'')}<br>${escapeHtml(o.phone||'')}<br>${escapeHtml(o.email||'')}</td>
        <td>${itemsText}</td>
        <td>${formatPrice(total)}</td>
        <td>${new Date(o.createdAt||'').toLocaleString()}</td>
      `
      tbody.appendChild(tr)
    })
  }

  // coupons
  function renderCoupons(){
    const tbody = document.querySelector('#couponsTable tbody')
    if(!tbody) return
    const coupons = getCoupons()
    tbody.innerHTML = ''
    coupons.forEach((c,i)=>{
      const tr = document.createElement('tr')
      tr.innerHTML = `<td>${escapeHtml(c.code)}</td><td>${escapeHtml(c.type)}</td><td>${escapeHtml(String(c.value))}</td><td>${c.active? 'نعم':'لا'}</td><td><button data-index="${i}" class="btn-small btn-delete">حذف</button></td>`
      tbody.appendChild(tr)
    })
  }

  function bindCoupons(){
    const form = document.getElementById('couponForm')
    if(form) form.addEventListener('submit',(ev)=>{
      ev.preventDefault()
      const fd = new FormData(form)
      const code = fd.get('code')?.toString().trim()
      const type = fd.get('type')
      const value = Number(fd.get('value')||0)
      const active = !!fd.get('active')
      if(!code) return alert('ادخل كود الكوبون')
      const coupons = getCoupons()
      coupons.push({code,type,value,active,createdAt:new Date().toISOString()})
      saveCoupons(coupons)
      form.reset()
      renderCoupons()
      alert('تم إضافة الكوبون')
    })
  const couponsTbody = document.querySelector('#couponsTable tbody')
  if(couponsTbody) couponsTbody.addEventListener('click',(e)=>{
      const del = e.target.closest('.btn-delete')
      if(!del) return
      const i = Number(del.dataset.index)
      if(!confirm('حذف الكوبون؟')) return
      const coupons = getCoupons()
      coupons.splice(i,1)
      saveCoupons(coupons)
      renderCoupons()
    })
  }

  // initialize admin page
  document.addEventListener('DOMContentLoaded',()=>{
    // require session auth set by the login modal
    const auth = sessionStorage.getItem('dioura_admin_auth') === '1'
    if(!auth){
      // show a simple message and a button to open the login modal (provided by main.js)
      const container = document.querySelector('.admin-root')
      if(container){
        container.innerHTML = `<div style="padding:3rem;text-align:center;color:#444"><p>الوصول محصور لمشرفي الموقع.</p><p>اضغط مطولاً على الشريط في أسفل الصفحة ثم سجّل الدخول للوصول للوحة الإدارة.</p><p style="margin-top:1rem"><button id="openAdminLogin" class="save">تسجيل دخول</button></p></div>`
        const openLoginBtn = document.getElementById('openAdminLogin')
        if(openLoginBtn) openLoginBtn.addEventListener('click',()=>{ if(typeof window.showAdminLoginModal === 'function') window.showAdminLoginModal(); else alert('وظيفة تسجيل الدخول غير متاحة حالياً') })
      }
      return
    }

    // render admin UI when authenticated
  // populate category selects before binding form
  try{ populateCategorySelects() }catch(e){}
  renderProducts()
  bindProductForm()
    // Clear all products button (global wipe)
    const clearAllBtn = document.getElementById('clearAllProductsBtn')
    if (clearAllBtn) clearAllBtn.addEventListener('click', ()=>{
      if(!confirm('هل تريد حذف جميع المنتجات نهائياً؟ هذه العملية لا يمكن التراجع عنها.')) return
      saveProducts([])
      renderProducts()
      alert('تم حذف جميع المنتجات من المتجر')
    })
    renderOrders()
    renderCoupons()
    bindCoupons()

    // admin settings form: manage admin credentials and logout
    const settingsForm = document.getElementById('adminSettingsForm')
    function getAdminCreds(){
      try{
        const raw = localStorage.getItem('dioura_admin')
        if(!raw) return {user:'Ali', passHash:null}
        return JSON.parse(raw)
      }catch(e){return {user:'Ali', passHash:null}}
    }
    function setAdminCreds(obj){localStorage.setItem('dioura_admin',JSON.stringify(obj))}
    if(settingsForm){
      const creds = getAdminCreds()
      settingsForm.adminUser.value = creds.user || 'Ali'
      // do NOT pre-fill password field for security
      settingsForm.adminPass.value = ''
      settingsForm.addEventListener('submit', async (ev)=>{
        ev.preventDefault()
        const fd = new FormData(settingsForm)
        const user = fd.get('adminUser')?.toString().trim() || 'Ali'
        const pass = fd.get('adminPass')?.toString() || ''
        if(pass){
          // compute hash and store
          try{
            const enc = new TextEncoder().encode(pass)
            const buf = await crypto.subtle.digest('SHA-256', enc)
            const h = Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('')
            setAdminCreds({user, passHash: h})
            // force logout after password change to require re-login
            sessionStorage.removeItem('dioura_admin_auth')
            alert('تم حفظ بيانات المسؤول. سيتم إعادة توجيهك لتسجيل الدخول مرة أخرى.')
            window.location.href = '/'
            return
          }catch(e){
            // fallback: store plaintext if hashing fails
            setAdminCreds({user, passHash: null, pass: pass})
            sessionStorage.removeItem('dioura_admin_auth')
            alert('تم حفظ بيانات المسؤول (ملاحظة: تم تخزين كلمة المرور نصاً). سيتم إعادة توجيهك لتسجيل الدخول مرة أخرى.')
            window.location.href = '/'
            return
          }
        } else {
          // only update username -> still force logout to ensure session consistency
          const existing = getAdminCreds() || {}
          setAdminCreds({ user, passHash: existing.passHash || existing.pass || null })
          sessionStorage.removeItem('dioura_admin_auth')
          alert('تم حفظ اسم المستخدم. سيتم إعادة توجيهك لتسجيل الدخول مرة أخرى.')
          window.location.href = '/'
          return
        }
      })
    }
    const adminLogoutBtn = document.getElementById('adminLogoutBtn')
    if(adminLogoutBtn) adminLogoutBtn.addEventListener('click',()=>{
      sessionStorage.removeItem('dioura_admin_auth')
      alert('تم تسجيل الخروج'); window.location.href = '/'
    })
  })

  // populate categories into the product form selects
  function populateCategorySelects(){
    const groupSel = document.getElementById('productGroup')
    const subSel = document.getElementById('productSubcategory')
    if(!groupSel) return
    groupSel.innerHTML = '<option value="">اختر المجموعة</option>'
    Object.keys(CATEGORIES).forEach(g=>{
      const opt = document.createElement('option')
      opt.value = g; opt.textContent = g
      groupSel.appendChild(opt)
    })
    // when group changes populate subcategories
    groupSel.addEventListener('change', ()=>{
      const val = groupSel.value || ''
      subSel.innerHTML = '<option value="">اختر الفئة</option>'
      if(val && CATEGORIES[val]){
        CATEGORIES[val].forEach(sc=>{
          const o = document.createElement('option')
          o.value = sc; o.textContent = sc
          subSel.appendChild(o)
        })
      }
    })
    // Persist categories so the storefront script can read available groups
    try{
      localStorage.setItem('dioura_categories', JSON.stringify(CATEGORIES))
    }catch(e){
      console.warn('Failed to persist dioura_categories', e)
    }
  }

  // expose for debugging
  window.DIOURA_ADMIN = {getProducts, saveProducts, getCoupons, saveCoupons}
  }catch(err){
    console.error('Error in admin.js', err)
    try{ alert('حدث خطأ في لوحة الإدارة: ' + (err && err.message ? err.message : String(err))) }catch(e){}
  }
})();
