import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowLeft, MapPin, Package, Trash2 } from 'lucide-react'
import { api, type Customer, type CustomerAddress, type CustomerOrder } from '../lib/api'

type Props = { customer: Customer; onExit: () => void; onSignOut: () => void }
const field = 'w-full border border-stone-300 bg-white px-3 py-3 text-sm outline-none focus:border-[#293c35]'
const money = (minor: number, currency: string) => new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(minor / 100)

export default function AccountDashboard({ customer, onExit, onSignOut }: Props) {
  const [addresses, setAddresses] = useState<CustomerAddress[]>([])
  const [orders, setOrders] = useState<CustomerOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const load = async () => {
    setLoading(true); setError('')
    if (customer.role === 'ADMIN') {
      setAddresses([]); setOrders([]); setLoading(false)
      return
    }
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
    const form = new FormData(event.currentTarget)
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

  return <main className="mx-auto min-h-[70vh] max-w-[1440px] px-4 py-8 sm:px-8 lg:px-12">
    <button onClick={onExit} className="mb-6 inline-flex items-center gap-2 text-[10px] uppercase tracking-[.15em] text-stone-600"><ArrowLeft size={15} /> Back to shop</button>
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-stone-200 pb-6"><div><p className="mb-2 text-[10px] uppercase tracking-[.2em] text-[#a45f50]">Boutique Beauty Retail</p><h1 className="font-display text-4xl">Your account</h1><p className="mt-2 text-sm text-stone-500">Profile, saved addresses and your orders.</p></div><button onClick={onSignOut} className="border border-stone-300 px-4 py-3 text-[10px] uppercase tracking-[.14em]">Sign out</button></div>
    {error && <div role="alert" className="mt-5 border border-[#d9aaa0] bg-[#fbf1ee] px-4 py-3 text-sm text-[#8c443b]">{error}<button onClick={() => void load()} className="ml-3 underline">Retry</button></div>}{message && <p role="status" className="mt-5 border border-[#b8c8be] bg-[#edf4ef] px-4 py-3 text-sm text-[#355444]">{message}</p>}
    <div className="grid gap-8 py-8 lg:grid-cols-[.8fr_1.2fr]">
      <div className="space-y-8">
        <section className="border border-stone-200 bg-[#f7f2eb] p-6"><p className="text-[10px] uppercase tracking-[.18em] text-[#8f6559]">Profile</p><h2 className="mt-2 font-display text-2xl">Hello, {customer.firstName}</h2><p className="mt-2 text-sm text-stone-600">{customer.email}</p><p className="mt-4 text-xs text-stone-500">Account type: {customer.role === 'ADMIN' ? 'Administrator' : 'Customer'}</p></section>
        {customer.role !== 'ADMIN' && <section className="border border-stone-200 p-6"><div className="flex items-center gap-2"><MapPin size={16}/><h2 className="font-display text-2xl">Saved addresses</h2></div>{loading ? <p className="py-5 text-sm text-stone-500">Loading addresses…</p> : addresses.length ? <ul className="mt-4 divide-y divide-stone-200">{addresses.map((address) => <li key={address.id} className="flex justify-between gap-3 py-4 text-sm"><div><p className="font-medium">{address.recipientName} {address.isDefault && <span className="ml-2 text-[9px] uppercase tracking-wider text-[#8f6559]">Default</span>}</p><p className="mt-1 text-xs leading-5 text-stone-600">{[address.line1, address.line2, address.city, address.region, address.postalCode, address.countryCode].filter(Boolean).join(', ')}</p></div><button disabled={busy} onClick={() => void removeAddress(address)} aria-label="Remove address" className="h-fit p-2 text-stone-500 hover:text-red-700"><Trash2 size={15}/></button></li>)}</ul> : !loading && <p className="py-4 text-sm text-stone-500">No saved addresses yet.</p>}
          <form onSubmit={addAddress} className="mt-4 space-y-3 border-t border-stone-200 pt-5"><h3 className="text-[10px] uppercase tracking-[.15em]">Add an address</h3><input required name="recipientName" placeholder="Recipient name" className={field}/><input required name="line1" placeholder="Address line 1" className={field}/><input name="line2" placeholder="Address line 2 (optional)" className={field}/><div className="grid grid-cols-2 gap-3"><input required name="city" placeholder="Town or city" className={field}/><input name="region" placeholder="County / region" className={field}/></div><div className="grid grid-cols-2 gap-3"><input required name="postalCode" placeholder="Postcode" className={field}/><input required name="countryCode" defaultValue="GB" minLength={2} maxLength={2} placeholder="Country code" className={field}/></div><label className="flex items-center gap-2 text-xs text-stone-600"><input type="checkbox" name="isDefault"/> Set as default address</label><button disabled={busy} className="w-full bg-[#293c35] py-3 text-[10px] uppercase tracking-[.15em] text-white disabled:opacity-50">{busy ? 'Saving…' : 'Save address'}</button></form>
        </section>}
      </div>
      {customer.role !== 'ADMIN' ? <section className="border border-stone-200 p-6"><div className="flex items-center gap-2"><Package size={16}/><h2 className="font-display text-2xl">Order history</h2></div>{loading ? <p className="py-6 text-sm text-stone-500">Loading orders…</p> : orders.length ? <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[480px] text-left text-xs"><thead className="text-[9px] uppercase tracking-[.12em] text-stone-500"><tr><th className="py-3 pr-4 font-medium">Order</th><th className="py-3 pr-4 font-medium">Date</th><th className="py-3 pr-4 font-medium">Status</th><th className="py-3 font-medium">Total</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id} className="border-t border-stone-100"><td className="py-4 pr-4">#{order.id}</td><td className="py-4 pr-4">{new Date(order.createdAt).toLocaleDateString('en-GB')}</td><td className="py-4 pr-4">{order.status}</td><td className="py-4">{money(order.subtotalMinor, order.currency)}</td></tr>)}</tbody></table></div> : !loading && <p className="py-8 text-sm text-stone-500">Your orders will appear here.</p>}</section> : <section className="flex min-h-40 items-center border border-stone-200 bg-[#f7f2eb] p-6"><p className="text-sm leading-6 text-stone-600">This administrator account uses the separate Admin studio for product and order management.</p></section>}
    </div>
  </main>
}
