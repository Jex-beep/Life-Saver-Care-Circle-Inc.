import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import Aurora from '../components/bits/Aurora.jsx'
import BlurText from '../components/bits/BlurText.jsx'
import CountUp from '../components/bits/CountUp.jsx'
import { HeartPulseIcon, BeakerIcon, SyringeIcon, FileTextIcon, CheckIcon } from '../components/Icons.jsx'

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

// Images cycled in the hero photo card
const HERO_IMAGES = [
  '/ls-stock-image2.jpg',
  '/dentist-office.jpg',
  '/ls-injection.jpg',
]

// Images cycled behind the whole hero section (swap these for whichever background shots you want)
const HERO_BG_IMAGES = [
  '/ls-hero-image.jpg',
  '/ls-givingmedicine.jpg',
  '/ls-injection.jpg',
]

export default function Home() {
  const location = useLocation()
  const [bgIndex, setBgIndex] = useState(0)
  const [prevBgIndex, setPrevBgIndex] = useState(0)

  useEffect(() => {
    if (location.hash) {
      document.querySelector(location.hash)?.scrollIntoView({ behavior: 'smooth' })
    } else {
      window.scrollTo(0, 0)
    }
  }, [location])

  useEffect(() => {
    const id = setInterval(() => {
      setBgIndex((i) => (i + 1) % HERO_BG_IMAGES.length)
    }, 10000)
    return () => clearInterval(id)
  }, [])

  return (
    <>
      <section id="home" className="hero-wrap">
        <img
          className="hero-bg-layer hero-bg-back"
          src={HERO_BG_IMAGES[prevBgIndex]}
          alt=""
          aria-hidden="true"
        />
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
        <div className="hero">
          <div className="hero-content">
            <p className="hero-eyebrow">Your health, our priority</p>
            <h1 className="hero-heading">
              <BlurText text="Quality Care for" delay={120} animateBy="words" className="hero-line" />
              <BlurText
                text="You & Your Family"
                delay={120}
                animateBy="words"
                className="hero-line highlight"
              />
            </h1>
            <p className="hero-text">
              PhilHealth-accredited clinics and pharmacies across Luzon and Visayas. Book a visit at your
              preferred branch or order your medicines online.
            </p>
            <div className="hero-actions">
              <Link to="/book" className="btn btn-primary">
                Book an Appointment
              </Link>
              <Link to="/pharmacy" className="btn btn-secondary">
                Order Medicines
              </Link>
            </div>
            <div className="hero-badges">
              <span className="badge badge-yakap">Yakap</span> PhilHealth-accredited Primary Care
              <span className="badge badge-gamot">Gamot</span> PhilHealth medicine partner
            </div>
          </div>
          <div className="hero-visual">
            <div className="hero-photo-card">
              <img
                src={HERO_IMAGES[0]}
                alt="Life Saver PhilHealth Yakap Primary Care Clinic"
              />
              <div className="hero-photo-caption">
                <p className="hero-card-title">
                  <CountUp to={13} duration={1.5} />+ Branches
                </p>
                <p className="hero-card-sub">NCR · Rizal · Southern Luzon · Visayas</p>
                <Link to="/branches" className="hero-card-link">
                  Find the branch nearest you →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="services" className="section">
        <span className="section-eyebrow">What we offer</span>
        <h2>Our Services</h2>
        <p className="section-sub">A full range of medical services under one roof — same list at every clinic.</p>
        <div className="services-grid">
          {SERVICES.map(({ Icon, title, description }) => (
            <div key={title} className="service-card">
              <span className="service-icon">
                <Icon size={28} />
              </span>
              <h3>{title}</h3>
              <p>{description}</p>
            </div>
          ))}
        </div>
        <p className="section-cta">
          <Link to="/book" className="btn btn-primary">
            Book a Service
          </Link>
        </p>
      </section>

      <section className="section facilities">
        <span className="section-eyebrow">Our facilities</span>
        <h2>Inside Our Clinics</h2>
        <p className="section-sub">Clean, modern facilities — from our clinics to our mobile health units.</p>
        <div className="facilities-grid">
          {FACILITIES.map((f) => (
            <figure key={f.src} className="facility-card">
              <img src={f.src} alt={f.caption} loading="lazy" />
              <figcaption>{f.caption}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section id="about" className="section section-alt">
        <div className="about-inner">
          <div className="about-text">
            <span className="section-eyebrow">Who we are</span>
            <h2>About Us</h2>
            <p>
              For over 20 years, Life Saver Care Circle has served our community with compassionate,
              patient-centered care. Our clinics are <strong>Yakap</strong> facilities — PhilHealth-accredited
              Primary Care — and our <strong>Gamot</strong> partner pharmacies let PhilHealth members avail of
              their medicines.
            </p>
            <ul className="about-list">
              <li><CheckIcon size={18} className="list-check" /> PhilHealth-accredited primary care clinics</li>
              <li><CheckIcon size={18} className="list-check" /> Gamot partner pharmacies</li>
              <li><CheckIcon size={18} className="list-check" /> Corporate-managed branches, one standard of care</li>
            </ul>
            <div className="about-stats">
              <div className="stat">
                <span className="stat-number">
                  <CountUp to={20} duration={2} />+
                </span>
                <span className="stat-label">Years of Service</span>
              </div>
              <div className="stat">
                <span className="stat-number">
                  <CountUp to={13} duration={2} />+
                </span>
                <span className="stat-label">Branches</span>
              </div>
              <div className="stat">
                <span className="stat-number">
                  <CountUp to={15} duration={2} />k
                </span>
                <span className="stat-label">Patients Served</span>
              </div>
            </div>
          </div>
          <div className="about-photos">
            <img src="/ls-stalls.jpg" alt="Life Saver community health outreach booth" loading="lazy" />
            <img
              src="/people-gathering.jpg"
              alt="Community members gathered at a Life Saver health event"
              loading="lazy"
            />
          </div>
        </div>
      </section>

      <section id="bookings" className="section booking-banner">
        <div className="booking-banner-content">
          <h2>Ready to Book a Visit?</h2>
          <p>Pick your preferred branch, choose a time slot, and get instant confirmation with a reference number.</p>
          <div className="hero-actions" style={{ justifyContent: 'center' }}>
            <Link to="/book" className="btn btn-light">
              Book an Appointment
            </Link>
            <Link to="/track" className="btn btn-outline-light">
              Track a Booking
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
