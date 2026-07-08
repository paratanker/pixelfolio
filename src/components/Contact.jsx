import Level from './Level'
import LevelNav from './LevelNav'
import GatedLink from './GatedLink'
import { getMailtoHref, getWhatsAppHref } from '../utils/contact'
import { CARD, EYEBROW, HEADING, BTN_BASE } from '../styles'
import content from '../data/content.json'

const { eyebrow, title, description, footerNote } = content.contactSection
const { resumeMessage } = content.contact
const socialLinks = content.social.filter(({ href }) => href)

export default function Contact() {
  return (
    <Level id="contact" className="bg-lvl-contact text-center" contentClassName="flex flex-col items-center justify-center" walkerSrc="/characters/2.png">
      <div className={`${CARD} reveal max-w-[44em]`}>
        <p className={EYEBROW}>{eyebrow}</p>
        <h2 className={`${HEADING} text-[clamp(1.4rem,4vw,2.1rem)] leading-[1.5]`}>{title}</h2>
        <p className="text-white/[0.88] text-[1.02rem] max-w-[32em] mt-[1.1rem] mx-auto">{description}</p>
        <div className="flex justify-center flex-wrap gap-4 mt-8">
          <GatedLink className={`${BTN_BASE} bg-red text-white`} href={getWhatsAppHref(resumeMessage)} target="_blank" rel="noopener">WhatsApp Me</GatedLink>
          <GatedLink className={`${BTN_BASE} bg-gold text-ink`} href={getMailtoHref()}>Email</GatedLink>
          {socialLinks.map(({ href, label }) => (
            <a key={href} className={`${BTN_BASE} bg-gold text-ink`} href={href} target="_blank" rel="noopener">{label}</a>
          ))}
        </div>
        <p className="font-mono text-[0.78rem] text-white/60 mt-5">{footerNote}</p>
      </div>

      <LevelNav
        prev={{ href: '#credentials', label: 'Previous: Trophies' }}
        loop={{ href: '#top' }}
      />
    </Level>
  )
}
