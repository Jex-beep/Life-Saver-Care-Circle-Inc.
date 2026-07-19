import { Link } from 'react-router-dom'
import { STATIC_MODE } from '../config.js'
import { PhoneIcon, MailIcon, FacebookIcon, MapPinIcon, CalendarIcon } from './Icons.jsx'

/* Full-viewport contact/footer page used as the last page of every route. */
export default function FooterPage() {
  return (
    <div className="fpage">
      <span className="section-eyebrow">Get in touch</span>
      <h2>We're Here to Help</h2>
      <p className="fpage-sub">Call, message, or visit — our team is happy to assist you and your family.</p>

      <div className="fpage-tiles">
        <a href="tel:+639325688028" className="fpage-tile">
          <PhoneIcon size={26} />
          <strong>Call Us</strong>
          <span>0932 568 8028</span>
        </a>
        <a href="mailto:info@lscarecircle.com.ph" className="fpage-tile">
          <MailIcon size={26} />
          <strong>Email Us</strong>
          <span>info@lscarecircle.com.ph</span>
        </a>
        <a
          href="https://www.facebook.com/LifeSaverServicesPH"
          target="_blank"
          rel="noopener noreferrer"
          className="fpage-tile"
        >
          <FacebookIcon size={26} />
          <strong>Facebook</strong>
          <span>Life Saver Services PH</span>
        </a>
        <Link to="/branches" className="fpage-tile">
          <MapPinIcon size={26} />
          <strong>Visit a Clinic</strong>
          <span>Mon–Sat, 8:00 AM – 5:00 PM</span>
        </Link>
      </div>

      <div className="fpage-actions">
        {STATIC_MODE ? (
          <Link to="/branches" className="btn btn-primary">Find a Yakap Clinic</Link>
        ) : (
          <Link to="/book" className="btn btn-primary">
            <CalendarIcon size={18} /> Book an Appointment
          </Link>
        )}
        <Link to="/pharmacy" className="btn btn-secondary">Our Pharmacies</Link>
      </div>

      <p className="fpage-note">
        © 2026 Life Saver · Yakap: PhilHealth-accredited Primary Care Facility · Gamot: pharmacy where PhilHealth
        members may avail of medicines
        {!STATIC_MODE && (
          <>
            {' '}· <Link to="/track">Track a booking or order</Link> · <Link to="/admin">Staff login</Link>
          </>
        )}
      </p>
    </div>
  )
}
