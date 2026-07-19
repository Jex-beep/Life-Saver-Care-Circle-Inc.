import { useEffect, useState } from 'react'

/**
 * Full-viewport page-by-page layout (no document scrolling).
 * Designed for older visitors: very large, labeled Next/Back buttons on the
 * screen edges, a progress line naming the next page, and keyboard arrows.
 *
 * pages: [{ id, label, content, scroll?: true }]
 *   - `scroll: true` lets that page's content scroll internally
 *     (safety valve for dense interactive pages like booking or catalogs).
 */
export default function Pager({ pages }) {
  const [idx, setIdx] = useState(0)
  const count = pages.length
  const canPrev = idx > 0
  const canNext = idx < count - 1

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest('input, textarea, select')) return
      if (e.key === 'ArrowRight' && idx < count - 1) setIdx(idx + 1)
      if (e.key === 'ArrowLeft' && idx > 0) setIdx(idx - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [idx, count])

  if (count === 0) return null

  return (
    <div className="pager">
      <div className="pager-track" style={{ transform: `translateX(-${idx * 100}%)` }}>
        {pages.map((p) => (
          <section
            key={p.id}
            className={`pager-page ${p.scroll ? 'pager-page-scroll' : ''}`}
            aria-hidden={pages[idx].id !== p.id}
          >
            <div className="pager-page-inner">{p.content}</div>
          </section>
        ))}
      </div>

      {canPrev && (
        <button type="button" className="pager-nav pager-prev" onClick={() => setIdx(idx - 1)}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          <span>Back</span>
        </button>
      )}
      {canNext && (
        <button type="button" className="pager-nav pager-next" onClick={() => setIdx(idx + 1)}>
          <span>Next</span>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      )}

      <div className="pager-progress">
        {pages.map((p, i) => (
          <button
            key={p.id}
            type="button"
            className={`pager-dot ${i === idx ? 'active' : ''}`}
            aria-label={`Go to page ${i + 1}: ${p.label}`}
            onClick={() => setIdx(i)}
          />
        ))}
        <span className="pager-caption">
          Page {idx + 1} of {count}
          {canNext && (
            <>
              {' '}
              · Next: <strong>{pages[idx + 1].label}</strong>
            </>
          )}
        </span>
      </div>
    </div>
  )
}
