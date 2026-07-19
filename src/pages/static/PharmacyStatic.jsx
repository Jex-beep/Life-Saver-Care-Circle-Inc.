import Pager from '../../components/Pager.jsx'
import FooterPage from '../../components/FooterPage.jsx'
import BranchFinder from '../../components/BranchFinder.jsx'
import { PillIcon, CheckIcon, HeartPulseIcon } from '../../components/Icons.jsx'
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
  const pages = [
    {
      id: 'pharmacy',
      label: 'Our Pharmacies',
      content: (
        <div className="hp-section">
          <span className="section-eyebrow">Pharmacy</span>
          <h2>Life Saver Pharmacies</h2>
          <p className="section-sub">
            Affordable essential medicines at our <span className="badge badge-gamot">Gamot</span> partner
            pharmacies — bring your prescription and PhilHealth ID.
          </p>
          <div className="services-grid pharmacy-highlights" style={{ marginBottom: 0 }}>
            {HIGHLIGHTS.map(({ Icon, title, text }) => (
              <div key={title} className="service-card">
                <span className="service-icon"><Icon size={26} /></span>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      id: 'locations',
      label: 'Pharmacy Locations',
      scroll: true,
      content: (
        <div className="hp-section finder-section">
          <span className="section-eyebrow">Where to find us</span>
          <h2>Find the Nearest Pharmacy</h2>
          <p className="section-sub">
            Press <strong>Use My Location</strong> or type your area, and we'll show the closest branch.
          </p>
          <BranchFinder branches={PHARMACY_BRANCHES} />
        </div>
      ),
    },
    { id: 'contact', label: 'Contact Us', content: <FooterPage /> },
  ]

  return <Pager pages={pages} />
}
