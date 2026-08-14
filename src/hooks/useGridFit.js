import { useEffect, useRef, useState } from 'react'

const clamp = (min, value, max) => Math.min(max, Math.max(min, value))

/**
 * Fits a card grid to the space it actually has instead of letting it
 * overflow into a scrollbar.
 *
 * The public pages are one screen each — nothing scrolls, you page across.
 * A fixed "8 per page" breaks that the moment the window is short: three
 * rows of cards need more room than a 720px-tall laptop leaves, so the last
 * row disappears under the pager. This measures the grid's box, works out
 * how many whole cards fit across and down, and reports that as the page
 * size. Whatever doesn't fit becomes another page, which the shop already
 * has controls for.
 *
 * Columns come from a width floor that shrinks with the viewport, so a
 * smaller screen gets narrower cards before it gets fewer of them.
 *
 * Rows are measured, not estimated. How tall a card needs to be depends on
 * how wide it is — a narrow card wraps its medicine name onto three lines —
 * so the caller's height floor is only a starting guess. Once cards are on
 * screen the tallest one becomes the row height. The grid lays rows out at
 * their natural height from the top (never stretched), so a stale
 * measurement leaves empty space rather than cutting a card in half.
 *
 * @returns [ref, { cols, rows, perPage, style }] — spread `style` onto the grid
 */
export default function useGridFit({ minWidth, minHeight, gap = 16, maxPerPage = 24, stackAt = 0 } = {}) {
  const ref = useRef(null)
  const measureRef = useRef(() => {})
  const [fit, setFit] = useState({ cols: 3, rows: 2, perPage: 6 })

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const read = () => {
      /* Below the stacking breakpoint the page becomes one natural vertical
         scroll, so the grid's height is set by its own content. Measuring rows
         against that would feed itself — more rows makes it taller, which
         allows more rows. Hand back a single column and let it all show. */
      if (stackAt > 0 && window.innerWidth <= stackAt) {
        setFit((prev) => (prev.cols === 1 ? prev : { cols: 1, rows: maxPerPage, perPage: maxPerPage }))
        return
      }

      const { width, height } = el.getBoundingClientRect()
      if (width === 0 || height === 0) return

      const floorW = clamp(minWidth.min, window.innerWidth * minWidth.vw, minWidth.max)
      const floorH = clamp(minHeight.min, window.innerHeight * minHeight.vh, minHeight.max)

      const cols = Math.max(1, Math.floor((width + gap) / (floorW + gap)))

      /* Tallest card on screen sets the row height — cards differ by a line or
         two of wrapped text, and sizing to the shortest would clip the rest. */
      const cardHeights = [...el.children].map((c) => c.getBoundingClientRect().height)
      const rowH = Math.max(floorH, ...cardHeights)

      const rows = Math.max(1, Math.floor((height + gap) / (rowH + gap)))
      const perPage = Math.min(maxPerPage, cols * rows)

      setFit((prev) => (prev.cols === cols && prev.rows === rows ? prev : { cols, rows, perPage }))
    }

    /* Read straight away so the grid reacts immediately, then once more on the
       next task: a resize callback can fire while the surrounding layout is
       still settling, and without the second pass a half-finished measurement
       is what sticks.

       Both passes are synchronous rather than deferred to requestAnimationFrame
       — rAF is throttled to nothing in a background or non-painting tab, which
       leaves the grid frozen on whatever it measured first. */
    let settle = 0
    const measure = () => {
      read()
      clearTimeout(settle)
      settle = setTimeout(read, 0)
    }
    measureRef.current = measure

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    /* The root catches viewport changes that don't resize the grid's own box. */
    observer.observe(document.documentElement)
    window.addEventListener('resize', measure)

    return () => {
      clearTimeout(settle)
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [minWidth.min, minWidth.max, minWidth.vw, minHeight.min, minHeight.max, minHeight.vh, gap, maxPerPage, stackAt])

  /* The grid is flex-sized, so its own box never changes when the cards inside
     it do — the observer above stays silent when data finally loads or the
     filter changes the card mix. Re-measuring after every render covers that,
     and it settles immediately: an unchanged result returns the previous state
     object, React bails out, and the cycle stops. */
  useEffect(() => {
    measureRef.current()
  })

  return [
    ref,
    {
      ...fit,
      /* Rows are deliberately not templated — `grid-auto-rows: max-content` in
         CSS keeps every card at its natural height so none can be clipped. */
      style: { gridTemplateColumns: `repeat(${fit.cols}, minmax(0, 1fr))` },
    },
  ]
}
