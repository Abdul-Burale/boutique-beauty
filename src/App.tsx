import { useEffect, useMemo, useState } from 'react'
import type { FormEvent, MouseEvent } from 'react'
import { ArrowRight, ChevronDown, Menu, Search, ShieldCheck, ShoppingBag, UserRound, X } from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import AdminDashboard from './components/AdminDashboard'
import AccountDashboard from './components/AccountDashboard'
import AccountAccessPage from './components/AccountAccessPage'
import ProductPhoto from './components/ProductPhoto'
import ProductDetailPage from './components/ProductDetailPage'
import ContentPageView from './components/ContentPageView'
import { api, type Basket, type Category, type ContentPage, type Customer, type FooterHelpLink, type Product, type StorefrontContent } from './lib/api'
import { supabase } from './lib/supabase'

const imageUrl = (image: string | null) => image || ''
const money = (minor: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(minor / 100)
const sorts = [{ label: 'Featured', value: 'featured' }, { label: 'Price: low to high', value: 'price_asc' }, { label: 'Price: high to low', value: 'price_desc' }, { label: 'Name: A to Z', value: 'name_asc' }]
const customerFromAuthUser = (user: User): Customer => ({
  id: user.id,
  email: user.email || '',
  firstName: typeof user.user_metadata.first_name === 'string' ? user.user_metadata.first_name : user.email?.split('@')[0] || 'there',
  lastName: typeof user.user_metadata.last_name === 'string' ? user.user_metadata.last_name : '',
})

function App() {
  const [categories, setCategories] = useState<Category[]>([])
  const [navCategories, setNavCategories] = useState<Category[]>([])
  const [category, setCategory] = useState('')
  const [sort, setSort] = useState('featured')
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [page, setPage] = useState(0)
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [contentPages, setContentPages] = useState<ContentPage[]>([])
  const [storefront, setStorefront] = useState<StorefrontContent | null>(null)
  const [storefrontLoaded, setStorefrontLoaded] = useState(false)
  const [contentPageSlug, setContentPageSlug] = useState(() => window.location.pathname.match(/^\/pages\/([^/]+)/)?.[1] || '')
  const [contentPage, setContentPage] = useState<ContentPage | null>(null)
  const [contentPageLoading, setContentPageLoading] = useState(false)
  const [contentPageError, setContentPageError] = useState('')
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(0)
  const [loading, setLoading] = useState(true)
  const [catalogError, setCatalogError] = useState('')
  const [categoryError, setCategoryError] = useState('')
  const [catalogReload, setCatalogReload] = useState(0)
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [basket, setBasket] = useState<Basket>({ items: [], subtotalMinor: 0, currency: 'GBP' })
  const [basketLoading, setBasketLoading] = useState(false)
  const [basketError, setBasketError] = useState('')
  const [authOpen, setAuthOpen] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [authMessage, setAuthMessage] = useState('')
  const [authMessageIsError, setAuthMessageIsError] = useState(true)
  const [adminView, setAdminView] = useState(false)
  const [accountView, setAccountView] = useState(false)
  const [bagOpen, setBagOpen] = useState(false)
  const [mobileMenu, setMobileMenu] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [notice, setNotice] = useState('')
  const [noticeError, setNoticeError] = useState(false)
  const [authBusy, setAuthBusy] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => { setDebouncedQuery(query.trim()); setPage(0) }, 300)
    return () => window.clearTimeout(timer)
  }, [query])

  useEffect(() => {
    if (adminView || accountView) window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [adminView, accountView])

  useEffect(() => {
    let active = true
    const refreshContent = () => {
      api.contentPages().then((rows) => { if (active) setContentPages(rows) }).catch(() => {})
      api.storefrontContent().then((data) => { if (active) setStorefront(data) }).catch(() => {}).finally(() => { if (active) setStorefrontLoaded(true) })
    }
    refreshContent()
    window.addEventListener('boutique-content-updated', refreshContent)
    const onPopState = () => setContentPageSlug(window.location.pathname.match(/^\/pages\/([^/]+)/)?.[1] || '')
    window.addEventListener('popstate', onPopState)
    return () => { active = false; window.removeEventListener('popstate', onPopState); window.removeEventListener('boutique-content-updated', refreshContent) }
  }, [])

  useEffect(() => {
    if (!contentPageSlug) { setContentPage(null); setContentPageError(''); return }
    let active = true
    const cachedPage = contentPages.find((item) => item.slug === contentPageSlug)
    if (cachedPage) { setContentPage(cachedPage); setContentPageLoading(false); setContentPageError(''); return }
    setContentPage(null); setContentPageLoading(true); setContentPageError('')
    api.contentPage(contentPageSlug).then((page) => { if (active) setContentPage(page) }).catch((cause: Error) => { if (active) setContentPageError(cause.message) }).finally(() => { if (active) setContentPageLoading(false) })
    return () => { active = false }
  }, [contentPageSlug, contentPages])

  useEffect(() => {
    let active = true
    api.categories().then(async (result) => {
      if (!active) return
      setCategories(result); setCategoryError('')
      const counts = await Promise.allSettled(result.map((item) => api.products({ page: 0, size: 1, q: '', category: item.slug, sort: 'featured' })))
      if (!active) return
      const hasCounts = counts.some((count) => count.status === 'fulfilled')
      setNavCategories(hasCounts ? result.filter((_, index) => counts[index].status === 'fulfilled' && counts[index].value.total > 0) : result)
    }).catch((error: Error) => { if (active) setCategoryError(error.message) })
    return () => { active = false }
  }, [catalogReload])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setCatalogError('')
    api.products({ page, size: 40, q: debouncedQuery, category, sort }, controller.signal)
      .then((result) => { setProducts(result.items); setTotal(result.total); setPages(result.pages) })
      .catch((error: Error) => { if (error.name !== 'AbortError') { setCatalogError(error.message); setProducts([]); setTotal(0); setPages(0) } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [page, debouncedQuery, category, sort, catalogReload])

  const refreshBasket = async () => {
    setBasketLoading(true)
    setBasketError('')
    try { setBasket(await api.basket()) }
    catch (error) { setBasketError((error as Error).message) }
    finally { setBasketLoading(false) }
  }

  const loadCustomerData = async (user: User) => {
    setCustomer(customerFromAuthUser(user))
    setBasketLoading(true)
    setBasketError('')
    try {
      const profile = await api.me()
      setCustomer(profile)
      if (profile.role === 'ADMIN') {
        setBasket({ items: [], subtotalMinor: 0, currency: 'GBP' })
      } else {
        setBasket(await api.basket())
      }
    } catch (error) {
      setBasketError((error as Error).message)
    } finally { setBasketLoading(false) }
  }

  useEffect(() => {
    if (!supabase) return
    let active = true
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return
      if (error) { setAuthMessage(error.message); return }
      if (data.session?.user) void loadCustomerData(data.session.user)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        setCustomer(null)
        setAccountView(false)
        setBasket({ items: [], subtotalMinor: 0, currency: 'GBP' })
        return
      }
      if (event === 'SIGNED_IN' && session.user) {
        // Defer API calls until after the Supabase auth callback releases its lock.
        window.setTimeout(() => { if (active) void loadCustomerData(session.user) }, 0)
      }
    })
    return () => { active = false; subscription.unsubscribe() }
  }, [])

  const selectedCategory = useMemo(() => categories.find((item) => item.slug === category), [categories, category])
  const itemCount = basket.items.reduce((sum, item) => sum + item.quantity, 0)
  const showNotice = (message: string, isError = false) => {
    setNotice(message); setNoticeError(isError)
    window.setTimeout(() => setNotice(''), 2800)
  }

  const addToBag = async (product: Product, quantity = 1) => {
    if (!customer) { setAuthMode('login'); setAuthOpen(true); showNotice('Sign in or create an account to add items to your bag', true); return }
    const existing = basket.items.find((item) => item.variantId === product.variantId)
    if (product.stock <= (existing?.quantity ?? 0) || quantity + (existing?.quantity ?? 0) > product.stock) {
      showNotice(product.stock <= 0 ? 'This product is currently out of stock' : `Only ${product.stock} available`, true)
      return
    }
    setBasketLoading(true); setBasketError('')
    try {
      setBasket(await api.putBasketLine(product.variantId, (existing?.quantity ?? 0) + quantity))
      showNotice(`${product.name} added to your bag`)
    } catch (error) { const message = (error as Error).message; setBasketError(message); showNotice(message, true) }
    finally { setBasketLoading(false) }
  }

  const removeFromBag = async (variantId: number) => {
    setBasketLoading(true); setBasketError('')
    try { setBasket(await api.removeBasketLine(variantId)) }
    catch (error) { const message = (error as Error).message; setBasketError(message); showNotice(message, true) }
    finally { setBasketLoading(false) }
  }

  const handleAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setAuthBusy(true); setAuthMessage(''); setAuthMessageIsError(true)
    if (!supabase) { setAuthMessage('Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local, then restart the frontend.'); setAuthBusy(false); return }
    const form = new FormData(event.currentTarget)
    try {
      const email = String(form.get('email'))
      const password = String(form.get('password'))
      if (authMode === 'login') {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        if (!data.user || !data.session) throw new Error('Sign-in succeeded without an active session. Try again.')
        setCustomer(customerFromAuthUser(data.user)); setAuthOpen(false); showNotice(`Welcome${data.user.user_metadata.first_name ? `, ${data.user.user_metadata.first_name}` : ''}!`)
        await loadCustomerData(data.user)
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { first_name: String(form.get('firstName')).trim(), last_name: String(form.get('lastName')).trim() },
            emailRedirectTo: window.location.origin,
          },
        })
        if (error) throw error
        if (data.session && data.user) {
          setCustomer(customerFromAuthUser(data.user)); setAuthOpen(false); showNotice(`Welcome${data.user.user_metadata.first_name ? `, ${data.user.user_metadata.first_name}` : ''}!`)
          await loadCustomerData(data.user)
        } else {
          setAuthMessageIsError(false)
          setAuthMessage('Your account was created. Check your email to confirm it, then sign in.')
        }
      }
    } catch (error) { setAuthMessage((error as Error).message) }
    finally { setAuthBusy(false) }
  }

  const logout = async () => {
    if (supabase) {
      const { error } = await supabase.auth.signOut({ scope: 'local' })
      if (error) { showNotice(error.message, true); return }
    }
    setCustomer(null); setBasket({ items: [], subtotalMinor: 0, currency: 'GBP' }); setAuthOpen(false); setAdminView(false); showNotice('You are signed out')
  }

  const goToCollection = (slug = '') => {
    setSelectedProduct(null)
    setContentPageSlug('')
    if (window.location.pathname !== '/') window.history.pushState({}, '', '/')
    setAdminView(false); setAccountView(false); setCategory(slug); setQuery(''); setSort('featured'); setPage(0); setMobileMenu(false)
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' })))
  }
  const navLinks = [
    { label: 'New & noteworthy', action: () => goToCollection('') },
    { label: 'Shop all', action: () => goToCollection('') },
    ...navCategories.map((item) => ({ label: item.name, action: () => goToCollection(item.slug) })),
  ]

  const openProduct = (product: Product) => {
    setSelectedProduct(product)
    setContentPageSlug('')
    setAdminView(false)
    setAccountView(false)
    setMobileMenu(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const openContentPage = (slug: string) => {
    setSelectedProduct(null)
    setContentPageSlug(slug)
    setAdminView(false); setAccountView(false); setMobileMenu(false)
    window.history.pushState({}, '', `/pages/${encodeURIComponent(slug)}`)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const backFromContentPage = () => {
    setContentPageSlug('')
    window.history.pushState({}, '', '/')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const followFooterUrl = (event: MouseEvent<HTMLAnchorElement>, url: string) => {
    const parsed = new URL(url, window.location.origin)
    if (parsed.origin !== window.location.origin) return
    const pathParts = parsed.pathname.split('/').filter(Boolean)
    const slug = pathParts[pathParts.length - 1]
    if (slug && contentPages.some((item) => item.slug === slug)) { event.preventDefault(); openContentPage(slug) }
  }

  const defaultHelpLinks: FooterHelpLink[] = [
    { label: 'Contact us', url: '#top', displayOrder: 0 },
    { label: 'Delivery & returns', url: '#top', displayOrder: 1 },
    { label: 'FAQs', url: '#top', displayOrder: 2 },
    { label: 'Find your order', url: '#top', displayOrder: 3 },
  ]
  const footerHelpLinks = storefrontLoaded ? storefront?.footerHelpLinks || [] : defaultHelpLinks
  const footerPageGroups = Object.entries(contentPages.reduce<Record<string, ContentPage[]>>((groups, item) => {
    const group = item.footerGroup?.trim() || 'Information'
    ;(groups[group] ||= []).push(item)
    return groups
  }, {}))

  return (
    <div className="min-h-screen bg-[#fffdfa] text-ink">
      <div className="bg-[#293c35] px-4 py-2 text-center text-[10px] font-medium uppercase tracking-[.19em] text-white sm:text-xs">A little something lovely: complimentary delivery over £45</div>
      <div className="bg-[#f4e6df] px-4 py-2 text-center text-xs tracking-wide text-[#60463f]">Meet your new everyday ritual — explore our edit <ArrowRight className="ml-1 inline" size={13} /></div>

      <header className="sticky top-0 z-40 border-b border-black/5 bg-[#fffdfa]/95 backdrop-blur">
        <div className="mx-auto flex h-[76px] max-w-[1440px] items-center justify-between px-4 sm:px-8 lg:px-12">
          <div className="flex items-center gap-3 lg:hidden"><button aria-label="Open menu" onClick={() => setMobileMenu(!mobileMenu)} className="p-2"><Menu size={21} strokeWidth={1.5} /></button><button aria-label="Search" onClick={() => setShowSearch(!showSearch)} className="p-2"><Search size={20} strokeWidth={1.5} /></button></div>
          <a href="#top" aria-label="Boutique Beauty Retail home" onClick={(event) => { if (contentPageSlug || selectedProduct || adminView || accountView) { event.preventDefault(); setSelectedProduct(null); setAdminView(false); setAccountView(false); backFromContentPage(); goToCollection('') } }} className="absolute left-1/2 flex -translate-x-1/2 flex-col items-center leading-none lg:static lg:translate-x-0 lg:items-start"><span className="font-display text-[21px] tracking-[.12em] sm:text-[25px]">BOUTIQUE</span><span className="mt-1 text-[8px] font-medium uppercase tracking-[.34em] text-[#8f6559] sm:text-[9px]">Beauty Retail</span></a>
          <div className="hidden max-w-[470px] flex-1 px-8 lg:block"><label className="flex h-11 items-center border-b border-stone-300 text-stone-500 focus-within:border-ink"><Search size={18} strokeWidth={1.5} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search your next favourite" className="w-full bg-transparent px-3 text-sm outline-none placeholder:text-stone-400" />{query && <button onClick={() => setQuery('')} aria-label="Clear search"><X size={16} /></button>}</label></div>
          <div className="flex items-center gap-1 sm:gap-4">{customer?.role === 'ADMIN' && <button aria-label="Open admin studio" onClick={() => { setAdminView(true); setAccountView(false); setAuthOpen(false); setBagOpen(false) }} className="flex items-center gap-1 rounded-full border border-[#ead8ce] bg-[#f8f2ec] px-3 py-2 text-[#8f6559] transition hover:border-[#d9c4b8] hover:bg-[#f4e6df] hover:text-ink sm:gap-2"><ShieldCheck size={17} /><span className="hidden text-[10px] uppercase tracking-[.14em] sm:inline">Admin</span></button>}<button aria-label={customer ? 'Account settings' : 'Sign in'} onClick={() => { setAccountView(true); setAdminView(false); setAuthOpen(false); setAuthMessage(''); setAuthMode('login'); setBagOpen(false) }} className="p-2"><UserRound size={21} strokeWidth={1.5} /><span className="sr-only">{customer ? customer.firstName : 'Sign in'}</span></button><button aria-label={`Shopping bag, ${itemCount} items`} onClick={() => { if (!customer) { setAuthMode('login'); setAuthOpen(true) } else { setBagOpen(true); void refreshBasket() } }} className="relative flex items-center gap-2 p-2"><ShoppingBag size={21} strokeWidth={1.5} /><span className="hidden text-xs uppercase tracking-[.12em] sm:block">Bag</span><span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#293c35] px-1 text-[9px] text-white">{itemCount}</span></button></div>
        </div>
        <nav className="hidden h-14 items-center justify-center gap-5 overflow-x-auto border-t border-black/5 px-6 lg:flex" aria-label="Main navigation">
          <button onClick={navLinks[0].action} className="shrink-0 px-2 py-2 text-[10px] font-medium uppercase tracking-[.14em] text-stone-600 transition hover:text-[#a45f50]">New &amp; noteworthy</button>
          <button onClick={navLinks[1].action} className={`shrink-0 rounded-full border px-4 py-2 text-[10px] font-medium uppercase tracking-[.14em] transition ${!category ? 'border-[#293c35] bg-[#293c35] text-white' : 'border-stone-300 bg-white text-stone-700 hover:border-[#293c35]'}`}>Shop all</button>
          {navCategories.length > 0 && <span aria-hidden="true" className="h-7 border-l border-stone-300" />}
          {navCategories.length > 0 && <div className="flex items-center gap-1 rounded-full bg-[#f4eee7] p-1.5"><span className="pl-3 pr-1 text-[8px] font-semibold uppercase tracking-[.16em] text-stone-500">Categories</span>{navCategories.map((item) => <button key={item.id} onClick={() => goToCollection(item.slug)} aria-current={category === item.slug ? 'page' : undefined} className={`shrink-0 rounded-full px-3.5 py-2 text-[10px] font-medium uppercase tracking-[.12em] transition ${category === item.slug ? 'bg-white text-[#293c35] shadow-sm' : 'text-stone-600 hover:bg-white/70 hover:text-[#293c35]'}`}>{item.name}</button>)}</div>}
        </nav>
        {showSearch && <div className="border-t border-stone-200 px-5 py-3 lg:hidden"><input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search your next favourite" className="w-full bg-transparent py-2 outline-none" /></div>}
        {mobileMenu && <nav className="absolute left-0 right-0 top-full max-h-[75vh] overflow-y-auto border-t border-stone-200 bg-[#fffdfa] px-5 py-5 shadow-lg lg:hidden" aria-label="Mobile navigation">
          {customer?.role === 'ADMIN' && <button onClick={() => { setMobileMenu(false); setAdminView(true); setAccountView(false); setAuthOpen(false); setBagOpen(false) }} className="mb-5 flex w-full items-center gap-2 border border-[#d9c4b8] bg-[#f8f4ee] px-4 py-3 text-left text-xs uppercase tracking-[.16em] text-[#725046]"><ShieldCheck size={16} /> Admin studio</button>}
          <p className="mb-2 px-1 text-[9px] font-semibold uppercase tracking-[.18em] text-stone-500">Discover</p>
          <div className="mb-5 grid grid-cols-2 gap-2"><button onClick={navLinks[0].action} className="rounded border border-stone-200 px-3 py-3 text-left text-[10px] uppercase tracking-[.13em]">New &amp; noteworthy</button><button onClick={navLinks[1].action} className={`rounded border px-3 py-3 text-left text-[10px] uppercase tracking-[.13em] ${!category ? 'border-[#293c35] bg-[#293c35] text-white' : 'border-stone-200'}`}>Shop all</button></div>
          {navCategories.length > 0 && <><p className="mb-2 border-t border-stone-200 px-1 pt-4 text-[9px] font-semibold uppercase tracking-[.18em] text-stone-500">Shop by category</p><div className="grid grid-cols-2 gap-2">{navCategories.map((item) => <button onClick={() => goToCollection(item.slug)} key={item.id} aria-current={category === item.slug ? 'page' : undefined} className={`rounded border px-3 py-3 text-left text-[10px] uppercase tracking-[.13em] transition ${category === item.slug ? 'border-[#293c35] bg-[#293c35] text-white' : 'border-stone-200 bg-[#faf7f2] text-stone-700 hover:border-[#293c35]'}`}>{item.name}</button>)}</div></>}
        </nav>}
      </header>

      {adminView && customer?.role === 'ADMIN' ? <AdminDashboard categories={categories} onExit={() => setAdminView(false)} /> : accountView ? customer ? <AccountDashboard customer={customer} onExit={() => setAccountView(false)} onSignOut={() => void logout()} /> : <AccountAccessPage mode={authMode} onModeChange={(mode) => { setAuthMode(mode); setAuthMessage('') }} message={authMessage} messageIsError={authMessageIsError} busy={authBusy} onSubmit={handleAuth} onExit={() => setAccountView(false)} /> : <>
      {contentPageSlug ? contentPage ? <ContentPageView page={contentPage} onBack={backFromContentPage} /> : <main className="mx-auto min-h-[55vh] max-w-[960px] px-4 py-16 text-center sm:px-8"><p className="font-display text-2xl">{contentPageLoading ? 'Loading page…' : 'We couldn’t find that page'}</p>{contentPageError && <p className="mt-3 text-sm text-stone-500">This page may have been removed or is not published.</p>}<button onClick={backFromContentPage} className="mt-6 border-b border-stone-400 pb-1 text-[10px] uppercase tracking-wider">Back to shop</button></main> : selectedProduct ? <ProductDetailPage product={selectedProduct} related={products} loading={basketLoading} onBack={() => { setSelectedProduct(null); window.scrollTo({ top: 0, behavior: 'smooth' }) }} onAdd={(product, quantity) => void addToBag(product, quantity)} onSelect={openProduct} /> : <main id="top">
        {category && <section className="relative mx-auto max-w-[1440px] px-4 pb-0 pt-5 sm:px-8 lg:px-12"><nav aria-label="Breadcrumb" className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[.14em] text-stone-500"><button onClick={() => goToCollection('')} className="hover:text-[#a45f50]">Home</button><span aria-hidden="true">/</span><button onClick={() => goToCollection(categories.find((item) => item.slug === 'skincare' || item.name.toLowerCase() === 'skincare')?.slug || '')} className="hover:text-[#a45f50]">Skincare</button>{selectedCategory && selectedCategory.name.toLowerCase() !== 'skincare' && <><span aria-hidden="true">/</span><span aria-current="page" className="text-ink">{selectedCategory.name}</span></>}</nav></section>}
        <section id="products" className="mx-auto max-w-[1440px] px-4 pb-20 pt-8 sm:px-8 lg:px-12">
          {category && <div className="mb-5 flex flex-col justify-between gap-4 border-b border-stone-200 pb-5 sm:flex-row sm:items-center"><h1 className="font-display text-2xl sm:text-3xl">{selectedCategory?.name || 'Skincare'}</h1><div className="flex items-center gap-3 text-xs"><span className="text-stone-500">{loading ? 'Loading…' : `${total} ${total === 1 ? 'product' : 'products'}`}</span><label htmlFor="sort" className="sr-only">Sort products</label><div className="relative"><select id="sort" value={sort} onChange={(e) => { setSort(e.target.value); setPage(0) }} className="appearance-none border border-stone-300 bg-transparent py-3 pl-4 pr-10 text-xs outline-none">{sorts.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select><ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" /></div></div></div>}
          {categoryError && !catalogError && <p role="status" className="mb-4 text-xs text-stone-500">Category navigation is temporarily unavailable; the product collection is still shown below.</p>}
          {catalogError ? <div role="alert" className="my-10 border border-[#d9aaa0] bg-[#fbf1ee] px-5 py-6 text-center"><p className="font-display text-xl">We couldn’t load the collection</p><p className="mt-2 text-sm text-stone-600">{catalogError}</p><button onClick={() => { setCatalogError(''); setCategoryError(''); setCatalogReload((current) => current + 1) }} className="mt-4 border-b border-ink pb-1 text-xs uppercase tracking-widest">Try again</button></div>
          : loading ? <div aria-live="polite" className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">{Array.from({ length: 10 }, (_, index) => <div key={index} className="animate-pulse"><div className="aspect-square bg-[#f1ece6]" /><div className="mt-3 h-3 w-1/3 bg-[#f1ece6]" /><div className="mt-2 h-4 w-3/4 bg-[#f1ece6]" /></div>)}</div>
          : products.length ? <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-4 lg:gap-x-5 xl:grid-cols-5 xl:gap-x-5 xl:gap-y-10">{products.map((product) => { const inBag = basket.items.find((item) => item.variantId === product.variantId)?.quantity ?? 0; const unavailable = product.stock <= inBag; return <article key={`${product.id}-${product.variantId}`} className="group min-w-0"><div className="relative aspect-square overflow-hidden bg-[#eee9df]"><button onClick={() => openProduct(product)} aria-label={`View ${product.name}`} className="absolute inset-0 z-[1] cursor-pointer"><ProductPhoto src={imageUrl(product.imageUrl)} alt={product.name} className="pointer-events-none absolute left-1/2 top-1/2 h-[95%] w-[95%] -translate-x-1/2 -translate-y-1/2 object-cover transition duration-500 group-hover:scale-[1.05]" unavailableLabel={product.imageUrl ? 'Photo unavailable' : 'No photo linked'} /></button>{product.tag && <span className="pointer-events-none absolute left-3 top-3 z-[2] bg-[#fffdfa] px-2.5 py-1.5 text-[8px] font-medium tracking-[.14em]">{product.tag}</span>}<button onClick={() => void addToBag(product)} disabled={basketLoading || unavailable} className="absolute bottom-0 left-0 right-0 z-[3] translate-y-0 bg-[#293c35]/95 py-3 text-[9px] uppercase tracking-[.18em] text-white opacity-0 transition duration-300 group-hover:opacity-100 focus:opacity-100 disabled:cursor-not-allowed disabled:bg-stone-400 disabled:opacity-100">{product.stock <= 0 ? 'Out of stock' : unavailable ? 'In your bag' : `Add to bag — ${money(product.priceMinor)}`}</button></div><button onClick={() => openProduct(product)} className="block w-full bg-white px-3.5 pb-4 pt-3 text-left shadow-[0_3px_16px_rgba(45,38,31,.06)] transition group-hover:shadow-[0_8px_24px_rgba(45,38,31,.1)]"><p className="truncate text-[9px] font-medium uppercase tracking-[.16em] text-[#8f6559]">{product.brand}</p><p className="mt-1 truncate text-[9px] uppercase tracking-[.12em] text-stone-500">{product.category || 'Beauty'}</p><h2 className="mt-2 line-clamp-2 min-h-[2.75rem] text-sm font-medium leading-5 text-stone-900 sm:text-[15px]">{product.name}</h2><div className="mt-3 flex items-baseline justify-between border-t border-stone-100 pt-3"><span className="text-[9px] uppercase tracking-[.14em] text-stone-500">Price</span><span className="text-base font-semibold tabular-nums text-stone-900">{money(product.priceMinor)}</span></div></button><button onClick={() => void addToBag(product)} disabled={basketLoading || unavailable} className="mt-2 w-full border border-stone-300 py-2.5 text-[9px] uppercase tracking-[.14em] transition hover:border-[#293c35] hover:bg-[#293c35] hover:text-white disabled:opacity-50 sm:hidden">{product.stock <= 0 ? 'Out of stock' : 'Add to bag'}</button></article>})}</div>
          : <div className="py-16 text-center"><p className="font-display text-2xl">{debouncedQuery ? 'Nothing found just yet' : 'No active products found'}</p><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-stone-500">{debouncedQuery ? 'Try another search or category.' : 'The shop only lists products that are active and have an active variant with an inventory record. Check those settings in the Admin studio.'}</p>{(category || query) && <button onClick={() => { setCategory(''); setQuery('') }} className="mt-5 border-b border-ink pb-1 text-xs uppercase tracking-widest">Clear filters</button>}</div>}
          {!catalogError && !loading && pages > 1 && <nav aria-label="Product pages" className="mt-12 flex items-center justify-center gap-5"><button disabled={page === 0} onClick={() => { setPage((current) => Math.max(0, current - 1)); document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' }) }} className="border border-stone-300 px-4 py-3 text-[10px] uppercase tracking-widest disabled:opacity-40">Previous</button><span className="text-xs text-stone-600">Page {page + 1} of {pages}</span><button disabled={page + 1 >= pages} onClick={() => { setPage((current) => current + 1); document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' }) }} className="border border-stone-300 px-4 py-3 text-[10px] uppercase tracking-widest disabled:opacity-40">Next</button></nav>}
        </section>
      </main>}

      <footer className="bg-[#f7f2eb] px-5 py-10 sm:px-10"><div className="mx-auto grid max-w-[1280px] grid-cols-2 gap-9 lg:grid-cols-4"><div className="col-span-2 lg:col-span-1"><span className="font-display text-2xl tracking-[.12em]">BOUTIQUE</span><span className="ml-2 text-[9px] uppercase tracking-[.24em] text-[#8f6559]">Beauty Retail</span><p className="mt-3 max-w-xs text-xs leading-5 text-stone-600">Beauty for the everyday. A considered collection of things that make you feel a little more like you.</p></div><div><h3 className="text-[10px] uppercase tracking-[.18em]">Here to help</h3><ul className="mt-4 space-y-3">{footerHelpLinks.map((link) => <li key={`${link.label}-${link.displayOrder}`}><a href={link.url} onClick={(event) => followFooterUrl(event, link.url)} className="text-xs text-stone-600 hover:text-ink">{link.label}</a></li>)}</ul></div>{footerPageGroups.map(([group, groupPages]) => <div key={group}><h3 className="text-[10px] uppercase tracking-[.18em]">{group.replace(/[_-]+/g, ' ')}</h3><ul className="mt-4 space-y-3">{groupPages.map((page) => <li key={page.id}><a href={`/pages/${page.slug}`} onClick={(event) => followFooterUrl(event, `/pages/${page.slug}`)} className="text-xs text-stone-600 hover:text-ink">{page.title}</a></li>)}</ul></div>)}<div><h3 className="text-[10px] uppercase tracking-[.18em]">Contact</h3><dl className="mt-4 space-y-3 text-xs text-stone-600"><div><dt className="text-[9px] uppercase tracking-[.12em] text-stone-500">Website</dt><dd className="mt-1"><a href={storefront?.websiteUrl || 'https://boutiquebeautyretail.com'} className="break-all hover:text-ink">{storefront?.websiteUrl?.replace(/^https?:\/\//, '') || 'boutiquebeautyretail.com'}</a></dd></div><div><dt className="text-[9px] uppercase tracking-[.12em] text-stone-500">Email</dt><dd className="mt-1">{storefront?.customerEmail ? <a href={`mailto:${storefront.customerEmail}`} className="break-all hover:text-ink">{storefront.customerEmail}</a> : <span className="text-stone-400">Set in Admin studio</span>}</dd></div><div><dt className="text-[9px] uppercase tracking-[.12em] text-stone-500">Address</dt><dd className="mt-1 whitespace-pre-line">{storefront?.postalAddress || <span className="text-stone-400">Set in Admin studio</span>}</dd></div></dl></div></div><div className="mx-auto mt-10 max-w-[1280px] border-t border-stone-300 pt-5 text-[9px] uppercase tracking-[.12em] text-stone-500">© 2026 Boutique Beauty Retail · boutiquebeautyretail.com</div></footer>
      </>}

      {authOpen && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setAuthOpen(false) }}><section role="dialog" aria-modal="true" aria-labelledby="auth-title" className="relative w-full max-w-md bg-[#fffdfa] p-6 shadow-xl sm:p-9"><button onClick={() => setAuthOpen(false)} aria-label="Close account dialog" className="absolute right-4 top-4 p-2"><X size={19} /></button><><p className="text-[10px] uppercase tracking-[.18em] text-[#a45f50]">Welcome to Boutique Beauty Retail</p><h2 id="auth-title" className="mt-2 font-display text-3xl">{authMode === 'login' ? 'Good to see you.' : 'Let’s get acquainted.'}</h2><p className="mt-2 text-sm text-stone-600">{authMode === 'login' ? 'Sign in to see your bag and keep your favourites close.' : 'Create an account to start building your beauty routine.'}</p>{authMessage && <p role={authMessageIsError ? 'alert' : 'status'} className={`mt-4 border px-3 py-2 text-xs leading-5 ${authMessageIsError ? 'border-[#d9aaa0] bg-[#fbf1ee] text-[#8c443b]' : 'border-[#b8c8be] bg-[#edf4ef] text-[#355444]'}`}>{authMessage}</p>}<form onSubmit={handleAuth} className="mt-6 space-y-4">{authMode === 'register' && <div className="grid grid-cols-2 gap-3"><input required name="firstName" autoComplete="given-name" placeholder="First name" maxLength={80} className="w-full border border-stone-300 px-3 py-3 text-sm outline-none focus:border-ink" /><input required name="lastName" autoComplete="family-name" placeholder="Last name" maxLength={80} className="w-full border border-stone-300 px-3 py-3 text-sm outline-none focus:border-ink" /></div>}<input required type="email" name="email" autoComplete="email" placeholder="Email address" maxLength={254} className="w-full border border-stone-300 px-3 py-3 text-sm outline-none focus:border-ink" /><input required type="password" name="password" autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} placeholder="Password" minLength={authMode === 'register' ? 8 : undefined} maxLength={72} className="w-full border border-stone-300 px-3 py-3 text-sm outline-none focus:border-ink" />{authMode === 'register' && <p className="text-[11px] leading-5 text-stone-500">Please use at least 8 characters for your password.</p>}<button disabled={authBusy} className="w-full bg-[#293c35] py-3.5 text-xs uppercase tracking-[.15em] text-white disabled:opacity-60">{authBusy ? 'Please wait…' : authMode === 'login' ? 'Sign in' : 'Create account'}</button></form><p className="mt-5 text-center text-xs text-stone-600">{authMode === 'login' ? 'New here?' : 'Already have an account?'} <button onClick={() => { setAuthMessage(''); setAuthMode(authMode === 'login' ? 'register' : 'login') }} className="underline underline-offset-4">{authMode === 'login' ? 'Create an account' : 'Sign in'}</button></p></></section></div>}

      {bagOpen && <div className="fixed inset-0 z-[70] bg-black/40" onMouseDown={(event) => { if (event.target === event.currentTarget) setBagOpen(false) }}><aside role="dialog" aria-modal="true" aria-labelledby="bag-title" className="absolute bottom-0 right-0 top-0 flex w-full max-w-md flex-col bg-[#fffdfa] shadow-xl"><div className="flex items-center justify-between border-b border-stone-200 px-6 py-5"><div><p className="text-[9px] uppercase tracking-[.18em] text-[#a45f50]">Your edit</p><h2 id="bag-title" className="mt-1 font-display text-2xl">Your bag ({itemCount})</h2></div><button onClick={() => setBagOpen(false)} aria-label="Close bag" className="p-2"><X size={20} /></button></div><div className="flex-1 overflow-y-auto px-6 py-5">{basketError && <p role="alert" className="mb-4 bg-[#fbf1ee] p-3 text-xs text-[#8c443b]">{basketError}</p>}{basketLoading && <p className="mb-4 text-xs text-stone-500">Updating your bag…</p>}{basket.items.length ? <ul className="space-y-5">{basket.items.map((item) => <li key={item.variantId} className="flex gap-4 border-b border-stone-200 pb-5"><ProductPhoto src={imageUrl(item.imageUrl)} alt={item.name} unavailableLabel={item.imageUrl ? 'Photo unavailable' : 'No photo linked'} className="h-24 w-20 shrink-0 bg-[#eee9df] object-cover" /><div className="flex min-w-0 flex-1 flex-col"><p className="text-[9px] uppercase tracking-[.14em] text-stone-500">{item.brand}</p><h3 className="mt-1 text-sm">{item.name}</h3>{item.optionValue && <p className="mt-1 text-xs text-stone-500">{item.optionName}: {item.optionValue}</p>}<div className="mt-auto flex items-end justify-between pt-3"><span className="text-xs">Qty {item.quantity} · {money(item.priceMinor)}</span><button onClick={() => void removeFromBag(item.variantId)} className="text-[9px] uppercase tracking-widest underline underline-offset-4">Remove</button></div></div></li>)}</ul> : !basketLoading && <div className="py-16 text-center"><ShoppingBag size={26} className="mx-auto text-stone-400" strokeWidth={1.3} /><p className="mt-4 font-display text-xl">Your bag is taking a breather</p><p className="mt-2 text-sm text-stone-500">Add something lovely to get started.</p></div>}</div><div className="border-t border-stone-200 px-6 py-5"><div className="flex justify-between text-sm"><span>Subtotal</span><span>{money(basket.subtotalMinor)}</span></div><p className="mt-2 text-[11px] text-stone-500">Shipping and checkout will be available in a later update.</p><button disabled className="mt-5 w-full bg-[#293c35] py-4 text-[10px] uppercase tracking-[.17em] text-white opacity-50">Checkout coming soon</button></div></aside></div>}
      {notice && <div role="status" className={`fixed bottom-5 left-1/2 z-[90] -translate-x-1/2 px-5 py-3 text-xs text-white shadow-xl ${noticeError ? 'bg-[#8c443b]' : 'bg-[#293c35]'}`}>{notice}</div>}
    </div>
  )
}

export default App
