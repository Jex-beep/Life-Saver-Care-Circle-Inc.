// Entrance stagger powered by anime.js (animejs.com), respecting reduced motion
import { useEffect } from 'react'
import { animate, stagger } from 'animejs'

export default function useStagger(selector, deps = []) {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const els = document.querySelectorAll(selector)
    if (els.length === 0) return
    animate(els, {
      opacity: [0, 1],
      translateY: [14, 0],
      delay: stagger(55),
      duration: 420,
      ease: 'outQuad',
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
