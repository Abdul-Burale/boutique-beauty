import { ArrowLeft } from 'lucide-react'
import type { ContentPage } from '../lib/api'

type Props = { page: ContentPage; onBack: () => void }

export default function ContentPageView({ page, onBack }: Props) {
  return <main className="mx-auto min-h-[60vh] max-w-[960px] px-4 py-10 sm:px-8 sm:py-16 lg:px-12">
    <nav aria-label="Breadcrumb" className="mb-8 flex items-center gap-2 text-[10px] uppercase tracking-[.14em] text-stone-500"><button onClick={onBack} className="hover:text-[#a45f50]">Home</button><span aria-hidden="true">/</span><span aria-current="page" className="text-stone-800">{page.title}</span></nav>
    <article><p className="text-[10px] uppercase tracking-[.2em] text-[#8f6559]">{page.eyebrow || 'Boutique Beauty Retail'}</p><h1 className="mt-3 font-display text-4xl leading-tight sm:text-5xl">{page.title}</h1><div className="mt-8 max-w-3xl whitespace-pre-line text-sm leading-7 text-stone-600 sm:text-base sm:leading-8">{page.body}</div></article>
    <button onClick={onBack} className="mt-12 inline-flex items-center gap-2 border-b border-stone-400 pb-2 text-[10px] uppercase tracking-[.15em] text-stone-600"><ArrowLeft size={14}/> Back to the shop</button>
  </main>
}
