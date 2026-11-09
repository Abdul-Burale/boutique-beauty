import type { FormEvent } from 'react'
import { ArrowLeft } from 'lucide-react'

type Props = {
  mode: 'login' | 'register'
  onModeChange: (mode: 'login' | 'register') => void
  message: string
  messageIsError: boolean
  busy: boolean
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onExit: () => void
}

const input = 'w-full border border-stone-300 bg-white px-3 py-3 text-sm outline-none focus:border-[#293c35]'

export default function AccountAccessPage({ mode, onModeChange, message, messageIsError, busy, onSubmit, onExit }: Props) {
  return <main className="mx-auto min-h-[70vh] max-w-[1440px] px-4 py-8 sm:px-8 lg:px-12">
    <button onClick={onExit} className="mb-8 inline-flex items-center gap-2 text-[10px] uppercase tracking-[.15em] text-stone-600 hover:text-ink"><ArrowLeft size={15}/> Back to shop</button>
    <section className="mx-auto max-w-lg border border-stone-200 bg-[#f7f2eb] p-6 sm:p-10">
      <p className="text-[10px] uppercase tracking-[.18em] text-[#a45f50]">Boutique Beauty Retail</p>
      <h1 className="mt-2 font-display text-3xl">{mode === 'login' ? 'Your account' : 'Create your account'}</h1>
      <p className="mt-2 text-sm leading-6 text-stone-600">{mode === 'login' ? 'Sign in to manage your details, addresses and orders.' : 'Create an account to save your details and manage your orders.'}</p>
      {message && <p role={messageIsError ? 'alert' : 'status'} className={`mt-5 border px-3 py-2 text-xs leading-5 ${messageIsError ? 'border-[#d9aaa0] bg-[#fbf1ee] text-[#8c443b]' : 'border-[#b8c8be] bg-[#edf4ef] text-[#355444]'}`}>{message}</p>}
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        {mode === 'register' && <div className="grid grid-cols-2 gap-3"><input required name="firstName" autoComplete="given-name" placeholder="First name" maxLength={80} className={input}/><input required name="lastName" autoComplete="family-name" placeholder="Last name" maxLength={80} className={input}/></div>}
        <input required type="email" name="email" autoComplete="email" placeholder="Email address" maxLength={254} className={input}/>
        <input required type="password" name="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder="Password" minLength={mode === 'register' ? 12 : undefined} maxLength={72} className={input}/>
        {mode === 'register' && <p className="text-[11px] leading-5 text-stone-500">Please use at least 12 characters for your password.</p>}
        <button disabled={busy} className="w-full bg-[#293c35] py-3.5 text-xs uppercase tracking-[.15em] text-white disabled:opacity-60">{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}</button>
      </form>
      <p className="mt-5 text-center text-xs text-stone-600">{mode === 'login' ? 'New here?' : 'Already have an account?'} <button onClick={() => onModeChange(mode === 'login' ? 'register' : 'login')} className="underline underline-offset-4">{mode === 'login' ? 'Create an account' : 'Sign in'}</button></p>
    </section>
  </main>
}
