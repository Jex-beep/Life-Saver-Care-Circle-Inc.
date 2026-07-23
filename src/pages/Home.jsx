import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { STATIC_MODE } from '../config.js'
import { api } from '../api.js'
import Aurora from '../components/bits/Aurora.jsx'
import BlurText from '../components/bits/BlurText.jsx'
import CountUp from '../components/bits/CountUp.jsx'
import Pager from '../components/Pager.jsx'
import FooterPage from '../components/FooterPage.jsx'
import {
  HeartPulseIcon,
  BeakerIcon,
  SyringeIcon,
  FileTextIcon,
  CheckIcon,
  MegaphoneIcon,
} from '../components/Icons.jsx'

const SERVICES = [
  {
    Icon: HeartPulseIcon,
    title: 'General Consultation',
    description: 'Everyday checkups, symptoms review, follow-ups, and family care planning.',
    duration: '20–30 min',
    image: '/ls-hero-image.jpg',
    tags: ['Adult and pediatric concerns', 'Blood pressure and vital signs', 'Follow-up advice and referrals'],
  },
  {
    Icon: BeakerIcon,
    title: 'Laboratory Services',
    description: 'Reliable diagnostic testing for routine monitoring and physician requests.',
    duration: '15–45 min',
    image: '/ls-stock-image2.jpg',
    tags: ['Blood work and screenings', 'Same-day results on select tests', 'Physician-requested panels'],
  },
  {
    Icon: SyringeIcon,
    title: 'Vaccination',
    description: 'Routine and travel vaccine support for children, adults, and families.',
    duration: '10–15 min',
    image: '/ls-injection.jpg',
    tags: ['Routine immunizations', 'Travel vaccines', 'All ages welcome'],
  },
  {
    Icon: FileTextIcon,
    title: 'Medical Certificates',
    description: 'Fit-to-work and other certificates processed after proper clinical assessment.',
    duration: 'Same day',
    image: '/ls-givingmedicine.jpg',
    tags: ['Fit-to-work certificates', 'Pre-employment clearance', 'Processed same day'],
  },
]

const FACILITIES = [
  { src: '/ls-stock-image2.jpg', caption: 'PhilHealth Yakap Primary Care Clinics' },
  { src: '/dentist-office.jpg', caption: 'Modern treatment rooms and equipment' },
  { src: '/ls-stock-image.jpg', caption: 'Mobile clinics bringing care to your barangay' },
]

const HERO_BG_IMAGES = ['/ls-hero-image.jpg', '/ls-givingmedicine.jpg', '/ls-injection.jpg']

const CATEGORY_LABELS = { news: 'News', hiring: "We're Hiring", advisory: 'Advisory' }

function HeroPage() {
  const [bgIndex, setBgIndex] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setBgIndex((i) => (i + 1) % HERO_BG_IMAGES.length)
    }, 5000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="hero-wrap hp-hero">
      {HERO_BG_IMAGES.map((src, i) => (
        <img
          key={src}
          className={`hero-bg-layer ${i === bgIndex ? 'is-active' : ''}`}
          src={src}
          alt=""
          aria-hidden="true"
        />
      ))}
      <div className="hero hp-hero-inner">
        <div className="hero-content">
          <p className="hero-eyebrow">Your health, our priority</p>
          <h1 className="hero-heading">
            <BlurText text="Quality Care for" delay={120} animateBy="words" className="hero-line" />
            <BlurText text="You & Your Family" delay={120} animateBy="words" className="hero-line highlight" />
          </h1>
          <p className="hero-text">
            PhilHealth-accredited clinics and pharmacies across Luzon and Visayas. Book a visit at your preferred
            branch or order your medicines online.
          </p>
          <div className="hero-actions">
            {STATIC_MODE ? (
              <>
                <Link to="/branches" className="btn btn-primary">Find a Yakap Clinic</Link>
                <Link to="/pharmacy" className="btn btn-secondary">Our Pharmacies</Link>
              </>
            ) : (
              <>
                <Link to="/book" className="btn btn-primary">Book an Appointment</Link>
                <Link to="/pharmacy" className="btn btn-secondary">Order Medicines</Link>
              </>
            )}
          </div>
          <div className="hero-badges">
            <span className="badge badge-yakap">Yakap</span> PhilHealth-accredited Primary Care
            <span className="badge badge-gamot">Gamot</span> PhilHealth medicine partner
          </div>
        </div>
      </div>
    </div>
  )
}

