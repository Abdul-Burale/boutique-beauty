import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowRight, ChevronDown, Heart, Menu, Search, ShoppingBag, SlidersHorizontal, UserRound, X } from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import { api, type Basket, type Category, type Customer, type Product } from './lib/api'
import { supabase } from './lib/supabase'

const fallbackImages = [
  'photo-1608248543803-ba4f8c70ae0b', 'photo-1601049541289-9b1b7bbbfe19', 'photo-1556229010-6c3f2c9ca5f8',
  'photo-1556228720-195a672e8a03', 'photo-1600428853876-fb5a850b444f', 'photo-1570194065650-d99fb4bedf0a',
]
const imageUrl = (image: string | null, index: number) => image || `https://images.unsplash.com/${fallbackImages[index % fallbackImages.length]}?auto=format&fit=crop&w=900&q=85`
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
  const [category, setCategory] = useState('')
  const [sort, setSort] = useState('featured')
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [page, setPage] = useState(0)
  const [products, setProducts] = useState<Product[]>([])
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
  const [bagOpen, setBagOpen] = useState(false)
  const [mobileMenu, setMobileMenu] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [notice, setNotice] = useState('')
  const [noticeError, setNoticeError] = useState(false)
  const [authBusy, setAuthBusy] = useState(false)
  const [newsletterBusy, setNewsletterBusy] = useState(false)
  const [newsletterMessage, setNewsletterMessage] = useState('')

  useEffect(() => {
    const timer = window.setTimeout(() => { setDebouncedQuery(query.trim()); setPage(0) }, 300)
    return () => window.clearTimeout(timer)
  }, [query])

  useEffect(() => {
    let active = true
    api.categories().then((result) => { if (active) { setCategories(result); setCategoryError('') } }).catch((error: Error) => { if (active) setCategoryError(error.message) })
    return () => { active = false }
  }, [catalogReload])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setCatalogError('')
    api.products({ page, size: 24, q: debouncedQuery, category, sort }, controller.signal)
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
      setBasket(await api.basket())
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

  const addToBag = async (product: Product) => {
    if (!customer) { setAuthMode('login'); setAuthOpen(true); showNotice('Sign in or create an account to add items to your bag', true); return }
    const existing = basket.items.find((item) => item.variantId === product.variantId)
    setBasketLoading(true); setBasketError('')
    try {
      setBasket(await api.putBasketLine(product.variantId, (existing?.quantity ?? 0) + 1))
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
    setCustomer(null); setBasket({ items: [], subtotalMinor: 0, currency: 'GBP' }); setAuthOpen(false); showNotice('You are signed out')
  }

  const submitNewsletter = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setNewsletterBusy(true); setNewsletterMessage('')
    const form = new FormData(event.currentTarget)
    try { await api.subscribe(String(form.get('email'))); setNewsletterMessage('You’re on the list. Thanks for joining us!'); event.currentTarget.reset() }
    catch (error) { setNewsletterMessage((error as Error).message) }
    finally { setNewsletterBusy(false) }
  }

  const navLinks = ['New & noteworthy', 'Skincare', 'Makeup', 'Bath & body', 'Brands', 'Our journal']

  return (
    <div className="min-h-screen bg-[#fffdfa] text-ink">
      <div className="bg-[#293c35] px-4 py-2 text-center text-[10px] font-medium uppercase tracking-[.19em] text-white sm:text-xs">A little something lovely: complimentary delivery over £45</div>
      <div className="bg-[#f4e6df] px-4 py-2 text-center text-xs tracking-wide text-[#60463f]">Meet your new everyday ritual — explore our edit <ArrowRight className="ml-1 inline" size={13} /></div>

      <header className="sticky top-0 z-40 border-b border-black/5 bg-[#fffdfa]/95 backdrop-blur">
        <div className="mx-auto flex h-[76px] max-w-[1440px] items-center justify-between px-4 sm:px-8 lg:px-12">
          <div className="flex items-center gap-3 lg:hidden"><button aria-label="Open menu" onClick={() => setMobileMenu(!mobileMenu)} className="p-2"><Menu size={21} strokeWidth={1.5} /></button><button aria-label="Search" onClick={() => setShowSearch(!showSearch)} className="p-2"><Search size={20} strokeWidth={1.5} /></button></div>
          <a href="#top" aria-label="Boutique Beauty Retail home" className="absolute left-1/2 flex -translate-x-1/2 flex-col items-center leading-none lg:static lg:translate-x-0 lg:items-start"><span className="font-display text-[21px] tracking-[.12em] sm:text-[25px]">BOUTIQUE</span><span className="mt-1 text-[8px] font-medium uppercase tracking-[.34em] text-[#8f6559] sm:text-[9px]">Beauty Retail</span></a>
          <div className="hidden max-w-[470px] flex-1 px-8 lg:block"><label className="flex h-11 items-center border-b border-stone-300 text-stone-500 focus-within:border-ink"><Search size={18} strokeWidth={1.5} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search your next favourite" className="w-full bg-transparent px-3 text-sm outline-none placeholder:text-stone-400" />{query && <button onClick={() => setQuery('')} aria-label="Clear search"><X size={16} /></button>}</label></div>
          <div className="flex items-center gap-1 sm:gap-4"><button aria-label={customer ? 'Account settings' : 'Sign in'} onClick={() => setAuthOpen(true)} className="p-2"><UserRound size={21} strokeWidth={1.5} /><span className="sr-only">{customer ? customer.firstName : 'Sign in'}</span></button><button aria-label="Saved products" className="hidden p-2 sm:block"><Heart size={21} strokeWidth={1.5} /></button><button aria-label={`Shopping bag, ${itemCount} items`} onClick={() => { if (!customer) { setAuthMode('login'); setAuthOpen(true) } else { setBagOpen(true); void refreshBasket() } }} className="relative flex items-center gap-2 p-2"><ShoppingBag size={21} strokeWidth={1.5} /><span className="hidden text-xs uppercase tracking-[.12em] sm:block">Bag</span><span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#293c35] px-1 text-[9px] text-white">{itemCount}</span></button></div>
        </div>
        <nav className="hidden h-11 items-center justify-center gap-10 border-t border-black/5 lg:flex" aria-label="Main navigation">{navLinks.map((item) => <button key={item} className={`group flex h-full items-center gap-1 text-[11px] uppercase tracking-[.16em] hover:text-[#a45f50] ${item === 'Skincare' ? 'text-[#a45f50]' : ''}`}>{item}{['Skincare', 'Makeup', 'Bath & body'].includes(item) && <ChevronDown size={13} />}</button>)}</nav>
        {showSearch && <div className="border-t border-stone-200 px-5 py-3 lg:hidden"><input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search your next favourite" className="w-full bg-transparent py-2 outline-none" /></div>}
        {mobileMenu && <nav className="absolute left-0 right-0 top-full border-t border-stone-200 bg-[#fffdfa] px-6 py-4 shadow-lg lg:hidden">{navLinks.map((item) => <button onClick={() => setMobileMenu(false)} key={item} className="block w-full border-b border-stone-100 py-4 text-left text-xs uppercase tracking-[.16em]">{item}</button>)}</nav>}
      </header>

      <main id="top">
        <section className="relative mx-auto max-w-[1440px] px-4 pb-0 pt-5 sm:px-8 lg:px-12"><div className="mb-5 flex items-center gap-2 text-[10px] uppercase tracking-[.14em] text-stone-500"><span>Home</span><span>/</span><span>Skincare</span><span>/</span><span className="text-ink">{selectedCategory?.name || 'Shop all'}</span></div></section>
        <section id="products" className="mx-auto max-w-[1440px] px-4 pb-20 pt-8 sm:px-8 lg:px-12">
          <div className="flex flex-col justify-between gap-5 border-b border-stone-200 pb-6 sm:flex-row sm:items-end"><div><p className="mb-2 text-[10px] uppercase tracking-[.2em] text-[#a45f50]">Your shelf, refreshed</p><h1 className="font-display text-3xl sm:text-4xl">Shop {selectedCategory?.name || 'skincare'}</h1><p className="mt-2 text-xs text-stone-500">A little care goes a long way.</p></div><div className="flex items-center gap-3 text-xs"><label htmlFor="sort" className="hidden text-stone-500 sm:block">Sort by</label><div className="relative"><select id="sort" value={sort} onChange={(e) => { setSort(e.target.value); setPage(0) }} className="appearance-none border border-stone-300 bg-transparent py-3 pl-4 pr-10 text-xs outline-none">{sorts.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select><ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" /></div><button className="flex items-center gap-2 border border-stone-300 px-4 py-3 text-xs lg:hidden"><SlidersHorizontal size={14} /> Filter</button></div></div>
          <div className="flex gap-2 overflow-x-auto py-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"><button onClick={() => { setCategory(''); setPage(0) }} className={`shrink-0 rounded-full border px-4 py-2.5 text-[10px] uppercase tracking-[.12em] transition ${!category ? 'border-[#293c35] bg-[#293c35] text-white' : 'border-stone-300 text-stone-600 hover:border-ink'}`}>All products</button>{categories.map((item) => <button key={item.id} onClick={() => { setCategory(item.slug); setPage(0) }} className={`shrink-0 rounded-full border px-4 py-2.5 text-[10px] uppercase tracking-[.12em] transition ${category === item.slug ? 'border-[#293c35] bg-[#293c35] text-white' : 'border-stone-300 text-stone-600 hover:border-ink'}`}>{item.name}</button>)}</div>
          <div className="mb-5 flex items-center justify-between text-[11px] text-stone-500"><span>{loading ? 'Finding your favourites…' : `${total} thoughtfully chosen ${total === 1 ? 'piece' : 'pieces'}`}</span><button className="hidden items-center gap-2 uppercase tracking-[.13em] lg:flex"><SlidersHorizontal size={14} /> Filter & sort</button></div>
          {catalogError || categoryError ? <div role="alert" className="my-10 border border-[#d9aaa0] bg-[#fbf1ee] px-5 py-6 text-center"><p className="font-display text-xl">We couldn’t load the collection</p><p className="mt-2 text-sm text-stone-600">{catalogError || categoryError}</p><button onClick={() => { setCatalogError(''); setCategoryError(''); setCatalogReload((current) => current + 1) }} className="mt-4 border-b border-ink pb-1 text-xs uppercase tracking-widest">Try again</button></div>
          : loading ? <div aria-live="polite" className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">{Array.from({ length: 8 }, (_, index) => <div key={index} className="animate-pulse"><div className="aspect-[.84] bg-[#f1ece6]" /><div className="mt-3 h-3 w-1/3 bg-[#f1ece6]" /><div className="mt-2 h-4 w-3/4 bg-[#f1ece6]" /></div>)}</div>
          : products.length ? <div className="grid grid-cols-2 gap-x-3 gap-y-9 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-4 lg:gap-x-6 lg:gap-y-12">{products.map((product, index) => <article key={`${product.id}-${product.variantId}`} className="group min-w-0"><div className="relative aspect-[.84] overflow-hidden bg-[#eee9df]"><img src={imageUrl(product.imageUrl, index)} alt={product.name} loading="lazy" className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]" />{product.tag && <span className="absolute left-3 top-3 bg-[#fffdfa] px-2.5 py-1.5 text-[8px] font-medium tracking-[.14em]">{product.tag}</span>}<button onClick={() => showNotice('Sign in to save your favourites', true)} aria-label="Save product" className="absolute right-3 top-3 rounded-full bg-[#fffdfa]/90 p-2.5 transition hover:bg-white"><Heart size={17} strokeWidth={1.5} /></button><button onClick={() => void addToBag(product)} disabled={basketLoading} className="absolute bottom-0 left-0 right-0 translate-y-full bg-[#293c35] py-3 text-[9px] uppercase tracking-[.18em] text-white transition-transform duration-300 group-hover:translate-y-0 focus:translate-y-0 disabled:opacity-60">Add to bag — {money(product.priceMinor)}</button></div><div className="pt-3"><p className="text-[9px] uppercase tracking-[.17em] text-stone-500">{product.brand}</p><h2 className="mt-1.5 text-xs leading-5 sm:text-sm">{product.name}</h2><p className="mt-2 text-xs">{money(product.priceMinor)}</p><button onClick={() => void addToBag(product)} disabled={basketLoading} className="mt-3 w-full border border-stone-300 py-2.5 text-[9px] uppercase tracking-[.14em] transition hover:border-[#293c35] hover:bg-[#293c35] hover:text-white disabled:opacity-60 sm:hidden">Add to bag</button></div></article>)}</div>
          : <div className="py-16 text-center"><p className="font-display text-2xl">{debouncedQuery ? 'Nothing found just yet' : 'The shelves are being restocked'}</p><p className="mt-2 text-sm text-stone-500">{debouncedQuery ? 'Try another search or category.' : 'Please check back shortly.'}</p>{(category || query) && <button onClick={() => { setCategory(''); setQuery('') }} className="mt-5 border-b border-ink pb-1 text-xs uppercase tracking-widest">Clear filters</button>}</div>}
          {!catalogError && !loading && pages > 1 && <nav aria-label="Product pages" className="mt-12 flex items-center justify-center gap-5"><button disabled={page === 0} onClick={() => { setPage((current) => Math.max(0, current - 1)); document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' }) }} className="border border-stone-300 px-4 py-3 text-[10px] uppercase tracking-widest disabled:opacity-40">Previous</button><span className="text-xs text-stone-600">Page {page + 1} of {pages}</span><button disabled={page + 1 >= pages} onClick={() => { setPage((current) => current + 1); document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' }) }} className="border border-stone-300 px-4 py-3 text-[10px] uppercase tracking-widest disabled:opacity-40">Next</button></nav>}
        </section>
        <section className="bg-[#293c35] px-5 py-12 text-center text-white sm:py-16"><p className="text-[9px] uppercase tracking-[.24em] text-[#d5b6a7]">Boutique Beauty Retail notes</p><h2 className="mt-3 font-display text-3xl sm:text-4xl">A softer kind of self-care.</h2><p className="mx-auto mt-3 max-w-md text-sm leading-6 text-white/70">New rituals, thoughtful recommendations and the occasional little treat. Delivered with love.</p><form onSubmit={submitNewsletter} className="mx-auto mt-6 flex max-w-md border-b border-white/50"><input required type="email" name="email" placeholder="Your email address" className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none placeholder:text-white/60" /><button disabled={newsletterBusy} className="px-2 text-[9px] uppercase tracking-[.16em] disabled:opacity-60">{newsletterBusy ? 'Joining…' : 'Sign me up'} <ArrowRight size={14} className="ml-1 inline" /></button></form>{newsletterMessage && <p role="status" className="mt-3 text-xs text-white/80">{newsletterMessage}</p>}</section>
      </main>

      <footer className="bg-[#f7f2eb] px-5 py-10 sm:px-10"><div className="mx-auto grid max-w-[1280px] gap-9 sm:grid-cols-2 lg:grid-cols-4"><div><span className="font-display text-2xl tracking-[.12em]">BOUTIQUE</span><span className="ml-2 text-[9px] uppercase tracking-[.24em] text-[#8f6559]">Beauty Retail</span><p className="mt-3 max-w-xs text-xs leading-5 text-stone-600">Beauty for the everyday. A considered collection of things that make you feel a little more like you.</p></div>{[['Explore', 'New in', 'Skincare', 'Makeup', 'Bath & body'], ['Here to help', 'Contact us', 'Delivery & returns', 'FAQs', 'Find your order'], ['Find us', 'Instagram', 'TikTok', 'Pinterest', 'Our journal']].map(([title, ...links]) => <div key={title}><h3 className="text-[10px] uppercase tracking-[.18em]">{title}</h3><ul className="mt-4 space-y-3">{links.map((link) => <li key={link}><a href="#products" className="text-xs text-stone-600 hover:text-ink">{link}</a></li>)}</ul></div>)}</div><div className="mx-auto mt-10 max-w-[1280px] border-t border-stone-300 pt-5 text-[9px] uppercase tracking-[.12em] text-stone-500">© 2026 Boutique Beauty Retail · boutiquebeautyretail.com</div></footer>

      {authOpen && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setAuthOpen(false) }}><section role="dialog" aria-modal="true" aria-labelledby="auth-title" className="relative w-full max-w-md bg-[#fffdfa] p-6 shadow-xl sm:p-9"><button onClick={() => setAuthOpen(false)} aria-label="Close account dialog" className="absolute right-4 top-4 p-2"><X size={19} /></button>{customer ? <><p className="text-[10px] uppercase tracking-[.18em] text-[#a45f50]">Your account</p><h2 id="auth-title" className="mt-2 font-display text-3xl">Hello, {customer.firstName}</h2><p className="mt-3 text-sm text-stone-600">{customer.email}</p><button onClick={() => void logout()} className="mt-7 w-full bg-[#293c35] py-3 text-xs uppercase tracking-[.15em] text-white">Sign out</button></> : <><p className="text-[10px] uppercase tracking-[.18em] text-[#a45f50]">Welcome to Boutique Beauty Retail</p><h2 id="auth-title" className="mt-2 font-display text-3xl">{authMode === 'login' ? 'Good to see you.' : 'Let’s get acquainted.'}</h2><p className="mt-2 text-sm text-stone-600">{authMode === 'login' ? 'Sign in to see your bag and keep your favourites close.' : 'Create an account to start building your beauty routine.'}</p>{authMessage && <p role={authMessageIsError ? 'alert' : 'status'} className={`mt-4 border px-3 py-2 text-xs leading-5 ${authMessageIsError ? 'border-[#d9aaa0] bg-[#fbf1ee] text-[#8c443b]' : 'border-[#b8c8be] bg-[#edf4ef] text-[#355444]'}`}>{authMessage}</p>}<form onSubmit={handleAuth} className="mt-6 space-y-4">{authMode === 'register' && <div className="grid grid-cols-2 gap-3"><input required name="firstName" autoComplete="given-name" placeholder="First name" maxLength={80} className="w-full border border-stone-300 px-3 py-3 text-sm outline-none focus:border-ink" /><input required name="lastName" autoComplete="family-name" placeholder="Last name" maxLength={80} className="w-full border border-stone-300 px-3 py-3 text-sm outline-none focus:border-ink" /></div>}<input required type="email" name="email" autoComplete="email" placeholder="Email address" maxLength={254} className="w-full border border-stone-300 px-3 py-3 text-sm outline-none focus:border-ink" /><input required type="password" name="password" autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} placeholder="Password" minLength={authMode === 'register' ? 12 : undefined} maxLength={72} className="w-full border border-stone-300 px-3 py-3 text-sm outline-none focus:border-ink" />{authMode === 'register' && <p className="text-[11px] leading-5 text-stone-500">Please use at least 12 characters for your password.</p>}<button disabled={authBusy} className="w-full bg-[#293c35] py-3.5 text-xs uppercase tracking-[.15em] text-white disabled:opacity-60">{authBusy ? 'Please wait…' : authMode === 'login' ? 'Sign in' : 'Create account'}</button></form><p className="mt-5 text-center text-xs text-stone-600">{authMode === 'login' ? 'New here?' : 'Already have an account?'} <button onClick={() => { setAuthMessage(''); setAuthMode(authMode === 'login' ? 'register' : 'login') }} className="underline underline-offset-4">{authMode === 'login' ? 'Create an account' : 'Sign in'}</button></p></>}</section></div>}

      {bagOpen && <div className="fixed inset-0 z-[70] bg-black/40" onMouseDown={(event) => { if (event.target === event.currentTarget) setBagOpen(false) }}><aside role="dialog" aria-modal="true" aria-labelledby="bag-title" className="absolute bottom-0 right-0 top-0 flex w-full max-w-md flex-col bg-[#fffdfa] shadow-xl"><div className="flex items-center justify-between border-b border-stone-200 px-6 py-5"><div><p className="text-[9px] uppercase tracking-[.18em] text-[#a45f50]">Your edit</p><h2 id="bag-title" className="mt-1 font-display text-2xl">Your bag ({itemCount})</h2></div><button onClick={() => setBagOpen(false)} aria-label="Close bag" className="p-2"><X size={20} /></button></div><div className="flex-1 overflow-y-auto px-6 py-5">{basketError && <p role="alert" className="mb-4 bg-[#fbf1ee] p-3 text-xs text-[#8c443b]">{basketError}</p>}{basketLoading && <p className="mb-4 text-xs text-stone-500">Updating your bag…</p>}{basket.items.length ? <ul className="space-y-5">{basket.items.map((item, index) => <li key={item.variantId} className="flex gap-4 border-b border-stone-200 pb-5"><img src={imageUrl(item.imageUrl, index)} alt="" className="h-24 w-20 bg-[#eee9df] object-cover" /><div className="flex min-w-0 flex-1 flex-col"><p className="text-[9px] uppercase tracking-[.14em] text-stone-500">{item.brand}</p><h3 className="mt-1 text-sm">{item.name}</h3>{item.optionValue && <p className="mt-1 text-xs text-stone-500">{item.optionName}: {item.optionValue}</p>}<div className="mt-auto flex items-end justify-between pt-3"><span className="text-xs">Qty {item.quantity} · {money(item.priceMinor)}</span><button onClick={() => void removeFromBag(item.variantId)} className="text-[9px] uppercase tracking-widest underline underline-offset-4">Remove</button></div></div></li>)}</ul> : !basketLoading && <div className="py-16 text-center"><ShoppingBag size={26} className="mx-auto text-stone-400" strokeWidth={1.3} /><p className="mt-4 font-display text-xl">Your bag is taking a breather</p><p className="mt-2 text-sm text-stone-500">Add something lovely to get started.</p></div>}</div><div className="border-t border-stone-200 px-6 py-5"><div className="flex justify-between text-sm"><span>Subtotal</span><span>{money(basket.subtotalMinor)}</span></div><p className="mt-2 text-[11px] text-stone-500">Shipping and checkout will be available in a later update.</p><button disabled className="mt-5 w-full bg-[#293c35] py-4 text-[10px] uppercase tracking-[.17em] text-white opacity-50">Checkout coming soon</button></div></aside></div>}
      {notice && <div role="status" className={`fixed bottom-5 left-1/2 z-[90] -translate-x-1/2 px-5 py-3 text-xs text-white shadow-xl ${noticeError ? 'bg-[#8c443b]' : 'bg-[#293c35]'}`}>{notice}</div>}
    </div>
  )
}

export default App
