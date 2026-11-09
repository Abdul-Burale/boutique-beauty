import { useState } from 'react'
import { ImageOff } from 'lucide-react'

type Props = { src: string; alt: string; className?: string; unavailableLabel?: string }

export default function ProductPhoto({ src, alt, className = '', unavailableLabel = 'Product photo unavailable' }: Props) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) return <div role="img" aria-label={unavailableLabel} className={`flex items-center justify-center bg-[#eee9df] text-[#8f6559] ${className}`}><span className="flex flex-col items-center gap-2 px-3 text-center"><ImageOff size={20} strokeWidth={1.4}/><span className="text-[9px] uppercase tracking-[.12em]">{unavailableLabel}</span></span></div>
  return <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} className={className}/>
}
