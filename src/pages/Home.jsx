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
    description: 'Comprehensive check-ups and health assessments with our experienced physicians.',
  },
  {
    Icon: BeakerIcon,
    title: 'Laboratory Services',
    description: 'Fast and accurate diagnostic testing, from blood work to specialized screenings.',
  },
  {
    Icon: SyringeIcon,
    title: 'Vaccination',
    description: 'Routine immunizations and travel vaccines for patients of all ages.',
  },
  {
    Icon: FileTextIcon,
    title: 'Medical Certificates',
    description: 'Fit-to-work and other medical certificates, processed the same day.',
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
  const [prevBgIndex, setPrevBgIndex] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setBgIndex((i) => (i + 1) % HERO_BG_IMAGES.length)
    }, 10000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="hero-wrap hp-hero">
      <img className="hero-bg-layer hero-bg-back" src={HERO_BG_IMAGES[prevBgIndex]} alt="" aria-hidden="true" />
      <img
        key={bgIndex}
        className="hero-bg-layer hero-bg-front"
        src={HERO_BG_IMAGES[bgIndex]}
        alt=""
        aria-hidden="true"
        onAnimationEnd={() => setPrevBgIndex(bgIndex)}
      />
      <div className="hero-aurora">
        <Aurora colorStops={['#6c70d6', '#ff9a3d', '#e8384f']} amplitude={1.1} blend={0.55} speed={0.8} />
      </div>
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
        <div className="hp-hero-stats">
          <div className="stat">
            <span className="stat-number"><CountUp to={20} duration={2} />+</span>
            <span className="stat-label">Years of Service</span>
          </div>
          <div className="stat">
            <span className="stat-number"><CountUp to={13} duration={2} />+</span>
            <span className="stat-label">Branches</span>
          </div>
          <div className="stat">
            <span className="stat-number"><CountUp to={15} duration={2} />k</span>
            <span className="stat-label">Patients Served</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function ServicesPage() {
  return (
    <div className="hp-section">
      <span className="section-eyebrow">What we offer</span>
      <h2>Our Services</h2>
      <p className="section-sub">A full range of medical services under one roof — same list at every clinic.</p>
      <div className="services-grid hp-services">
        {SERVICES.map(({ Icon, title, description }) => (
          <div key={title} className="service-card">
            <span className="service-icon"><Icon size={30} /></span>
            <h3>{title}</h3>
            <p>{description}</p>
          </div>
        ))}
      </div>
      <p className="section-cta">
        {STATIC_MODE ? (
          <Link to="/branches" className="btn btn-primary">Visit a Yakap Clinic</Link>
        ) : (
          <Link to="/book" className="btn btn-primary">Book a Service</Link>
        )}
      </p>
    </div>
  )
}

function AboutPage() {
  return (
    <div className="hp-section">
      <div className="about-inner hp-about">
        <div className="about-text">
          <span className="section-eyebrow">Who we are</span>
          <h2>About Us</h2>
          <ul className="about-list">
            <li><CheckIcon size={20} className="list-check" /> PhilHealth-accredited primary care clinics</li>
            <li><CheckIcon size={20} className="list-check" /> Gamot partner pharmacies</li>
            <li><CheckIcon size={20} className="list-check" /> Corporate-managed branches, one standard of care</li>
          </ul>
          <p className="section-cta" style={{ textAlign: 'left' }}>
            <Link to="/about" className="btn btn-secondary">Read Our Full Story</Link>
          </p>
        </div>
        <div className="about-photos">
          <img src="/ls-stalls.jpg" alt="Life Saver community health outreach booth" loading="lazy" />
          <img src="/people-gathering.jpg" alt="Community members gathered at a Life Saver health event" loading="lazy" />
        </div>
      </div>
      <div className="facilities-grid hp-facilities">
        {FACILITIES.map((f) => (
          <figure key={f.src} className="facility-card">
            <img src={f.src} alt={f.caption} loading="lazy" />
            <figcaption>{f.caption}</figcaption>
          </figure>
        ))}
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
    { id: 'contact', label: 'Contact Us', content: <FooterPage /> },
  ]

  return <Pager pages={pages} />
}
