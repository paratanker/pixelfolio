import GatedLink from './GatedLink'
import { getMailtoHref, getWhatsAppHref } from '../utils/contact'
import content from '../data/content.json'

const { footerCopyright } = content.site
const { resumeMessage } = content.contact
const socialLinks = content.social.filter(({ href }) => href)

export default function Footer() {
  return (
    <footer className="bg-[#161d38] pt-8 pb-24 font-mono text-[0.74rem] text-white/65">
      <div className="max-w-[1180px] mx-auto px-[clamp(1.25rem,4vw,3rem)] w-full flex flex-wrap gap-4 justify-between items-center">
        <span>{footerCopyright}</span>
        <div className="flex gap-[1.4rem] flex-wrap">
          <GatedLink className="no-underline text-white/85 hover:text-gold" href={getWhatsAppHref(resumeMessage)} target="_blank" rel="noopener">WhatsApp</GatedLink>
          <GatedLink className="no-underline text-white/85 hover:text-gold" href={getMailtoHref()}>Email</GatedLink>
          {socialLinks.map(({ href, label }) => (
            <a key={href} className="no-underline text-white/85 hover:text-gold" href={href} target="_blank" rel="noopener">{label}</a>
          ))}
        </div>
      </div>
    </footer>
  )
}
