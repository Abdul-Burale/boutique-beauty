import { useEffect, useState } from 'react'
import { ArrowLeft, Minus, Plus, ShoppingBag } from 'lucide-react'
import ProductPhoto from './ProductPhoto'
import { api, type Product, type ProductDetail } from '../lib/api'

const money = (minor: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(minor / 100)

type Props = {
  product: Product
  related: Product[]
  loading: boolean
  onBack: () => void
  onAdd: (product: Product, quantity: number) => void
  onSelect: (product: Product) => void
}

export default function ProductDetailPage({ product, related, loading, onBack, onAdd, onSelect }: Props) {
  const [detail, setDetail] = useState<ProductDetail>(product)
  const [variants, setVariants] = useState<ProductDetail[]>([])
  const [detailLoading, setDetailLoading] = useState(true)
  const [detailError, setDetailError] = useState('')
  const [quantity, setQuantity] = useState(1)

  useEffect(() => {
    let active = true
    setDetail(product)
    setQuantity(1)
    setDetailLoading(true)
    setDetailError('')
    api.product(product.slug)
      .then((result) => {
        if (!active) return
        setVariants(result.variants || [])
        setDetail(result.variants?.find((variant) => variant.variantId === product.variantId) || result.product)
      })
      .catch((error: Error) => { if (active) setDetailError(error.message) })
      .finally(() => { if (active) setDetailLoading(false) })
    return () => { active = false }
  }, [product.slug])

  const available = Math.max(0, detail.stock ?? product.stock ?? 0)
  const category = detail.category || product.category || 'Beauty'
  const image = detail.imageUrl || product.imageUrl || ''

  return <main className="mx-auto max-w-[1280px] px-4 pb-20 pt-6 sm:px-8 lg:px-12">
    <nav aria-label="Breadcrumb" className="mb-7 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[.13em] text-stone-500">
      <button onClick={onBack} className="hover:text-[#a45f50]">Home</button><span aria-hidden="true">/</span>
      <button onClick={onBack} className="hover:text-[#a45f50]">{category}</button><span aria-hidden="true">/</span>
      <span aria-current="page" className="max-w-[55vw] truncate text-stone-800">{detail.name}</span>
    </nav>

    <button onClick={onBack} className="mb-5 inline-flex items-center gap-2 text-[10px] uppercase tracking-[.15em] text-stone-600 hover:text-ink"><ArrowLeft size={14}/> Back to products</button>
    <section className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(340px,.85fr)] lg:gap-14">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_92px]">
        <div className="aspect-square overflow-hidden bg-[#f2eee8] sm:order-2"><ProductPhoto src={image} alt={detail.name} unavailableLabel={image ? 'Photo unavailable' : 'No photo linked'} className="h-full w-full object-cover" /></div>
        <div className="hidden flex-col gap-3 sm:order-1 sm:flex"><div className="aspect-square overflow-hidden bg-[#f2eee8]"><ProductPhoto src={image} alt={`${detail.name} product view`} unavailableLabel="Photo unavailable" className="h-full w-full object-cover" /></div></div>
      </div>

      <div className="flex flex-col py-1 lg:py-5">
        <p className="text-[10px] uppercase tracking-[.2em] text-[#8f6559]">{detail.brand}</p>
        <p className="mt-3 text-[10px] uppercase tracking-[.14em] text-stone-500">{category}{detail.tag ? ` · ${detail.tag}` : ''}</p>
        <h1 className="mt-2 font-display text-3xl leading-tight sm:text-4xl">{detail.name}</h1>
        <p className="mt-3 text-xs text-stone-500">No reviews yet</p>
        <p className="mt-5 text-xl">{money(detail.priceMinor)}</p>
        <p className={`mt-4 flex items-center gap-2 text-xs ${available > 0 ? 'text-[#42614c]' : 'text-[#8c443b]'}`}><span className={`h-2 w-2 rounded-full ${available > 0 ? 'bg-[#65856a]' : 'bg-[#b4665b]'}`} />{available > 0 ? 'Available to order' : 'Currently unavailable'}</p>
        {variants.length > 1 ? <label className="mt-7 block border-t border-stone-200 pt-5"><span className="text-[9px] uppercase tracking-[.16em] text-stone-500">{detail.optionName || 'Choose an option'}</span><select value={detail.variantId} onChange={(event) => { const variant = variants.find((item) => item.variantId === Number(event.target.value)); if (variant) { setDetail(variant); setQuantity(1) } }} className="mt-2 w-full border border-stone-300 bg-white px-3 py-3 text-sm">{variants.map((variant) => <option key={variant.variantId} value={variant.variantId}>{variant.optionValue || variant.optionName || 'Standard'} — {money(variant.priceMinor)}</option>)}</select></label> : detail.optionValue && <div className="mt-7 border-t border-stone-200 pt-5"><p className="text-[9px] uppercase tracking-[.16em] text-stone-500">{detail.optionName || 'Option'}</p><p className="mt-2 text-sm">{detail.optionValue}</p></div>}
        <p className="mt-5 text-xs leading-5 text-stone-600">Need help choosing? Our team is happy to help you find the right fit for your routine.</p>

        <div className="mt-7 flex items-center justify-between border-y border-stone-200 py-4"><span className="text-xs">Quantity</span><div className="flex items-center border border-stone-300"><button aria-label="Decrease quantity" disabled={quantity <= 1} onClick={() => setQuantity((value) => Math.max(1, value - 1))} className="p-3 disabled:opacity-40"><Minus size={14}/></button><span aria-live="polite" className="min-w-8 text-center text-xs">{quantity}</span><button aria-label="Increase quantity" disabled={quantity >= available} onClick={() => setQuantity((value) => Math.min(available, value + 1))} className="p-3 disabled:opacity-40"><Plus size={14}/></button></div></div>
        <button disabled={loading || available === 0} onClick={() => onAdd({ ...product, ...detail }, quantity)} className="mt-5 flex w-full items-center justify-center gap-2 bg-[#293c35] py-4 text-[10px] uppercase tracking-[.17em] text-white transition hover:bg-[#1d2d27] disabled:cursor-not-allowed disabled:bg-stone-300"><ShoppingBag size={15}/>{loading ? 'Adding…' : available === 0 ? 'Out of stock' : 'Add to bag'}</button>
        <p className="mt-3 text-center text-[10px] text-stone-500">Checkout is coming soon. Items can be added to your bag.</p>
        <div className="mt-8 border-y border-stone-200 py-5"><h2 className="text-[10px] uppercase tracking-[.17em]">Delivery &amp; returns</h2><p className="mt-3 text-xs leading-5 text-stone-600">Delivery options and returns information will be shown here. Please contact us if you need help with an order.</p></div>
      </div>
    </section>

    <section className="mt-14 border-t border-stone-200 pt-8 sm:mt-20">
      <h2 className="font-display text-2xl">About this product</h2>
      {detailLoading && <p className="mt-4 text-sm text-stone-500">Loading product details…</p>}
      {!detailLoading && detailError && <p role="status" className="mt-4 text-sm text-stone-500">Some product details could not be loaded. Showing the catalogue information.</p>}
      {detail.description && <p className="mt-4 max-w-3xl whitespace-pre-line text-sm leading-7 text-stone-600">{detail.description}</p>}
      {!detail.description && <p className="mt-4 text-sm leading-6 text-stone-500">Product information has not been added yet.</p>}
      {detail.ingredients?.trim() && <div className="mt-8 max-w-3xl border-t border-stone-200 pt-6"><h3 className="text-[10px] uppercase tracking-[.16em]">Ingredients</h3><p className="mt-3 whitespace-pre-line text-xs leading-6 text-stone-600">{detail.ingredients.trim()}</p></div>}
      <div className="mt-8 grid gap-4 border-t border-stone-200 pt-6 text-xs sm:grid-cols-3"><div><p className="uppercase tracking-wider text-stone-500">Brand</p><p className="mt-2">{detail.brand}</p></div><div><p className="uppercase tracking-wider text-stone-500">Category</p><p className="mt-2">{category}</p></div><div><p className="uppercase tracking-wider text-stone-500">Availability</p><p className="mt-2">{available > 0 ? `${available} available` : 'Out of stock'}</p></div></div>
    </section>

    {related.length > 1 && <section className="mt-16 border-t border-stone-200 pt-8"><h2 className="font-display text-2xl">You may also love</h2><div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">{related.filter((item) => item.id !== product.id).slice(0, 4).map((item) => <button key={`${item.id}-${item.variantId}`} onClick={() => onSelect(item)} className="group text-left"><div className="aspect-square overflow-hidden bg-[#eee9df]"><ProductPhoto src={item.imageUrl || ''} alt={item.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" unavailableLabel={item.imageUrl ? 'Photo unavailable' : 'No photo linked'}/></div><div className="bg-white px-3 py-4 shadow-[0_3px_16px_rgba(45,38,31,.06)]"><p className="text-[9px] uppercase tracking-wider text-stone-500">{item.category || 'Beauty'}{item.tag ? ` · ${item.tag}` : ''}</p><p className="mt-2 line-clamp-2 text-xs leading-5">{item.name}</p><p className="mt-2 text-xs">{money(item.priceMinor)}</p></div></button>)}</div></section>}
  </main>
}
