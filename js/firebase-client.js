// Lightweight Firebase client wrapper using modular SDK (dynamic imports)
// Usage:
// 1. Call FirebaseClient.init(firebaseConfig)
// 2. Use FirebaseClient.fetchProducts(), .listenProducts(cb), .addProduct(obj), .updateProduct(id,obj), .deleteProduct(id)

window.FirebaseClient = (function(){
  let app = null
  let db = null
  let initialized = false
  let modules = null

  async function init(config){
    if(!config) throw new Error('Firebase config required')
    // dynamic import modular SDK
    modules = await Promise.all([
      import('https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js'),
      import('https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js')
    ])
    const firebaseApp = modules[0]
    const firestore = modules[1]
    const firebaseAuth = modules[2]
    app = firebaseApp.initializeApp(config)
    db = firestore.getFirestore(app)
    auth = firebaseAuth.getAuth ? firebaseAuth.getAuth(app) : null
    initialized = true
    console.info('Firebase initialized')
    return true
  }

  function isReady(){ return initialized && db }

  // Auth helpers
  function isAuthReady(){ return !!auth }

  async function signIn(email, password){
    if(!isAuthReady()) throw new Error('Auth not initialized')
    const firebaseAuth = modules[2]
    const res = await firebaseAuth.signInWithEmailAndPassword(auth, email, password)
    return res.user
  }

  async function signOutUser(){
    if(!isAuthReady()) throw new Error('Auth not initialized')
    const firebaseAuth = modules[2]
    await firebaseAuth.signOut(auth)
    return true
  }

  function onAuthChanged(cb){
    if(!isAuthReady()) return () => {}
    const firebaseAuth = modules[2]
    return firebaseAuth.onAuthStateChanged(auth, cb)
  }

  async function fetchProducts(){
    if(!isReady()) return []
    const firestore = modules[1]
    try{
      const q = await firestore.getDocs(firestore.collection(db,'products'))
      return q.docs.map(d => ({ id: d.id, ...d.data() }))
    }catch(e){ console.error('fetchProducts error', e); return [] }
  }

  async function fetchProductById(id){
    if(!isReady()) return null
    const firestore = modules[1]
    try{
      const ref = firestore.doc(db, 'products', id)
      const snap = await firestore.getDoc(ref)
      if(!snap.exists()) return null
      return { id: snap.id, ...snap.data() }
    }catch(e){ console.error('fetchProductById error', e); return null }
  }

  async function fetchProductById(id){
    if(!isReady()) return null
    const firestore = modules[1]
    try{
      const ref = firestore.doc(db, 'products', id)
      const snap = await firestore.getDoc(ref)
      if(!snap.exists()) return null
      return { id: snap.id, ...snap.data() }
    }catch(e){ console.error('fetchProductById error', e); return null }
  }

  function listenProducts(onChange){
    if(!isReady()) return () => {}
    const firestore = modules[1]
    const col = firestore.collection(db,'products')
    const unsub = firestore.onSnapshot(col, (snap)=>{
      const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      try{ onChange(arr) }catch(e){ console.error(e) }
    }, (err)=>{ console.error('listenProducts err', err) })
    return unsub
  }

  async function addProduct(obj){
    if(!isReady()) throw new Error('Firebase not initialized')
    const firestore = modules[1]
    const res = await firestore.addDoc(firestore.collection(db,'products'), obj)
    return res.id
  }


  // Orders API
  async function addOrder(obj){
    if(!isReady()) throw new Error('Firebase not initialized')
    const firestore = modules[1]
    const res = await firestore.addDoc(firestore.collection(db,'orders'), obj)
    return res.id
  }

  async function fetchOrders(){
    if(!isReady()) return []
    const firestore = modules[1]
    try{
      const q = await firestore.getDocs(firestore.collection(db,'orders'))
      return q.docs.map(d => ({ id: d.id, ...d.data() }))
    }catch(e){ console.error('fetchOrders error', e); return [] }
  }

  function listenOrders(onChange){
    if(!isReady()) return () => {}
    const firestore = modules[1]
    const col = firestore.collection(db,'orders')
    const unsub = firestore.onSnapshot(col, (snap)=>{
      const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      try{ onChange(arr) }catch(e){ console.error(e) }
    }, (err)=>{ console.error('listenOrders err', err) })
    return unsub
  }

  async function updateProduct(id, obj){
    if(!isReady()) throw new Error('Firebase not initialized')
    const firestore = modules[1]
    const ref = firestore.doc(db, 'products', id)
    await firestore.setDoc(ref, obj, { merge: true })
    return id
  }

  async function deleteProduct(id){
    if(!isReady()) throw new Error('Firebase not initialized')
    const firestore = modules[1]
    const ref = firestore.doc(db, 'products', id)
    await firestore.deleteDoc(ref)
    return true
  }

  return { init, isReady, isAuthReady, signIn, signOutUser, onAuthChanged, fetchProducts, fetchProductById, listenProducts, addProduct, updateProduct, deleteProduct, addOrder, fetchOrders, listenOrders }
})();
