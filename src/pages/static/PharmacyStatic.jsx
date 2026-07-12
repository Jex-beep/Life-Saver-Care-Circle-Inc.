import { Link } from 'react-router-dom'
import PageHeader from '../../components/PageHeader.jsx'
import { PillIcon, MapPinIcon, CheckIcon, HeartPulseIcon } from '../../components/Icons.jsx'
import { PHARMACY_BRANCHES } from '../../data/branches.js'

const HIGHLIGHTS = [
  {
    Icon: PillIcon,
    title: 'Essential & Outpatient Medicines',
    text: 'Maintenance medicines, antibiotics, vitamins, and everyday remedies — available over the counter at branch prices.',
  },
  {
    Icon: CheckIcon,
    title: 'PhilHealth Gamot Partner',
    text: 'PhilHealth members may avail of covered outpatient medicines at our Gamot partner pharmacies.',
  },
  {
    Icon: HeartPulseIcon,
    title: 'Pharmacist Guidance',
    text: 'Our licensed pharmacists help with prescriptions, generics, dosage guidance, and medicine adherence.',
  },
]

export default function PharmacyStatic() {
  return (
    <>
      <PageHeader eyebrow="Pharmacy" title="Life Saver Pharmacies">
        Affordable essential medicines at our <span className="badge badge-gamot">Gamot</span> partner
        pharmacies — where PhilHealth members may avail of their outpatient medicines.
      </PageHeader>

      <section className="section page section-tight">
        <div className="services-grid pharmacy-highlights">
          {HIGHLIGHTS.map(({ Icon, title, text }) => (
            <div key={title} className="service-card">
              <span className="service-icon">
                <Icon size={26} />
              </span>
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          ))}
        </div>

        <div className="pharmacy-locations">
          <span className="section-eyebrow">Where to find us</span>
          <h2>Our Pharmacy Locations</h2>
          <p className="section-sub">
            Visit any branch below — bring your prescription and PhilHealth ID for covered medicines.
          </p>
          <div className="branch-grid">
            {PHARMACY_BRANCHES.map((b) => (
              <div key={b.id} className="branch-card">
                <div className="branch-badges">
                  <span className="badge badge-gamot">
                    {b.target_client.includes('Drug Store') ? 'Pharmacy' : 'Gamot'}
                  </span>
                </div>
                <h3>{b.name}</h3>
                <p className="branch-loc">
                  <MapPinIcon size={14} className="inline-icon" /> {b.city}, {b.province} · {b.area}
                </p>
                <p className="branch-addr muted small">Open Mon–Sat, 8:00 AM – 5:00 PM</p>
              </div>
            ))}
          </div>
        </div>

        <p className="section-cta">
          <Link to="/branches" className="btn btn-primary">
            See All Branches
          </Link>
        </p>
      </section>
    </>
  )
}
