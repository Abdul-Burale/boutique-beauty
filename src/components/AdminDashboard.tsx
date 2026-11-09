import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowLeft, ImagePlus, PackagePlus, RefreshCw, Search, X } from 'lucide-react'
import { api, type AdminOrder, type AdminProduct, type Category } from '../lib/api'
import { supabase } from '../lib/supabase'
import ProductPhoto from './ProductPhoto'
import AdminContentManager from './AdminContentManager'

type Props = { categories: Category[]; onExit: () => void }
type Tab = 'products' | 'orders' | 'content'
type ProductDraft = { brand: string; name: string; slug: string; description: string; ingredients: string; imageUrl: string; tag: string; categoryId: string; price: string; sku: string; optionName: string; optionValue: string; stock: string }
type ProductGroup = { product: AdminProduct; variants: AdminProduct[] }
const emptyDraft = (): ProductDraft => ({ brand: '', name: '', slug: '', description: '', ingredients: '', imageUrl: '', tag: '', categoryId: '', price: '', sku: '', optionName: '', optionValue: '', stock: '' })
const emptyVariant = () => ({ sku: '', optionName: '', optionValue: '', price: '', stock: '' })
const field = 'w-full border border-stone-300 bg-[#fffdfa] px-3 py-3 text-sm outline-none focus:border-[#293c35]'
function FieldLabel({ children, required = false }: { children: string; required?: boolean }) {
  return <span className="mb-1.5 block text-[10px] uppercase tracking-[.12em] text-stone-600">{children}{required && <><span aria-hidden="true" className="ml-1 text-red-600">*</span><span className="sr-only"> (required)</span></>}</span>
}
const money = (minor: number | null, currency = 'GBP') => minor == null ? '—' : new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(minor / 100)
const slugify = (value: string) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

