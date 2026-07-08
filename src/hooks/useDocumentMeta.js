import { useEffect } from 'react'
import content from '../data/content.json'

export function useDocumentMeta() {
  useEffect(() => {
    document.title = content.site.title

    let meta = document.querySelector('meta[name="description"]')
    if (!meta) {
      meta = document.createElement('meta')
      meta.setAttribute('name', 'description')
      document.head.appendChild(meta)
    }
    meta.setAttribute('content', content.site.description)
  }, [])
}
