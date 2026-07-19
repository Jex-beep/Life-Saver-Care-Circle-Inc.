import { Link } from 'react-router-dom'
import { STATIC_MODE } from '../config.js'
import BlurText from '../components/bits/BlurText.jsx'
import CountUp from '../components/bits/CountUp.jsx'
import Pager from '../components/Pager.jsx'
import FooterPage from '../components/FooterPage.jsx'
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
  'Strengthen primary healthcare and community-based healthcare delivery in support of Universal Health Care.',
  'Build strategic partnerships with government, communities, healthcare professionals, investors, and private sector partners.',
  'Utilize technology, data, and innovation to improve healthcare access, operational efficiency, financial visibility, and health outcomes.',
  'Develop competent, compassionate, and mission-driven healthcare workers, managers, and leaders.',
  'Sustain operations through sound financial management, responsible growth, and measurable social impact.',
]

const VALUES = [
  { Icon: HeartIcon, name: 'Compassion', text: 'We serve patients and communities with empathy, dignity, and genuine concern.' },
  { Icon: MapPinIcon, name: 'Accessibility', text: 'We believe healthcare must be reachable, affordable, and available to Filipino families.' },
  { Icon: ShieldCheckIcon, name: 'Integrity', text: 'We uphold ethical healthcare practices, transparency, accountability, and responsible stewardship of resources.' },
  { Icon: AwardIcon, name: 'Excellence', text: 'We pursue high standards in service delivery, operations, compliance, and patient experience.' },
  { Icon: LightbulbIcon, name: 'Innovation', text: 'We use technology, data, and new operating models to improve healthcare access and efficiency.' },
  { Icon: UsersIcon, name: 'Collaboration', text: 'We work with government, communities, healthcare partners, and stakeholders to advance shared health goals.' },
  { Icon: HeartPulseIcon, name: 'Prevention First', text: 'We promote primary care, early intervention, medicine adherence, and healthier communities.' },
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

function CoverPage() {
  return (
    <div className="ab-cover ab-cover-paged">
      <img src="/about/ls-front-picture-about.jpg" alt="" className="ab-cover-img" aria-hidden="true" />
      <div className="ab-cover-scrim" aria-hidden="true" />
      <div className="ab-cover-text">
        <p className="ab-kicker">Life Saver · Est. 20+ years</p>
        <h1 className="ab-title">
          <BlurText text="Care that reaches" delay={110} animateBy="words" className="ab-title-line" />
          <BlurText text="every community." delay={110} animateBy="words" className="ab-title-line" />
        </h1>
        <div className="ab-statbar ab-statbar-paged">
          <div><strong><CountUp to={20} duration={2} />+</strong><span>Years of service</span></div>
          <div><strong><CountUp to={13} duration={2} />+</strong><span>Branches nationwide</span></div>
          <div><strong><CountUp to={15} duration={2} />k</strong><span>Patients served</span></div>
          <div><strong>Yakap · Gamot</strong><span>PhilHealth programs</span></div>
        </div>
      </div>
    </div>
  )
}

function StoryPage() {
  return (
    <div className="ab-section ab-section-paged">
      <ChapterHead num="01" label="Our Story" />
      <div className="ab-story">
        <div className="ab-story-text">
          <p className="ab-lead">
            Life Saver is a growing network of PhilHealth-accredited <strong>Yakap</strong> clinics and{' '}
            <strong>Gamot</strong> partner pharmacies — primary care and affordable medicines, closer to Filipino
            families.
          </p>
          <p>
            From our clinics in NCR and Rizal to Southern Luzon and the Visayas, every branch follows one standard
            of care. Yakap facilities deliver PhilHealth-accredited primary care, while Gamot partner pharmacies
            let members avail of their essential medicines.
          </p>
          <p>
            Beyond our branches, our mobile clinics bring consultations, diagnostics, and vaccinations directly to
            barangays, workplaces, and community events — because primary care works best when it comes to you.
          </p>
          <Link to="/branches" className="ab-arrow-link">
            Explore our Yakap clinics <span aria-hidden="true">→</span>
          </Link>
        </div>
        <div className="ab-collage">
          <img src="/about/ls-serving-medicin.jpg" alt="Life Saver staff serving medicines to patients" className="ab-collage-main" loading="lazy" />
          <img src="/about/ls-serving-people-gym-portrait.jpg" alt="Community healthcare service at a local venue" className="ab-collage-offset" loading="lazy" />
        </div>
      </div>
    </div>
  )
}

function VisionPage() {
  return (
    <div className="ab-vision ab-vision-paged">
      <div className="ab-vision-inner">
        <ChapterHead num="02" label="Our Vision · Life Saver 2030" light />
        <p className="ab-vision-text">
          To become the most trusted and accessible primary healthcare network in the Philippines — empowering
          every Filipino through quality primary care, affordable medicines, innovative healthcare solutions, and
          community-based healthcare services.
        </p>
      </div>
    </div>
  )
}

function MissionPage() {
  return (
    <div className="ab-section ab-section-paged">
      <ChapterHead num="03" label="Our Mission" />
      <p className="ab-mission-intro">Life Saver Medical Services commits to:</p>
      <ol className="ab-missions ab-missions-paged">
        {MISSION.map((item, i) => (
          <li key={i} className="ab-mission">
            <span className="ab-mission-num" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
            <p>{item}</p>
          </li>
        ))}
      </ol>
    </div>
  )
}

function ValuesPage() {
  return (
    <div className="ab-section ab-section-paged">
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
    </div>
  )
}

function FieldPage() {
  return (
    <div className="ab-section ab-section-paged">
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
          <img src="/about/injecting-a-patient.jpg" alt="Vaccination and primary care services" loading="lazy" />
          <figcaption>Vaccination drives</figcaption>
        </figure>
      </div>
      <div className="ab-cta-actions" style={{ marginTop: 28 }}>
        {STATIC_MODE ? (
          <Link to="/branches" className="btn btn-primary">Find a Yakap Clinic</Link>
        ) : (
          <Link to="/book" className="btn btn-primary">Book an Appointment</Link>
        )}
        <Link to="/pharmacy" className="ab-arrow-link">
          Our pharmacies <span aria-hidden="true">→</span>
        </Link>
      </div>
    </div>
  )
}

export default function About() {
  const pages = [
    { id: 'cover', label: 'About Life Saver', content: <CoverPage /> },
    { id: 'story', label: 'Our Story', content: <StoryPage /> },
    { id: 'vision', label: 'Our Vision', content: <VisionPage /> },
    { id: 'mission', label: 'Our Mission', content: <MissionPage />, scroll: true },
    { id: 'values', label: 'Core Values', content: <ValuesPage />, scroll: true },
    { id: 'field', label: 'In the Field', content: <FieldPage /> },
    { id: 'contact', label: 'Contact Us', content: <FooterPage /> },
  ]
  return <Pager pages={pages} />
}