function ServicesPage() {
  const [selected, setSelected] = useState(0)
  const service = SERVICES[selected]

  return (
    <div className="hero-wrap svc-page-wrap">
      <div className="hero-aurora">
        <Aurora colorStops={['#6c70d6', '#ff9a3d', '#e8384f']} amplitude={1.1} blend={0.55} speed={0.8} />
      </div>
      <div className="hp-section svc-page-inner">
        <span className="section-eyebrow">What we offer</span>
        <div className="svc-layout">
          <div className="svc-list">
            {SERVICES.map((s, i) => (
              <button
                key={s.title}
                type="button"
                className={`svc-list-item ${i === selected ? 'is-active' : ''}`}
                onClick={() => setSelected(i)}
              >
                <span className="svc-list-num">{String(i + 1).padStart(2, '0')}</span>
                <h3>{s.title}</h3>
                <p>{s.description}</p>
              </button>
            ))}
          </div>

          <div className="svc-showcase">
            <div className="svc-showcase-media" style={{ backgroundImage: `url(${service.image})` }}>
              <div className="svc-showcase-scrim" />
              <div className="svc-showcase-content">
                <span className="svc-showcase-duration">Typical visit: {service.duration}</span>
                <h3>{service.title}</h3>
                <p>{service.description}</p>
                <div className="svc-showcase-tags">
                  {service.tags.map((t) => (
                    <span key={t} className="svc-tag">{t}</span>
                  ))}
                </div>
              </div>
            </div>
            <div className="svc-showcase-footer">
              <p>Add real branch availability later, but keep this page focused on helping patients decide and book.</p>
              {STATIC_MODE ? (
                <Link to="/branches" className="btn btn-primary">Book this service</Link>
              ) : (
                <Link to="/book" className="btn btn-primary">Book this service</Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function AboutPage() {
  return (
    <div className="hp-section ab-home">
      <div className="ab-home-intro">
        <div className="ab-home-heading">
          <span className="section-eyebrow ab-home-eyebrow">About Life Saver</span>
          <h2 className="ab-home-title">A healthcare network built around everyday Filipino families.</h2>
        </div>
        <div className="ab-home-copy">
          <p>
            Life Saver brings together primary care clinics, Yakap assistance, and pharmacy
            coordination so patients can move from concern to consultation to medicine support
            with less confusion.
          </p>
        </div>
      </div>

      <div className="ab-home-mosaic">
        <figure className="ab-home-mosaic-big">
          <img src="/ls-stalls.jpg" alt="Life Saver medical team" loading="lazy" />
          <figcaption>
            <span className="ab-home-kicker">Our Promise</span>
            <p>Care should feel organized, local, and human.</p>
          </figcaption>
        </figure>
        <figure className="ab-home-mosaic-small">
          <img src="/ls-givingmedicine.jpg" alt="Primary care consultation" loading="lazy" />
          <figcaption>Primary care made easier to reach</figcaption>
        </figure>
        <figure className="ab-home-mosaic-small">
          <img src="/dentist-office.jpg" alt="Clinic facilities and equipment" loading="lazy" />
          <figcaption>Organized facilities and equipment</figcaption>
        </figure>
      </div>
    </div>
  )
}

function NewsPage({ announcements }) {
  return (
    <div className="hp-section">
      <span className="section-eyebrow">What's new</span>
      <h2>News &amp; Announcements</h2>
      <p className="section-sub">Updates, advisories, and openings from Life Saver.</p>
      <div className="ann-grid">
        {announcements.map((a) => (
          <article key={a.id} className="ann-card">
            <div className="ann-card-head">
              <span className={`ann-chip ann-${a.category}`}>
                <MegaphoneIcon size={13} /> {CATEGORY_LABELS[a.category] || 'News'}
              </span>
              <time dateTime={a.published_at}>
                {new Date(a.published_at).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}
              </time>
            </div>
            <h3>{a.title}</h3>
            {a.body && <p className="ann-body">{a.body}</p>}
          </article>
        ))}
      </div>
    </div>
  )
}

export default function Home() {
  const [announcements, setAnnouncements] = useState([])

  useEffect(() => {
    if (STATIC_MODE) return
    api.get('/announcements?limit=4').then(setAnnouncements).catch(() => {})
  }, [])

  const pages = [
    { id: 'welcome', label: 'Welcome', content: <HeroPage /> },
    { id: 'services', label: 'Our Services', content: <ServicesPage /> },
    { id: 'about', label: 'About Us', content: <AboutPage /> },
    ...(announcements.length > 0
      ? [{ id: 'news', label: 'News & Announcements', content: <NewsPage announcements={announcements} /> }]
      : []),
    { id: 'contact', label: 'Contact Us', content: <FooterPage />, scroll: true },
  ]

  return <Pager pages={pages} />
}
