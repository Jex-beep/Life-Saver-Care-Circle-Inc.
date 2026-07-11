import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import BlurText from '../components/bits/BlurText.jsx'
import CountUp from '../components/bits/CountUp.jsx'
import {
  HeartIcon,
  MapPinIcon,
  ShieldCheckIcon,
  AwardIcon,
  LightbulbIcon,
  UsersIcon,
  HeartPulseIcon,
} from '../components/Icons.jsx'

const MISSION = [
  'Provide accessible, affordable, and quality primary healthcare through a growing nationwide network of YAKAP clinics.',
  'Improve access to essential and outpatient medicines through a comprehensive GAMOT provider and pharmacy network.',
  'Strengthen preventive healthcare and community-based healthcare delivery in support of Universal Health Care.',
  'Build strategic partnerships with government, communities, healthcare professionals, investors, and private sector partners.',
  'Utilize technology, data, and innovation to improve healthcare access, operational efficiency, financial visibility, and health outcomes.',
  'Develop competent, compassionate, and mission-driven healthcare workers, managers, and leaders.',
  'Sustain operations through sound financial management, responsible growth, and measurable social impact.',
]

const VALUES = [
  {
    Icon: HeartIcon,
    name: 'Compassion',
    text: 'We serve patients and communities with empathy, dignity, and genuine concern.',
  },
  {
    Icon: MapPinIcon,
    name: 'Accessibility',
    text: 'We believe healthcare must be reachable, affordable, and available to Filipino families.',
  },
  {
    Icon: ShieldCheckIcon,
    name: 'Integrity',
    text: 'We uphold ethical healthcare practices, transparency, accountability, and responsible stewardship of resources.',
  },
  {
    Icon: AwardIcon,
    name: 'Excellence',
    text: 'We pursue high standards in service delivery, operations, compliance, and patient experience.',
  },
  {
    Icon: LightbulbIcon,
    name: 'Innovation',
    text: 'We use technology, data, and new operating models to improve healthcare access and efficiency.',
  },
  {
    Icon: UsersIcon,
    name: 'Collaboration',
    text: 'We work with government, communities, healthcare partners, and stakeholders to advance shared health goals.',
  },
  {
    Icon: HeartPulseIcon,
    name: 'Prevention First',
    text: 'We promote preventive care, early intervention, medicine adherence, and healthier communities.',
  },
]

function ChapterHead({ num, label, light = false }) {
  return (
    <div className={`ab-head ${light ? 'light' : ''}`}>
      <span className="ab-head-num">{num}</span>
      <span className="ab-head-rule" aria-hidden="true" />
      <span className="ab-head-label">{label}</span>
    </div>
  )
}