export default function AdminDashboard({ categories, onExit }: Props) {
  const [tab, setTab] = useState<Tab>('products')
  const [products, setProducts] = useState<AdminProduct[]>([])
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [productPage, setProductPage] = useState(0)
  const [productTotal, setProductTotal] = useState(0)
  const [stockDrafts, setStockDrafts] = useState<Record<number, string>>({})
  const [editing, setEditing] = useState<AdminProduct | null>(null)
  const [draft, setDraft] = useState<ProductDraft>(emptyDraft)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imageUploadState, setImageUploadState] = useState<'idle' | 'selected' | 'uploading' | 'uploaded' | 'failed'>('idle')
  const [variantDraft, setVariantDraft] = useState(emptyVariant)
  const [variantEditingId, setVariantEditingId] = useState<number | null>(null)

  const load = async () => {
    setLoading(true); setError('')
    try {
      if (tab === 'products') {
        const page = await api.adminProducts(productPage, 50)
        setProducts(page.items)
        setProductTotal(page.total)
        setStockDrafts(Object.fromEntries(page.items.filter((p) => p.variantId != null && p.stock != null).map((p) => [p.variantId!, String(p.stock)])))
      } else if (tab === 'orders') setOrders(await api.adminOrders())
    } catch (requestError) { setError((requestError as Error).message) }
    finally { setLoading(false) }
  }

  useEffect(() => { if (tab !== 'content') void load() }, [tab, productPage])

  const productGroups = useMemo(() => {
    const groups = new Map<number, ProductGroup>()
    for (const row of products) {
      const group = groups.get(row.id)
      if (group) group.variants.push(row)
      else groups.set(row.id, { product: row, variants: [row] })
    }
    return [...groups.values()]
  }, [products])

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase()
    return productGroups.filter(({ product, variants }) => {
      const matchesText = !term || [product.name, product.brand, product.slug, ...variants.map((variant) => variant.sku ?? '')].some((value) => value.toLowerCase().includes(term))
      const matchesCategory = !categoryFilter || String(product.categoryId ?? '') === categoryFilter
      return matchesText && matchesCategory
    })
  }, [productGroups, search, categoryFilter])

  const updateDraft = (key: keyof ProductDraft, value: string) => setDraft((current) => ({ ...current, [key]: value }))
  const startCreate = () => { setEditing(null); setDraft(emptyDraft()); setImageFile(null); setImageUploadState('idle'); setError(''); setMessage('') }
  const startEdit = (product: AdminProduct) => {
    setEditing(product); setImageFile(null); setImageUploadState('idle'); setError(''); setMessage('')
    setVariantDraft(emptyVariant())
    setVariantEditingId(null)
    setDraft({ ...emptyDraft(), brand: product.brand, name: product.name, slug: product.slug, description: product.description ?? '', ingredients: product.ingredients ?? '', imageUrl: product.imageUrl ?? '', tag: product.tag ?? '', categoryId: product.categoryId == null ? '' : String(product.categoryId) })
  }

  const saveProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusyId(-1); setError(''); setMessage('')
    const formElement = event.currentTarget
    let imageUrl = draft.imageUrl.trim()
    let uploadCompleted = false
    try {
      if (imageFile) {
        if (!supabase) throw new Error('Image storage is not configured. Set the Supabase frontend environment variables.')
        setImageUploadState('uploading')
        const authorization = await api.requestProductImageUpload(imageFile.type)
        const { error: uploadError } = await supabase.storage.from(authorization.bucket).uploadToSignedUrl(authorization.path, authorization.token, imageFile, { contentType: imageFile.type, cacheControl: '31536000' })
        if (uploadError) throw new Error(`Image upload failed: ${uploadError.message}`)
        imageUrl = authorization.publicUrl
        setDraft((current) => ({ ...current, imageUrl }))
        setImageFile(null)
        uploadCompleted = true
        setImageUploadState('uploaded')
      }
      const name = draft.name.trim()
      const ingredients = draft.ingredients.trim()
      const product = { brand: draft.brand.trim(), name, slug: draft.slug.trim() || slugify(name), description: draft.description.trim(), ...(editing || ingredients ? { ingredients } : {}), imageUrl, tag: draft.tag.trim(), categoryId: draft.categoryId ? Number(draft.categoryId) : null }
      if (editing) {
        await api.updateAdminProduct(editing.id, product)
        setMessage(`${name} updated.`)
      } else {
        await api.createAdminProduct({ ...product, priceMinor: Math.round(Number(draft.price) * 100), sku: draft.sku.trim(), optionName: draft.optionName.trim() || 'Standard', optionValue: draft.optionValue.trim() || 'One size', stock: Number(draft.stock) })
        setMessage(`${name} created.`)
        formElement.reset()
        setDraft(emptyDraft())
      }
      setImageFile(null)
      await load()
    } catch (requestError) { if (imageFile && !uploadCompleted) setImageUploadState('failed'); setError(`${uploadCompleted ? 'Image uploaded, but the product could not be saved. ' : ''}${(requestError as Error).message}`) }
    finally { setBusyId(null) }
  }

  const saveStock = async (product: AdminProduct) => {
    if (product.variantId == null) return
    const quantity = Number(stockDrafts[product.variantId])
    if (!Number.isInteger(quantity) || quantity < 0 || quantity > 1_000_000) { setError('Stock must be a whole number from 0 to 1,000,000.'); return }
    setBusyId(product.variantId); setError(''); setMessage('')
    try { await api.updateInventory(product.variantId, quantity); setMessage(`Stock updated for ${product.name}.`); await load() }
    catch (requestError) { setError((requestError as Error).message) }
    finally { setBusyId(null) }
  }

  const addVariant = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editing) return
    setBusyId(-2); setError(''); setMessage('')
    try {
      const variant = { sku: variantDraft.sku.trim(), optionName: variantDraft.optionName.trim(), optionValue: variantDraft.optionValue.trim(), priceMinor: Math.round(Number(variantDraft.price) * 100) }
      if (variantEditingId != null) {
        await api.updateAdminVariant(editing.id, variantEditingId, variant)
        setMessage(`Variant updated for ${editing.name}.`)
      } else {
        const result = await api.addAdminVariant(editing.id, { ...variant, stock: Number(variantDraft.stock) })
        setMessage(`Variant created for ${editing.name} (variant ${result.variantId}).`)
      }
      setVariantDraft(emptyVariant())
      setVariantEditingId(null)
      await load()
    } catch (requestError) { setError((requestError as Error).message) }
    finally { setBusyId(null) }
  }

  const changeVisibility = async (product: AdminProduct) => {
    const nextActive = !product.active
    if (!nextActive && !window.confirm(`Deactivate ${product.name}? It will no longer appear in the storefront.`)) return
    setBusyId(-3); setError(''); setMessage('')
    try {
      await api.setProductActive(product.id, nextActive)
      setProducts((current) => current.map((item) => item.id === product.id ? { ...item, active: nextActive } : item))
      setMessage(`${product.name} is now ${nextActive ? 'visible' : 'hidden'} in the storefront.`)
    } catch (requestError) { setError((requestError as Error).message) }
    finally { setBusyId(null) }
  }

  const changeOrder = async (order: AdminOrder, status: 'CONFIRMED' | 'CANCELLED' | 'FULFILLED') => {
    if (status === 'CANCELLED' && !window.confirm(`Cancel order #${order.id}? The backend will restore its stock.`)) return
    if (status === 'FULFILLED' && !window.confirm(`Mark order #${order.id} as fulfilled?`)) return
    setBusyId(order.id); setError(''); setMessage('')
    try { await api.updateOrderStatus(order.id, status); setMessage(`Order #${order.id} ${status.toLowerCase()}.`); await load() }
    catch (requestError) { setError((requestError as Error).message) }
    finally { setBusyId(null) }
  }

  return (
    <main className="mx-auto min-h-[70vh] max-w-[1440px] px-4 py-8 sm:px-8 lg:px-12">
      <button onClick={onExit} className="mb-6 inline-flex items-center gap-2 text-[10px] uppercase tracking-[.15em] text-stone-600 hover:text-ink"><ArrowLeft size={15} /> Back to shop</button>
      <div className="flex flex-col justify-between gap-5 border-b border-stone-200 pb-6 sm:flex-row sm:items-end"><div><p className="mb-2 text-[10px] uppercase tracking-[.2em] text-[#a45f50]">Boutique Beauty Retail</p><h1 className="font-display text-4xl">Admin studio</h1><p className="mt-2 text-sm text-stone-500">Manage products, orders, pages and footer details.</p></div>{tab !== 'content' && <button onClick={() => void load()} disabled={loading} className="inline-flex items-center justify-center gap-2 border border-stone-300 px-4 py-3 text-[10px] uppercase tracking-[.14em] disabled:opacity-50"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh</button>}</div>
      <div className="mt-6 flex gap-2 overflow-x-auto border-b border-stone-200"><button onClick={() => setTab('products')} className={`shrink-0 border-b-2 px-4 py-3 text-[10px] uppercase tracking-[.15em] ${tab === 'products' ? 'border-[#293c35] text-ink' : 'border-transparent text-stone-500'}`}>Products</button><button onClick={() => setTab('orders')} className={`shrink-0 border-b-2 px-4 py-3 text-[10px] uppercase tracking-[.15em] ${tab === 'orders' ? 'border-[#293c35] text-ink' : 'border-transparent text-stone-500'}`}>Orders</button><button onClick={() => { setError(''); setMessage(''); setTab('content') }} className={`shrink-0 border-b-2 px-4 py-3 text-[10px] uppercase tracking-[.15em] ${tab === 'content' ? 'border-[#293c35] text-ink' : 'border-transparent text-stone-500'}`}>Pages &amp; footer</button></div>
      {error && <p role="alert" className="mt-5 border border-[#d9aaa0] bg-[#fbf1ee] px-4 py-3 text-sm text-[#8c443b]">{error}</p>}{message && <p role="status" className="mt-5 border border-[#b8c8be] bg-[#edf4ef] px-4 py-3 text-sm text-[#355444]">{message}</p>}

      {tab === 'content' ? <AdminContentManager /> : tab === 'products' ? <div className="grid gap-8 py-7 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,.65fr)]">
        <section className="min-w-0"><div className="mb-4 flex flex-wrap items-end justify-between gap-4"><div><p className="text-[9px] uppercase tracking-[.18em] text-stone-500">Catalogue</p><h2 className="mt-1 font-display text-2xl">Products <span className="font-sans text-sm text-stone-500">({productTotal})</span></h2></div><button type="button" onClick={startCreate} className="inline-flex items-center gap-2 bg-[#293c35] px-4 py-3 text-[10px] uppercase tracking-[.14em] text-white"><PackagePlus size={15} /> New product</button></div>
          <p className="mb-3 text-xs text-stone-500">Search and category filters apply to this page ({products.length} variant rows), not the full catalogue.</p>
          <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_210px]"><label className="flex items-center gap-2 border border-stone-300 px-3"><Search size={16} className="shrink-0 text-stone-500" /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, brand, SKU or slug" className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none" />{search && <button aria-label="Clear search" onClick={() => setSearch('')}><X size={15} /></button>}</label><select aria-label="Filter by category" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className={field}><option value="">All categories</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></div>
          {loading ? <p role="status" className="py-8 text-sm text-stone-500">Loading products…</p> : filteredProducts.length ? <div className="space-y-4">{filteredProducts.map(({ product, variants }) => <article key={product.id} className="border-y border-stone-200 py-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="flex min-w-0 gap-3"><div className="h-16 w-16 shrink-0 overflow-hidden bg-stone-100"><ProductPhoto src={product.imageUrl || ''} alt={product.name} className="h-full w-full object-cover" unavailableLabel={product.imageUrl ? 'Image URL failed' : 'No image URL'} /></div><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-medium">{product.name}</h3><span className={`border px-2 py-1 text-[9px] uppercase tracking-wider ${product.active ? 'border-[#b8c8be] bg-[#edf4ef] text-[#355444]' : 'border-stone-300 bg-stone-100 text-stone-600'}`}>{product.active ? 'Active' : 'Hidden'}</span></div><p className="mt-1 text-[10px] text-stone-500">{product.brand} · {product.slug} · {variants.length} variant{variants.length === 1 ? '' : 's'}</p>{product.imageUrl ? <a href={product.imageUrl} target="_blank" rel="noreferrer" className="mt-1 block max-w-lg truncate text-[10px] text-[#725046] underline" title={product.imageUrl}>Open saved image URL</a> : <p className="mt-1 text-[10px] text-stone-400">No image URL saved on product</p>}</div></div><div className="flex gap-2"><button disabled={busyId === -3} onClick={() => void changeVisibility(product)} className="border border-stone-300 px-3 py-2 text-[9px] uppercase tracking-wider disabled:opacity-50">{product.active ? 'Deactivate' : 'Activate'}</button><button onClick={() => startEdit(product)} className="border border-stone-300 px-3 py-2 text-[9px] uppercase tracking-wider hover:border-[#293c35]">Edit details</button></div></div><div className="mt-3 space-y-2">{variants.map((variant) => <div key={variant.variantId ?? `${variant.id}-none`} className="grid items-center gap-2 bg-[#f8f4ee] p-3 text-xs sm:grid-cols-[minmax(100px,1fr)_90px_100px_160px]"><span><b>{variant.optionName || 'Variant'}:</b> {variant.optionValue || 'Standard'} <span className="text-stone-500">· {variant.sku || 'No SKU'}</span></span><span>{money(variant.priceMinor)}</span><label className="flex items-center gap-2">Stock <input aria-label={`Stock for ${product.name} ${variant.optionValue ?? ''}`} type="number" min="0" max="1000000" value={variant.variantId == null ? '' : stockDrafts[variant.variantId] ?? ''} disabled={variant.variantId == null} onChange={(event) => variant.variantId != null && setStockDrafts((drafts) => ({ ...drafts, [variant.variantId!]: event.target.value }))} className="w-16 border border-stone-300 bg-white px-2 py-2 disabled:bg-stone-100" /></label><div className="flex gap-2"><button disabled={variant.variantId == null || busyId === variant.variantId} onClick={() => void saveStock(variant)} className="border border-stone-300 px-3 py-2 text-[9px] uppercase tracking-wider disabled:opacity-40">Save stock</button><button disabled={variant.variantId == null} onClick={() => { if (variant.variantId == null) return; startEdit(product); setVariantEditingId(variant.variantId); setVariantDraft({ sku: variant.sku ?? '', optionName: variant.optionName ?? '', optionValue: variant.optionValue ?? '', price: variant.priceMinor == null ? '' : (variant.priceMinor / 100).toFixed(2), stock: String(variant.stock ?? 0) }) }} className="border border-stone-300 px-3 py-2 text-[9px] uppercase tracking-wider disabled:opacity-40">Edit variant</button></div></div>)}</div></article>)}</div> : !error && <p className="border border-dashed border-stone-300 py-8 text-center text-sm text-stone-500">{search || categoryFilter ? 'No products on this page match your search or category.' : 'No products yet. Add your first product.'}</p>}
          {!loading && (productTotal > 50 || productPage > 0) && <div className="mt-5 flex items-center justify-between text-xs"><span>Page {productPage + 1} · {productTotal} products total</span><div className="flex gap-2"><button disabled={productPage === 0} onClick={() => setProductPage((page) => Math.max(0, page - 1))} className="border border-stone-300 px-3 py-2 disabled:opacity-40">Previous</button><button disabled={products.length < 50} onClick={() => setProductPage((page) => page + 1)} className="border border-stone-300 px-3 py-2 disabled:opacity-40">Next</button></div></div>}
          <p className="mt-4 text-xs leading-5 text-stone-500">Visibility changes affect the whole product and all its variants. Inactive products are hidden from the storefront.</p>
        </section>

        <section className="h-fit border border-[#b9cbbf] border-l-4 border-l-[#293c35] bg-[#eaf1ec] p-5 sm:p-6 xl:sticky xl:top-36">
          <p className="flex items-center gap-2 text-[9px] uppercase tracking-[.18em] text-[#a45f50]"><PackagePlus size={15} /> {editing ? 'Edit catalogue details' : 'Add to catalogue'}</p>
          <div className="mt-2 flex items-center justify-between gap-2"><h2 className="font-display text-2xl">{editing ? draft.name || 'Edit product' : 'Create a product'}</h2>{editing && <button type="button" onClick={startCreate} className="text-xs underline">Cancel edit</button>}</div>
          <p className="mt-2 text-xs text-stone-600">Fields marked <span className="font-semibold text-red-600">*</span> are required.</p>
          <form onSubmit={saveProduct} className="mt-5 space-y-3">
            <div className="grid grid-cols-2 gap-3"><label><FieldLabel required>Brand</FieldLabel><input required name="brand" maxLength={100} value={draft.brand} onChange={(e) => updateDraft('brand', e.target.value)} className={field} /></label><label><FieldLabel required>Product name</FieldLabel><input required name="name" maxLength={180} value={draft.name} onChange={(e) => { updateDraft('name', e.target.value); if (!editing) updateDraft('slug', slugify(e.target.value)) }} className={field} /></label></div>
            <label className="block"><FieldLabel required>URL slug</FieldLabel><input required name="slug" maxLength={200} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={draft.slug} onChange={(e) => updateDraft('slug', e.target.value)} className={field} /><span className="mt-1 block text-[10px] text-stone-500">Lowercase words separated by hyphens.</span></label>
            <label className="block"><FieldLabel>Category</FieldLabel><select name="categoryId" value={draft.categoryId} onChange={(e) => updateDraft('categoryId', e.target.value)} className={field}><option value="">No category</option>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label>
            <label className="block"><FieldLabel>Product label</FieldLabel><input name="tag" maxLength={40} value={draft.tag} onChange={(e) => updateDraft('tag', e.target.value)} placeholder="For example, NEW" className={field} /></label>
            <label className="block"><FieldLabel>Description</FieldLabel><textarea name="description" maxLength={4000} rows={3} value={draft.description} onChange={(e) => updateDraft('description', e.target.value)} className={field} /></label>
            <label className="block"><FieldLabel>Ingredients (optional)</FieldLabel><textarea name="ingredients" maxLength={4000} rows={2} value={draft.ingredients} onChange={(e) => updateDraft('ingredients', e.target.value)} className={field} /></label>
            <div className="rounded border border-[#cbd8ce] bg-white/70 p-3">
              <label className="block text-xs text-stone-600"><span className="mb-2 flex items-center gap-2"><ImagePlus size={15} /> Product image (JPEG, PNG, WebP or AVIF)</span><input type="file" accept="image/jpeg,image/png,image/webp,image/avif" disabled={imageUploadState === 'uploading' || busyId === -1} onChange={(event) => { const file = event.target.files?.[0] ?? null; const supported = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']; if (file && !supported.includes(file.type)) { setError('Choose a JPEG, PNG, WebP or AVIF image.'); setImageFile(null); setImageUploadState('failed') } else { setError(''); setImageFile(file); setImageUploadState(file ? 'selected' : 'idle') } }} className="block w-full text-xs file:mr-3 file:border file:border-stone-300 file:bg-white file:px-3 file:py-2" /></label>
              {imageFile && <p className="mt-2 text-xs text-stone-500">Selected: {imageFile.name}. It uploads when you save the product.</p>}{imageUploadState === 'uploading' && <p role="status" className="mt-2 text-xs text-[#725046]">Uploading image to Supabase Storage…</p>}{imageUploadState === 'uploaded' && <p role="status" className="mt-2 text-xs text-[#355444]">Image uploaded. Product image URL: {draft.imageUrl ? 'saved on the product' : 'pending save'}.</p>}{imageUploadState === 'failed' && <p role="alert" className="mt-2 text-xs text-[#8c443b]">Image upload failed. See the error above, then choose the file again to retry.</p>}
              <label className="mt-3 block"><FieldLabel>Or paste image URL</FieldLabel><input name="imageUrl" type="url" maxLength={2000} value={draft.imageUrl} onChange={(e) => { updateDraft('imageUrl', e.target.value); if (imageUploadState === 'uploaded') setImageUploadState('idle') }} placeholder="https://…" className={field} /></label>
              {draft.imageUrl && <div className="mt-3 flex items-center gap-3"><ProductPhoto src={draft.imageUrl} alt="Product image preview" className="h-14 w-14 bg-stone-100 object-cover" unavailableLabel="Image URL failed"/><span className="text-[10px] text-stone-500">Image URL preview</span></div>}
            </div>
            {!editing && <><div className="grid grid-cols-2 gap-3"><label><FieldLabel required>Price (£)</FieldLabel><input required name="price" type="number" min="0" max="100000" step="0.01" value={draft.price} onChange={(e) => updateDraft('price', e.target.value)} className={field} /></label><label><FieldLabel required>Initial stock (units)</FieldLabel><input required name="stock" type="number" min="0" max="1000000" step="1" value={draft.stock} onChange={(e) => updateDraft('stock', e.target.value)} className={field} /></label></div><div className="grid grid-cols-2 gap-3"><label><FieldLabel required>SKU</FieldLabel><input required name="sku" maxLength={80} value={draft.sku} onChange={(e) => updateDraft('sku', e.target.value)} className={field} /></label><label><FieldLabel>Option name</FieldLabel><input name="optionName" maxLength={80} value={draft.optionName} onChange={(e) => updateDraft('optionName', e.target.value)} placeholder="Size" className={field} /></label></div><label className="block"><FieldLabel>Option value</FieldLabel><input name="optionValue" maxLength={120} value={draft.optionValue} onChange={(e) => updateDraft('optionValue', e.target.value)} placeholder="30ml" className={field} /></label><p className="text-[10px] leading-4 text-stone-500">If left blank, the first option defaults to Standard / One size.</p></>}
            {editing && <p className="text-xs leading-5 text-stone-500">Variant price, SKU and options can be edited separately below. Inventory remains a separate stock action.</p>}
            <button disabled={busyId === -1} className="w-full bg-[#293c35] py-3.5 text-[10px] uppercase tracking-[.16em] text-white disabled:opacity-60">{busyId === -1 ? 'Saving…' : editing ? 'Save product details' : 'Create product'}</button>
          </form>
          {editing && <form onSubmit={addVariant} className="mt-6 border-t border-[#b9cbbf] pt-5"><div className="mb-3 flex items-center justify-between"><p className="text-[9px] uppercase tracking-[.18em] text-[#a45f50]">{variantEditingId == null ? 'Add a variant' : 'Edit variant'}</p>{variantEditingId != null && <button type="button" onClick={() => { setVariantEditingId(null); setVariantDraft(emptyVariant()) }} className="text-xs underline">Cancel edit</button>}</div><div className="space-y-3"><label className="block"><FieldLabel required>Variant SKU</FieldLabel><input required maxLength={80} value={variantDraft.sku} onChange={(e) => setVariantDraft((current) => ({ ...current, sku: e.target.value }))} className={field} /></label><div className="grid grid-cols-2 gap-3"><label><FieldLabel required>Option name</FieldLabel><input required maxLength={80} value={variantDraft.optionName} onChange={(e) => setVariantDraft((current) => ({ ...current, optionName: e.target.value }))} className={field} /></label><label><FieldLabel required>Option value</FieldLabel><input required maxLength={120} value={variantDraft.optionValue} onChange={(e) => setVariantDraft((current) => ({ ...current, optionValue: e.target.value }))} className={field} /></label></div><div className="grid grid-cols-2 gap-3"><label><FieldLabel required>Price (£)</FieldLabel><input required type="number" min="0" max="100000" step="0.01" value={variantDraft.price} onChange={(e) => setVariantDraft((current) => ({ ...current, price: e.target.value }))} className={field} /></label>{variantEditingId == null && <label><FieldLabel required>Initial stock (units)</FieldLabel><input required type="number" min="0" max="1000000" step="1" value={variantDraft.stock} onChange={(e) => setVariantDraft((current) => ({ ...current, stock: e.target.value }))} className={field} /></label>}</div><p className="text-[11px] leading-5 text-stone-500">{variantEditingId == null ? 'New variants include their starting stock.' : 'Stock is managed separately with the stock field above.'}</p><button disabled={busyId === -2} className="w-full border border-[#293c35] py-3 text-[10px] uppercase tracking-[.16em] disabled:opacity-50">{busyId === -2 ? (variantEditingId == null ? 'Adding variant…' : 'Saving variant…') : variantEditingId == null ? 'Add variant' : 'Save variant changes'}</button></div></form>}
        </section>
      </div> : <section className="py-7"><p className="text-[9px] uppercase tracking-[.18em] text-stone-500">Latest activity</p><h2 className="mt-1 font-display text-2xl">Orders</h2>{loading ? <p role="status" className="py-8 text-sm text-stone-500">Loading orders…</p> : error ? <button onClick={() => void load()} className="mt-5 border border-stone-300 px-4 py-3 text-xs uppercase tracking-wider">Retry loading orders</button> : orders.length ? <div className="mt-4 overflow-x-auto border-y border-stone-200"><table className="w-full min-w-[700px] text-left text-xs"><thead className="text-[9px] uppercase tracking-[.12em] text-stone-500"><tr><th className="py-3 pr-4 font-medium">Order</th><th className="py-3 pr-4 font-medium">Customer</th><th className="py-3 pr-4 font-medium">Date</th><th className="py-3 pr-4 font-medium">Total</th><th className="py-3 pr-4 font-medium">Status</th><th className="py-3 font-medium">Actions</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id} className="border-t border-stone-100"><td className="py-4 pr-4 font-medium">#{order.id}</td><td className="py-4 pr-4">{order.email}</td><td className="py-4 pr-4">{new Date(order.createdAt).toLocaleDateString('en-GB')}</td><td className="py-4 pr-4">{money(order.subtotalMinor, order.currency)}</td><td className="py-4 pr-4">{order.status}</td><td className="py-4">{order.status === 'PLACED' ? <div className="flex flex-wrap gap-2"><button disabled={busyId === order.id} onClick={() => void changeOrder(order, 'CONFIRMED')} className="bg-[#293c35] px-3 py-2 text-[9px] uppercase tracking-wider text-white disabled:opacity-50">Confirm</button><button disabled={busyId === order.id} onClick={() => void changeOrder(order, 'FULFILLED')} className="border border-stone-300 px-3 py-2 text-[9px] uppercase tracking-wider disabled:opacity-50">Fulfil</button><button disabled={busyId === order.id} onClick={() => void changeOrder(order, 'CANCELLED')} className="border border-stone-300 px-3 py-2 text-[9px] uppercase tracking-wider disabled:opacity-50">Cancel</button></div> : '—'}</td></tr>)}</tbody></table></div> : <p className="py-8 text-sm text-stone-500">No orders yet.</p>}</section>}
    </main>
  )
}
