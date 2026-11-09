import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { FileText, Plus, RefreshCw, Save, Trash2 } from 'lucide-react'
import { api, type ContentPage, type ContentPageWrite, type FooterHelpLink, type StorefrontContent } from '../lib/api'

const input = 'w-full border border-stone-300 bg-white px-3 py-3 text-sm outline-none focus:border-[#293c35]'
const emptyPage = (): ContentPageWrite => ({ title: '', slug: '', eyebrow: '', body: '', published: false, footerGroup: '', displayOrder: 0 })
const emptyStorefront = (): StorefrontContent => ({ websiteUrl: '', customerEmail: '', postalAddress: '', footerHelpLinks: [] })

export default function AdminContentManager() {
  const [pages, setPages] = useState<ContentPage[]>([])
  const [storefront, setStorefront] = useState<StorefrontContent>(emptyStorefront)
  const [pageDraft, setPageDraft] = useState<ContentPageWrite>(emptyPage)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const load = async () => {
    setLoading(true); setError('')
    try {
      const [pageRows, storefrontData] = await Promise.all([api.adminContentPages(), api.storefrontContent()])
      setPages(pageRows)
      setStorefront({ ...storefrontData, footerHelpLinks: storefrontData.footerHelpLinks || [] })
    } catch (cause) { setError((cause as Error).message) }
    finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])

  const edit = (page: ContentPage) => {
    setSelectedId(page.id)
    setPageDraft({ title: page.title, slug: page.slug, eyebrow: page.eyebrow || '', body: page.body, published: page.published, footerGroup: page.footerGroup || '', displayOrder: page.displayOrder })
    setError(''); setMessage('')
  }
  const resetPage = () => { setSelectedId(null); setPageDraft(emptyPage()); setError(''); setMessage('') }

  const savePage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError(''); setMessage('')
    const payload = { ...pageDraft, title: pageDraft.title.trim(), slug: pageDraft.slug.trim().toLowerCase(), eyebrow: pageDraft.eyebrow?.trim() || null, body: pageDraft.body.trim(), footerGroup: pageDraft.footerGroup?.trim() || null, displayOrder: Number(pageDraft.displayOrder) }
    try {
      const saved = selectedId == null ? await api.createContentPage(payload) : await api.updateContentPage(selectedId, payload)
      window.dispatchEvent(new Event('boutique-content-updated'))
      setMessage(`“${saved.title}” ${selectedId == null ? 'created' : 'saved'}.`)
      setSelectedId(saved.id)
      setPageDraft({ title: saved.title, slug: saved.slug, eyebrow: saved.eyebrow || '', body: saved.body, published: saved.published, footerGroup: saved.footerGroup || '', displayOrder: saved.displayOrder })
      await load()
    } catch (cause) { setError((cause as Error).message) }
    finally { setBusy(false) }
  }

  const removePage = async (page: ContentPage) => {
    if (!window.confirm(`Delete “${page.title}”? This removes the page from the storefront.`)) return
    setBusy(true); setError(''); setMessage('')
    try { await api.deleteContentPage(page.id); window.dispatchEvent(new Event('boutique-content-updated')); if (selectedId === page.id) resetPage(); setMessage(`“${page.title}” deleted.`); await load() }
    catch (cause) { setError((cause as Error).message) }
    finally { setBusy(false) }
  }

  const saveStorefront = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError(''); setMessage('')
    try {
      const saved = await api.updateStorefrontContent({ websiteUrl: storefront.websiteUrl?.trim() || '', customerEmail: storefront.customerEmail?.trim() || '', postalAddress: storefront.postalAddress?.trim() || '', footerHelpLinks: storefront.footerHelpLinks.map((link, index) => ({ ...link, label: link.label.trim(), url: link.url.trim(), displayOrder: index })) })
      window.dispatchEvent(new Event('boutique-content-updated'))
      setStorefront(saved); setMessage('Storefront contact details and footer links saved.')
    } catch (cause) { setError((cause as Error).message) }
    finally { setBusy(false) }
  }

  const updateLink = (index: number, key: keyof FooterHelpLink, value: string) => setStorefront((current) => ({ ...current, footerHelpLinks: current.footerHelpLinks.map((link, itemIndex) => itemIndex === index ? { ...link, [key]: key === 'displayOrder' ? Number(value) : value } : link) }))

  return <section className="space-y-10 py-7">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[9px] uppercase tracking-[.18em] text-stone-500">Storefront content</p><h2 className="mt-1 font-display text-2xl">Pages &amp; footer</h2><p className="mt-2 max-w-2xl text-xs leading-5 text-stone-500">Create plain-text information pages and manage the shop contact details and footer links. Page bodies are rendered as text, not HTML.</p></div><button type="button" onClick={() => void load()} disabled={loading || busy} className="inline-flex items-center gap-2 border border-stone-300 px-3 py-2 text-[9px] uppercase tracking-wider disabled:opacity-50"><RefreshCw size={13} className={loading ? 'animate-spin' : ''}/> Refresh</button></div>

    {error && <p role="alert" className="border border-[#d9aaa0] bg-[#fbf1ee] px-4 py-3 text-sm text-[#8c443b]">{error}<button onClick={() => void load()} className="ml-3 underline">Retry</button></p>}
    {message && <p role="status" className="border border-[#b8c8be] bg-[#edf4ef] px-4 py-3 text-sm text-[#355444]">{message}</p>}

    <div className="grid gap-7 xl:grid-cols-[minmax(280px,.8fr)_minmax(400px,1.2fr)]">
      <section className="border border-stone-200 bg-white p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><div><h3 className="font-display text-xl">Website pages</h3><p className="mt-1 text-[11px] text-stone-500">{pages.length} page{pages.length === 1 ? '' : 's'} · published pages appear on the site</p></div><button onClick={resetPage} className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#293c35] px-3 py-2 text-[9px] uppercase tracking-wider text-white"><Plus size={13}/> New page</button></div>
        {loading ? <p className="py-8 text-sm text-stone-500">Loading pages…</p> : pages.length ? <ul className="mt-5 divide-y divide-stone-200 border-y border-stone-200">{pages.map((page) => <li key={page.id} className="flex items-center justify-between gap-3 py-4"><button onClick={() => edit(page)} className="min-w-0 flex-1 text-left"><span className="flex items-center gap-2"><FileText size={14} className="shrink-0 text-[#8f6559]"/><span className="truncate text-sm font-medium">{page.title}</span></span><span className="mt-1 block truncate pl-[22px] text-[10px] text-stone-500">/pages/{page.slug} · {page.published ? 'Published' : 'Draft'}</span></button><button disabled={busy} onClick={() => void removePage(page)} aria-label={`Delete ${page.title}`} className="rounded-full p-2 text-stone-500 hover:bg-[#fbf1ee] hover:text-red-700 disabled:opacity-40"><Trash2 size={14}/></button></li>)}</ul> : !loading && <p className="mt-5 border border-dashed border-stone-300 px-4 py-8 text-center text-sm text-stone-500">No pages yet. Create your first information page.</p>}
      </section>

      <form onSubmit={savePage} className="space-y-4 border border-[#b9cbbf] border-l-4 border-l-[#293c35] bg-[#eaf1ec] p-5 sm:p-6"><div><p className="text-[9px] uppercase tracking-[.18em] text-[#8f6559]">{selectedId == null ? 'New content' : 'Editing page'}</p><h3 className="mt-1 font-display text-xl">{selectedId == null ? 'Add a page' : pageDraft.title || 'Edit page'}</h3></div>
        <label className="block"><span className="mb-1.5 block text-[9px] uppercase tracking-wider">Page title <b className="text-red-600">*</b></span><input required maxLength={160} value={pageDraft.title} onChange={(event) => setPageDraft((current) => ({ ...current, title: event.target.value }))} className={input}/></label>
        <div className="grid gap-3 sm:grid-cols-2"><label className="block"><span className="mb-1.5 block text-[9px] uppercase tracking-wider">URL slug <b className="text-red-600">*</b></span><input required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" maxLength={120} placeholder="delivery-and-returns" value={pageDraft.slug} onChange={(event) => setPageDraft((current) => ({ ...current, slug: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))} className={input}/></label><label className="block"><span className="mb-1.5 block text-[9px] uppercase tracking-wider">Tag / eyebrow</span><input maxLength={100} placeholder="Customer care" value={pageDraft.eyebrow || ''} onChange={(event) => setPageDraft((current) => ({ ...current, eyebrow: event.target.value }))} className={input}/></label></div>
        <label className="block"><span className="mb-1.5 block text-[9px] uppercase tracking-wider">Main information <b className="text-red-600">*</b></span><textarea required maxLength={30000} rows={10} placeholder="Write the page information here…" value={pageDraft.body} onChange={(event) => setPageDraft((current) => ({ ...current, body: event.target.value }))} className={`${input} resize-y leading-6`}/><span className="mt-1 block text-[10px] text-stone-500">Plain text only. Use blank lines to separate paragraphs.</span></label>
        <div className="grid gap-3 sm:grid-cols-2"><label className="block"><span className="mb-1.5 block text-[9px] uppercase tracking-wider">Footer group</span><input maxLength={80} placeholder="Help" value={pageDraft.footerGroup || ''} onChange={(event) => setPageDraft((current) => ({ ...current, footerGroup: event.target.value }))} className={input}/></label><label className="block"><span className="mb-1.5 block text-[9px] uppercase tracking-wider">Display order</span><input required type="number" min="0" max="100000" value={pageDraft.displayOrder} onChange={(event) => setPageDraft((current) => ({ ...current, displayOrder: Number(event.target.value) }))} className={input}/></label></div>
        <label className="flex items-center gap-2 text-xs text-stone-700"><input type="checkbox" checked={pageDraft.published} onChange={(event) => setPageDraft((current) => ({ ...current, published: event.target.checked }))}/> Published and visible on the storefront</label>
        <div className="flex flex-wrap gap-2"><button disabled={busy} className="inline-flex flex-1 items-center justify-center gap-2 bg-[#293c35] px-4 py-3 text-[9px] uppercase tracking-wider text-white disabled:opacity-50"><Save size={14}/>{busy ? 'Saving…' : selectedId == null ? 'Create page' : 'Save page'}</button>{selectedId != null && <button type="button" onClick={resetPage} className="border border-stone-300 px-4 py-3 text-[9px] uppercase tracking-wider">Cancel</button>}</div>
      </form>
    </div>

    <form onSubmit={saveStorefront} className="border border-stone-200 bg-[#f7f2eb] p-5 sm:p-6"><div><p className="text-[9px] uppercase tracking-[.18em] text-[#8f6559]">Store settings</p><h3 className="mt-1 font-display text-2xl">Contact details &amp; footer links</h3><p className="mt-2 text-xs text-stone-500">These details are displayed in the storefront footer. Footer link URLs must be HTTPS or same-site paths.</p></div>
      <div className="mt-5 grid gap-4 md:grid-cols-2"><label className="block"><span className="mb-1.5 block text-[9px] uppercase tracking-wider">Website URL *</span><input required type="url" pattern="https://.*" maxLength={2048} value={storefront.websiteUrl || ''} onChange={(event) => setStorefront((current) => ({ ...current, websiteUrl: event.target.value }))} className={input}/></label><label className="block"><span className="mb-1.5 block text-[9px] uppercase tracking-wider">Customer email *</span><input required type="email" maxLength={254} value={storefront.customerEmail || ''} onChange={(event) => setStorefront((current) => ({ ...current, customerEmail: event.target.value }))} className={input}/></label><label className="block md:col-span-2"><span className="mb-1.5 block text-[9px] uppercase tracking-wider">Postal address *</span><textarea required rows={3} maxLength={2000} value={storefront.postalAddress || ''} onChange={(event) => setStorefront((current) => ({ ...current, postalAddress: event.target.value }))} className={`${input} resize-y`}/></label></div>
      <div className="mt-7 border-t border-stone-300 pt-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h4 className="text-[10px] uppercase tracking-[.15em]">Here to help links</h4><p className="mt-1 text-[10px] text-stone-500">For example: Contact us, Delivery &amp; returns, FAQs.</p></div><button type="button" onClick={() => setStorefront((current) => ({ ...current, footerHelpLinks: [...current.footerHelpLinks, { label: '', url: '/', displayOrder: current.footerHelpLinks.length }] }))} disabled={storefront.footerHelpLinks.length >= 30} className="inline-flex items-center gap-1 border border-stone-300 bg-white px-3 py-2 text-[9px] uppercase tracking-wider disabled:opacity-40"><Plus size={13}/> Add link</button></div>
        <div className="mt-4 space-y-3">{storefront.footerHelpLinks.map((link, index) => <div key={`link-${index}`} className="grid items-end gap-2 sm:grid-cols-[1fr_1.4fr_auto]"><label><span className="mb-1 block text-[9px] uppercase tracking-wider">Label</span><input required maxLength={100} value={link.label} onChange={(event) => updateLink(index, 'label', event.target.value)} className={input}/></label><label><span className="mb-1 block text-[9px] uppercase tracking-wider">URL</span><input required maxLength={2048} placeholder="/pages/delivery" value={link.url} onChange={(event) => updateLink(index, 'url', event.target.value)} className={input}/></label><button type="button" onClick={() => setStorefront((current) => ({ ...current, footerHelpLinks: current.footerHelpLinks.filter((_, itemIndex) => itemIndex !== index) }))} aria-label={`Remove footer link ${link.label || index + 1}`} className="mb-1 rounded-full p-2 text-stone-500 hover:bg-[#fbf1ee] hover:text-red-700"><Trash2 size={15}/></button></div>)}</div>
      </div>
      <button disabled={busy} className="mt-5 inline-flex items-center justify-center gap-2 bg-[#293c35] px-5 py-3 text-[9px] uppercase tracking-wider text-white disabled:opacity-50"><Save size={14}/>{busy ? 'Saving…' : 'Save footer settings'}</button>
    </form>
  </section>
}
