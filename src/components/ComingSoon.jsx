import { Link } from 'react-router-dom'

/**
 * Full-page "Coming soon" placeholder for features that aren't live yet.
 * Drops into a Pager page in place of the real content. The underlying
 * page code is left intact in its file so it can be restored later.
 */
export default function ComingSoon({ eyebrow, title, note }) {
  return (
    <div className="hp-section coming-soon">
      {eyebrow && <span className="section-eyebrow">{eyebrow}</span>}
      <span className="coming-soon-badge">Coming soon</span>
      <h2 className="coming-soon-title">{title}</h2>
      <p className="section-sub coming-soon-note">
        {note || "We're putting the finishing touches on this. Please check back shortly."}
      </p>
      <Link to="/" className="btn btn-secondary coming-soon-back">Back to Home</Link>
    </div>
  )
}
