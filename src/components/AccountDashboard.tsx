import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowLeft, Headphones, MapPin, Package, Plus, Trash2, UserRound } from 'lucide-react'
import { api, type Customer, type CustomerAddress, type CustomerOrder } from '../lib/api'

type Props = { customer: Customer; onExit: () => void; onSignOut: () => void }
type AccountSection = 'personal' | 'addresses' | 'orders' | 'support'
const field = 'w-full border border-stone-300 bg-white px-3 py-3 text-sm outline-none focus:border-[#293c35]'
const money = (minor: number, currency: string) => new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(minor / 100)
const sections: { id: AccountSection; label: string; icon: typeof UserRound }[] = [
  { id: 'personal', label: 'Personal details', icon: UserRound },
  { id: 'addresses', label: 'Addresses & billing', icon: MapPin },
  { id: 'orders', label: 'Order history', icon: Package },
  { id: 'support', label: 'Support requests', icon: Headphones },
]

export default function AccountDashboard({ customer, onExit, onSignOut }: Props) {
  const [section, setSection] = useState<AccountSection>('personal')
  const [addresses, setAddresses] = useState<CustomerAddress[]>([])
  const [orders, setOrders] = useState<CustomerOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const isAdmin = customer.role === 'ADMIN'

  const load = async () => {
    setLoading(true); setError('')
    if (isAdmin) { setAddresses([]); setOrders([]); setLoading(false); return }
    try {
      const [addressRows, orderRows] = await Promise.all([api.addresses(), api.customerOrders()])
      setAddresses(addressRows); setOrders(orderRows)
    } catch (cause) { setError((cause as Error).message) }
    finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [customer.role])

  const addAddress = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError(''); setMessage('')
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const line2 = String(form.get('line2') || '').trim()
    const region = String(form.get('region') || '').trim()
    try {
      await api.addAddress({ recipientName: String(form.get('recipientName')).trim(), line1: String(form.get('line1')).trim(), line2: line2 || null, city: String(form.get('city')).trim(), region: region || null, postalCode: String(form.get('postalCode')).trim(), countryCode: String(form.get('countryCode')).trim().toUpperCase(), isDefault: form.get('isDefault') === 'on' })
      formElement.reset(); setMessage('Address saved.'); await load()
    } catch (cause) { setError((cause as Error).message) }
    finally { setBusy(false) }
  }

  const removeAddress = async (address: CustomerAddress) => {
    if (!window.confirm(`Remove the address in ${address.city}?`)) return
    setBusy(true); setError(''); setMessage('')
    try { await api.removeAddress(address.id); setAddresses((rows) => rows.filter((row) => row.id !== address.id)); setMessage('Address removed.') }
    catch (cause) { setError((cause as Error).message) }
    finally { setBusy(false) }
  }

  return <main className="mx-auto min-h-[70vh] max-w-[1280px] px-4 py-8 sm:px-8 lg:px-12">
    <button onClick={onExit} className="mb-6 inline-flex items-center gap-2 text-[10px] uppercase tracking-[.15em] text-stone-600"><ArrowLeft size={15} /> Back to shop</button>
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-stone-200 pb-6"><div><p className="mb-2 text-[10px] uppercase tracking-[.2em] text-[#a45f50]">Boutique Beauty Retail</p><h1 className="font-display text-4xl">Hello, {customer.firstName}</h1><p className="mt-2 text-sm text-stone-500">Your personal details, saved addresses, orders and support.</p></div><button onClick={onSignOut} className="border border-stone-300 px-4 py-3 text-[10px] uppercase tracking-[.14em] transition hover:border-[#293c35]">Sign out</button></div>

    {error && <div role="alert" className="mt-5 border border-[#d9aaa0] bg-[#fbf1ee] px-4 py-3 text-sm text-[#8c443b]">{error}<button onClick={() => void load()} className="ml-3 underline">Retry</button></div>}
    {message && <p role="status" className="mt-5 border border-[#b8c8be] bg-[#edf4ef] px-4 py-3 text-sm text-[#355444]">{message}</p>}

    <div className="grid gap-8 py-8 lg:grid-cols-[250px_minmax(0,1fr)] lg:gap-12">
      <nav aria-label="Account sections" className="flex gap-2 overflow-x-auto border-b border-stone-200 pb-3 lg:block lg:space-y-1 lg:border-0 lg:pb-0">
        {sections.filter((item) => !isAdmin || item.id === 'personal').map(({ id, label, icon: Icon }) => <button key={id} onClick={() => { setSection(id); setError(''); setMessage('') }} aria-current={section === id ? 'page' : undefined} className={`flex shrink-0 items-center gap-3 rounded-sm px-4 py-3 text-left text-xs transition lg:w-full ${section === id ? 'bg-[#f4e6df] text-[#60463f]' : 'text-stone-600 hover:bg-stone-50'}`}><Icon size={16} strokeWidth={1.6}/>{label}</button>)}
      </nav>

      <div className="min-w-0">
        {section === 'personal' && <section className="max-w-3xl"><p className="text-[10px] uppercase tracking-[.18em] text-[#8f6559]">Account</p><h2 className="mt-2 font-display text-3xl">Personal details</h2><p className="mt-2 text-sm text-stone-500">Your account information used for your profile and orders.</p><div className="mt-7 grid gap-4 sm:grid-cols-2"><div className="border border-stone-200 bg-white p-5"><p className="text-[9px] uppercase tracking-[.15em] text-stone-500">First name</p><p className="mt-2 text-sm">{customer.firstName || '—'}</p></div><div className="border border-stone-200 bg-white p-5"><p className="text-[9px] uppercase tracking-[.15em] text-stone-500">Last name</p><p className="mt-2 text-sm">{customer.lastName || '—'}</p></div><div className="border border-stone-200 bg-white p-5 sm:col-span-2"><p className="text-[9px] uppercase tracking-[.15em] text-stone-500">Email address</p><p className="mt-2 text-sm">{customer.email}</p><p className="mt-2 text-[11px] leading-5 text-stone-500">Email changes are handled securely through account verification.</p></div></div><p className="mt-5 text-xs leading-5 text-stone-500">To change your name or contact details, please contact the store. Profile editing is not connected yet.</p></section>}

        {section === 'addresses' && !isAdmin && <section className="max-w-4xl"><p className="text-[10px] uppercase tracking-[.18em] text-[#8f6559]">Your details</p><h2 className="mt-2 font-display text-3xl">Addresses &amp; billing</h2><p className="mt-2 text-sm text-stone-500">Manage the delivery addresses saved to your account.</p><div className="mt-7 grid gap-8 xl:grid-cols-[1fr_1fr]">
          <div><h3 className="text-[10px] uppercase tracking-[.15em]">Saved addresses</h3>{loading ? <p className="py-6 text-sm text-stone-500">Loading addresses…</p> : addresses.length ? <ul className="mt-3 divide-y divide-stone-200 border-y border-stone-200">{addresses.map((address) => <li key={address.id} className="flex justify-between gap-4 py-5 text-sm"><div><p className="font-medium">{address.recipientName} {address.isDefault && <span className="ml-2 text-[9px] uppercase tracking-wider text-[#8f6559]">Default</span>}</p><p className="mt-2 text-xs leading-5 text-stone-600">{[address.line1, address.line2, address.city, address.region, address.postalCode, address.countryCode].filter(Boolean).join(', ')}</p></div><button disabled={busy} onClick={() => void removeAddress(address)} aria-label={`Remove address in ${address.city}`} className="h-fit rounded-full p-2 text-stone-500 hover:bg-[#fbf1ee] hover:text-red-700 disabled:opacity-40"><Trash2 size={15}/></button></li>)}</ul> : !loading && <div className="mt-3 border border-dashed border-stone-300 px-5 py-8 text-center"><MapPin size={19} className="mx-auto text-stone-400"/><p className="mt-3 text-sm">No saved addresses yet</p><p className="mt-1 text-xs text-stone-500">Add one here to make future orders easier.</p></div>}</div>
          <form onSubmit={addAddress} className="space-y-3 bg-[#f7f2eb] p-5 sm:p-6"><div className="flex items-center gap-2"><Plus size={15}/><h3 className="text-[10px] uppercase tracking-[.15em]">Add a delivery address</h3></div><input required name="recipientName" placeholder="Recipient name" className={field}/><input required name="line1" placeholder="Address line 1" className={field}/><input name="line2" placeholder="Address line 2 (optional)" className={field}/><div className="grid grid-cols-2 gap-3"><input required name="city" placeholder="Town or city" className={field}/><input name="region" placeholder="County / region" className={field}/></div><div className="grid grid-cols-2 gap-3"><input required name="postalCode" placeholder="Postcode" className={field}/><input required name="countryCode" defaultValue="GB" minLength={2} maxLength={2} placeholder="Country code" className={field}/></div><label className="flex items-center gap-2 text-xs text-stone-600"><input type="checkbox" name="isDefault"/> Set as default address</label><button disabled={busy} className="flex w-full items-center justify-center gap-2 bg-[#293c35] py-3 text-[10px] uppercase tracking-[.15em] text-white disabled:opacity-50">{busy ? 'Saving…' : 'Save address'}</button><p className="text-[10px] leading-4 text-stone-500">Saved payment methods are not available yet.</p></form>
        </div></section>}

        {section === 'orders' && !isAdmin && <section><p className="text-[10px] uppercase tracking-[.18em] text-[#8f6559]">Your purchases</p><h2 className="mt-2 font-display text-3xl">Order history</h2><p className="mt-2 text-sm text-stone-500">A record of orders placed with Boutique Beauty Retail.</p>{loading ? <p className="py-8 text-sm text-stone-500">Loading your orders…</p> : orders.length ? <div className="mt-7 overflow-x-auto border-y border-stone-200"><table className="w-full min-w-[540px] text-left text-xs"><thead className="text-[9px] uppercase tracking-[.12em] text-stone-500"><tr><th className="py-4 pr-4 font-medium">Order</th><th className="py-4 pr-4 font-medium">Date</th><th className="py-4 pr-4 font-medium">Status</th><th className="py-4 text-right font-medium">Total</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id} className="border-t border-stone-100"><td className="py-5 pr-4 font-medium">#{order.id}</td><td className="py-5 pr-4">{new Date(order.createdAt).toLocaleDateString('en-GB')}</td><td className="py-5 pr-4"><span className="rounded-full bg-[#f4eee7] px-3 py-1.5 text-[9px] uppercase tracking-wider">{order.status}</span></td><td className="py-5 text-right">{money(order.subtotalMinor, order.currency)}</td></tr>)}</tbody></table></div> : <div className="mt-7 border border-dashed border-stone-300 px-5 py-12 text-center"><Package size={20} className="mx-auto text-stone-400"/><p className="mt-3 font-display text-xl">No orders yet</p><p className="mt-1 text-sm text-stone-500">Your orders will appear here once you place one.</p></div>}</section>}

        {section === 'support' && !isAdmin && <section className="max-w-3xl"><p className="text-[10px] uppercase tracking-[.18em] text-[#8f6559]">We’re here to help</p><h2 className="mt-2 font-display text-3xl">Support requests</h2><div className="mt-7 border border-stone-200 bg-white p-6 sm:p-8"><Headphones size={20} className="text-[#8f6559]"/><h3 className="mt-4 font-display text-2xl">Need a hand?</h3><p className="mt-2 max-w-xl text-sm leading-6 text-stone-600">Support messages and request tracking are not connected to the shop yet. For help with an order or your account, please contact the store using the contact details on its website.</p><p className="mt-5 border-t border-stone-200 pt-4 text-xs text-stone-500">Once support is connected, your conversations will be shown here.</p></div></section>}
      </div>
    </div>
  </main>
}
