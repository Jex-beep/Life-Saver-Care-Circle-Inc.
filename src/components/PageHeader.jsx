export default function PageHeader({ eyebrow, title, children }) {
  return (
    <div className="page-header">
      <div className="page-header-inner">
        {eyebrow && <span className="section-eyebrow">{eyebrow}</span>}
        <h2>{title}</h2>
        {children && <p className="page-header-sub">{children}</p>}
      </div>
    </div>
  )
}