export default function About() {
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  return (
    <article className="ab">
      {/* ---- Cover: full-bleed editorial hero ---- */}
      <header className="ab-cover">
        <img src="/about/ls-front-picture-about.jpg" alt="" className="ab-cover-img" aria-hidden="true" />
        <div className="ab-cover-scrim" aria-hidden="true" />
        <div className="ab-cover-text">
          <p className="ab-kicker">Life Saver Care Circle Inc. · Est. 20+ years</p>
          <h1 className="ab-title">
            <BlurText text="Care that reaches" delay={110} animateBy="words" className="ab-title-line" />
            <BlurText text="every community." delay={110} animateBy="words" className="ab-title-line" />
          </h1>
        </div>
      </header>

      {/* ---- Overlapping stat bar ---- */}
      <div className="ab-statbar" role="list">
        <div role="listitem">
          <strong><CountUp to={20} duration={2} />+</strong>
          <span>Years of service</span>
        </div>
        <div role="listitem">
          <strong><CountUp to={13} duration={2} />+</strong>
          <span>Branches nationwide</span>
        </div>
        <div role="listitem">
          <strong><CountUp to={15} duration={2} />k</strong>
          <span>Patients served</span>
        </div>
        <div role="listitem">
          <strong>Yakap · Gamot</strong>
          <span>PhilHealth programs</span>
        </div>
      </div>

      {/* ---- 01 · Our Story ---- */}
      <section className="ab-section">
        <ChapterHead num="01" label="Our Story" />
        <div className="ab-story">
          <div className="ab-story-text">
            <p className="ab-lead">
              Life Saver is a growing network of PhilHealth-accredited <strong>Yakap</strong> clinics and{' '}
              <strong>Gamot</strong> partner pharmacies — primary care and affordable medicines, closer to
              Filipino families.
            </p>
            <p>
              From our clinics in NCR and Rizal to Southern Luzon and the Visayas, every branch follows one
              standard of care. Yakap facilities deliver PhilHealth-accredited primary care, while Gamot partner
              pharmacies let members avail of their essential medicines.
            </p>
            <p>
              Beyond our branches, our mobile clinics bring consultations, diagnostics, and vaccinations directly
              to barangays, workplaces, and community events — because preventive care works best when it comes
              to you.
            </p>
            <Link to="/branches" className="ab-arrow-link">
              Explore our branches <span aria-hidden="true">→</span>
            </Link>
          </div>
          <div className="ab-collage">
            <img
              src="/about/ls-serving-medicin.jpg"
              alt="Life Saver staff serving medicines to patients"
              className="ab-collage-main"
              loading="lazy"
            />
            <img
              src="/about/ls-serving-people-gym-portrait.jpg"
              alt="Community healthcare service at a local venue"
              className="ab-collage-offset"
              loading="lazy"
            />
          </div>
        </div>
      </section>

      {/* ---- 02 · Vision: cinematic dark band ---- */}
      <section className="ab-vision">
        <div className="ab-vision-inner">
          <ChapterHead num="02" label="Our Vision · Life Saver 2030" light />
          <p className="ab-vision-text">
            To become the most trusted and accessible preventive healthcare network in the Philippines —
            empowering every Filipino through quality primary care, affordable medicines, innovative healthcare
            solutions, and community-based healthcare services.
          </p>
        </div>
      </section>

      {/* ---- 03 · Mission: editorial numbered index ---- */}
      <section className="ab-section">
        <ChapterHead num="03" label="Our Mission" />
        <p className="ab-mission-intro">Life Saver Medical Services commits to:</p>
        <ol className="ab-missions">
          {MISSION.map((item, i) => (
            <li key={i} className="ab-mission">
              <span className="ab-mission-num" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
              <p>{item}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ---- 04 · Core Values: rule-separated rows ---- */}
      <section className="ab-section">
        <ChapterHead num="04" label="Core Values" />
        <div className="ab-values">
          {VALUES.map(({ Icon, name, text }) => (
            <div key={name} className="ab-value">
              <div className="ab-value-name">
                <Icon size={20} />
                <h3>{name}</h3>
              </div>
              <p>{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---- 05 · In the field: asymmetric mosaic ---- */}
      <section className="ab-section">
        <ChapterHead num="05" label="In the Field" />
        <div className="ab-mosaic">
          <figure className="ab-mosaic-big">
            <img src="/about/ls-mobile-clinic-with-team.jpg" alt="Our mobile clinic team on deployment" loading="lazy" />
            <figcaption>Mobile clinic team on deployment</figcaption>
          </figure>
          <figure>
            <img src="/about/ls-swab-test.jpg" alt="Diagnostic services in the community" loading="lazy" />
            <figcaption>Community diagnostics</figcaption>
          </figure>
          <figure>
            <img src="/about/injecting-a-patient.jpg" alt="Vaccination and preventive care" loading="lazy" />
            <figcaption>Vaccination drives</figcaption>
          </figure>
        </div>
      </section>

      {/* ---- Closing CTA: minimal editorial ---- */}
      <section className="ab-cta">
        <p className="ab-kicker dark">Ready when you are</p>
        <h2>Be part of healthier communities.</h2>
        <div className="ab-cta-actions">
          <Link to="/book" className="btn btn-primary">Book an Appointment</Link>
          <Link to="/pharmacy" className="ab-arrow-link">
            Order medicines <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>
    </article>
  )
}
