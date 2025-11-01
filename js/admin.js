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

  // If Firebase is enabled and ready use it; otherwise fall back to localStorage
  if(window.FIREBASE_ENABLED && window.FirebaseClient && window.FirebaseClient.isReady()){
      window.FirebaseClient.fetchProducts().then(products => {
        tbody.innerHTML = ''
        products.forEach((p)=>{
          const tr = document.createElement('tr')
          const img = (p.images && p.images.length)? `<img src="${p.images[0]}" />` : '-'
          tr.innerHTML = `
            <td>${img}</td>
            <td>${escapeHtml(p.title||'')}</td>
            <td>${escapeHtml((p.group||'') + (p.subcategory?(' / '+p.subcategory):''))}</td>
            <td>${formatPrice(p.price||0)}</td>
            <td>${p.discount? (p.discount+'%') : '-'}</td>
            <td>${p.published? '<span class="published-yes">نعم</span>':'<span class="published-no">لا</span>'}</td>
            <td>
              <button data-id="${p.id}" class="btn-small btn-edit actions-btn">تعديل</button>
              <button data-id="${p.id}" class="btn-small btn-delete actions-btn">حذف</button>
            </td>
          `
          tbody.appendChild(tr)
        })
      }).catch(e=>{ console.error('renderProducts firebase', e) })
      return
    }

    const products = getProducts()
    tbody.innerHTML = ''
    products.forEach((p,i)=>{
      const tr = document.createElement('tr')
      const img = (p.images && p.images.length)? `<img src="${p.images[0]}" />` : '-'
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
      console.log('admin: productForm submit triggered')
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
  if(window.FIREBASE_ENABLED && window.FirebaseClient && window.FirebaseClient.isReady()){
          // try saving to Firebase but fall back to localStorage on any error
          try{
            if(index){
              // treat index as doc id
              await window.FirebaseClient.updateProduct(index, item)
            } else {
              await window.FirebaseClient.addProduct(item)
            }
            form.reset()
            const preview = document.getElementById('imagePreview')
            if(preview) preview.innerHTML = ''
            // re-render (listener or manual)
            renderProducts()
            alert('تم حفظ المنتج (Firebase)')
          }catch(fbErr){
            console.error('Firebase save failed, falling back to localStorage', fbErr)
            if(index){
              products[Number(index)] = item
            } else {
              products.push(item)
            }
            saveProducts(products)
            console.log('admin: products now (local fallback)', products)
            form.reset()
            const preview = document.getElementById('imagePreview')
            if(preview) preview.innerHTML = ''
            renderProducts()
            alert('تم حفظ المنتج محلياً (تعذر الحفظ في Firebase)')
            // notify main script to re-render if it listens to storage changes
            window.dispatchEvent(new Event('storage'))
          }
        } else {
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
        }
      }catch(err){
        console.error('Error saving product', err)
        alert('خطأ أثناء حفظ المنتج: ' + (err && err.message ? err.message : String(err)))
      }
    })

  const clearBtn = document.getElementById('clearProductForm')
  if(clearBtn) clearBtn.addEventListener('click',()=>form.reset())

  // edit / delete buttons (supports both localStorage index and Firebase doc id)
  const productsTbody = document.querySelector('#productsTable tbody')
  if(productsTbody) productsTbody.addEventListener('click', async (e)=>{
      const editBtn = e.target.closest('.btn-edit')
      const delBtn = e.target.closest('.btn-delete')
      if(editBtn){
        const docId = editBtn.dataset.id
        const idx = editBtn.dataset.index ? Number(editBtn.dataset.index) : null
        const f = form
  if(docId && window.FIREBASE_ENABLED && window.FirebaseClient && window.FirebaseClient.isReady()){
          try{
            const products = await window.FirebaseClient.fetchProducts()
            const p = products.find(x=>x.id === docId)
            if(!p) return
            f.index.value = docId
            f.title.value = p.title || ''
            f.description.value = p.description || ''
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
            const groupSel = document.getElementById('productGroup')
            const subSel = document.getElementById('productSubcategory')
            if(groupSel) groupSel.value = p.group || ''
            if(groupSel) groupSel.dispatchEvent(new Event('change'))
            if(subSel) subSel.value = p.subcategory || ''
          }catch(err){ console.error('Error loading firebase product for edit', err) }
        } else if(idx !== null){
          const p = getProducts()[idx]
          if(!p) return
          f.index.value = idx
          f.title.value = p.title||''
          f.description.value = p.description||''
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
          const groupSel = document.getElementById('productGroup')
          const subSel = document.getElementById('productSubcategory')
          if(groupSel) groupSel.value = p.group || ''
          if(groupSel) groupSel.dispatchEvent(new Event('change'))
          if(subSel) subSel.value = p.subcategory || ''
        }
      }
      if(delBtn){
        if(!confirm('هل تريد حذف هذا المنتج؟')) return
        const docId = delBtn.dataset.id
        const idx = delBtn.dataset.index ? Number(delBtn.dataset.index) : null
  if(docId && window.FIREBASE_ENABLED && window.FirebaseClient && window.FirebaseClient.isReady()){
          try{
            await window.FirebaseClient.deleteProduct(docId)
            renderProducts()
          }catch(err){ console.error('Error deleting firebase product', err) }
        } else if(idx !== null){
          const products = getProducts()
          products.splice(idx,1)
          saveProducts(products)
          renderProducts()
        }
      }
    })
  }

  // render orders table
  function renderOrders(){
    const tbody = document.querySelector('#ordersTable tbody')
    if(!tbody) return
    tbody.innerHTML = ''
    // If Firebase is available use it for orders; otherwise fall back to localStorage
  if(window.FIREBASE_ENABLED && window.FirebaseClient && window.FirebaseClient.isReady()){
      window.FirebaseClient.fetchOrders().then(orders=>{
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
      }).catch(e=>{ console.error('renderOrders firebase', e) })
      return
    }
    const orders = JSON.parse(localStorage.getItem(ORDERS_KEY)||'[]')
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
    if (clearAllBtn) clearAllBtn.addEventListener('click', async ()=>{
      if(!confirm('هل تريد حذف جميع المنتجات نهائياً؟ هذه العملية لا يمكن التراجع عنها.')) return
  if(window.FIREBASE_ENABLED && window.FirebaseClient && window.FirebaseClient.isReady()){
        try{
          const prods = await window.FirebaseClient.fetchProducts()
          for(const p of prods){
            try{ await window.FirebaseClient.deleteProduct(p.id) }catch(e){ console.error('delete product', p.id, e) }
          }
          renderProducts()
          alert('تم حذف جميع المنتجات من المتجر (Firebase)')
        }catch(e){ console.error('Error clearing firebase products', e); alert('فشل حذف المنتجات') }
      } else {
        saveProducts([])
        renderProducts()
        alert('تم حذف جميع المنتجات من المتجر')
      }
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
        // If Firebase is enabled, we won't save admin password locally; instead instruct to create admin user in Firebase Auth
        const creds = getAdminCreds()
        settingsForm.adminUser.value = creds.user || 'Ali'
        settingsForm.adminPass.value = ''
        settingsForm.addEventListener('submit', async (ev)=>{
          ev.preventDefault()
          if(window.FIREBASE_ENABLED){
            alert('Firebase مفعل: لإدارة حساب المشرف استخدم Firebase Console لإضافة مستخدم (Authentication → Users). لا تقم بتخزين كلمة المرور محلياً.')
            // still update username locally for fallback
            const fd = new FormData(settingsForm)
            const user = fd.get('adminUser')?.toString().trim() || 'Ali'
            const existing = getAdminCreds() || {}
            setAdminCreds({ user, passHash: existing.passHash || existing.pass || null })
            sessionStorage.removeItem('dioura_admin_auth')
            alert('تم حفظ اسم المستخدم محلياً. استخدم Firebase Console لإضافة مستخدم المشرف.')
            window.location.href = '../index.html'
            return
          } else {
            const fd = new FormData(settingsForm)
            const user = fd.get('adminUser')?.toString().trim() || 'Ali'
            const pass = fd.get('adminPass')?.toString() || ''
            if(pass){
              try{
                const enc = new TextEncoder().encode(pass)
                const buf = await crypto.subtle.digest('SHA-256', enc)
                const h = Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('')
                setAdminCreds({user, passHash: h})
                sessionStorage.removeItem('dioura_admin_auth')
                alert('تم حفظ بيانات المسؤول. سيتم إعادة توجيهك لتسجيل الدخول مرة أخرى.');
                window.location.href = '../index.html'
                return
              }catch(e){
                setAdminCreds({user, passHash: null, pass: pass})
                sessionStorage.removeItem('dioura_admin_auth')
                alert('تم حفظ بيانات المسؤول (تم تخزين كلمة المرور نصياً). سيتم إعادة توجيهك لتسجيل الدخول مرة أخرى.');
                window.location.href = '../index.html'
                return
              }
            } else {
              const existing = getAdminCreds() || {}
              setAdminCreds({ user, passHash: existing.passHash || existing.pass || null })
              sessionStorage.removeItem('dioura_admin_auth')
              alert('تم حفظ اسم المستخدم. سيتم إعادة توجيهك لتسجيل الدخول مرة أخرى.')
              window.location.href = '../index.html'
              return
            }
          }
        })
    }
    const adminLogoutBtn = document.getElementById('adminLogoutBtn')
    if(adminLogoutBtn) adminLogoutBtn.addEventListener('click',()=>{
      sessionStorage.removeItem('dioura_admin_auth')
      alert('تم تسجيل الخروج'); window.location.href = '../index.html'
    })

    // If Firebase is enabled show a quick sync button to push local products to Firestore
    if(window.FIREBASE_ENABLED && window.FirebaseClient && window.FirebaseClient.isReady()){
      const wrap = document.createElement('div')
      wrap.style.marginTop = '.8rem'
      const btn = document.createElement('button')
      btn.textContent = 'مزامنة المنتجات المحلية إلى Firebase'
      btn.className = 'save'
      btn.addEventListener('click', async ()=>{
        if(!confirm('هل تريد رفع جميع المنتجات المحلية إلى Firebase؟ قد يتسبب ذلك بتكرار المنتجات إذا كانت موجودة بالفعل.')) return
        try{
          const prods = getProducts()
          let count = 0
          for(const p of prods){
            try{ await window.FirebaseClient.addProduct(p); count++ }catch(e){ console.error('sync product failed', e) }
          }
          alert('تمت مزامنة ' + count + ' منتج(منتجات) إلى Firebase')
          renderProducts()
        }catch(e){ console.error('sync failed', e); alert('فشل المزامنة') }
      })
      const container = document.querySelector('.admin-root')
      if(container) container.insertBefore(wrap, container.firstChild)
      wrap.appendChild(btn)
    }
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
