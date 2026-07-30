import { useEffect, useState } from 'react'

/**
 * One markup, two layouts — the switch is pure CSS so it can never get out of
 * sync with the viewport (see mobile.css):
 *
 * Desktop — full-viewport horizontal pages, no document scrolling, with large
 * labeled Back/Next controls for older visitors.
 *
 * Mobile (≤860px) — the same pages stack into one natural vertical scroll,
 * each introduced by a numbered heading, since phones are too narrow to page
 * sideways comfortably.
 *
 * pages: [{ id, label, content, scroll?: true }]
 */
export default function Pager({ pages }) {
  const [idx, setIdx] = useState(0)
  const count = pages.length
  const canPrev = idx > 0
  const canNext = idx < count - 1

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest('input, textarea, select')) return
      if (window.matchMedia('(max-width: 860px)').matches) return
      if (e.key === 'ArrowRight' && idx < count - 1) setIdx(idx + 1)
      if (e.key === 'ArrowLeft' && idx > 0) setIdx(idx - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [idx, count])

  if (count === 0) return null

  return (
    <div className="pager">
      {/* --page drives the desktop slide; mobile CSS ignores it */}
      <div className="pager-track" style={{ '--page': idx }}>
        {pages.map((p) => (
          <section
            key={p.id}
            id={`section-${p.id}`}
            className={`pager-page ${p.scroll ? 'pager-page-scroll' : ''}`}
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
