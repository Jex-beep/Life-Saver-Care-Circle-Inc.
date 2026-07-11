import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer id="contact" className="footer">
      <div className="footer-inner">
        <div>
          <img src="/rectangle-type-logo.png" alt="Life Saver Care Circle Inc." className="footer-logo" />
          <p>Caring for our community, one patient at a time.</p>
          <p className="footer-tags">
            <span className="badge badge-yakap">Yakap</span> PhilHealth-accredited Primary Care ·{' '}
            <span className="badge badge-gamot">Gamot</span> PhilHealth medicine partner
          </p>
        </div>
        <div>
          <h4>Quick Links</h4>
          <p><Link to="/about">About Us</Link></p>
          <p><Link to="/branches">Find a Branch</Link></p>
          <p><Link to="/book">Book an Appointment</Link></p>
          <p><Link to="/pharmacy">Order Medicines</Link></p>
          <p><Link to="/track">Track Booking / Order</Link></p>
        </div>
        <div>
          <h4>Contact</h4>
          <p>123 Wellness Ave, Suite 100</p>
          <p>(555) 123-4567</p>
          <p>hello@lifesavercarecircle.example</p>
        </div>
        <div>
          <h4>Hours</h4>
          <p>Mon–Sat: 8am – 5pm</p>
          <p>Closed Sundays</p>
          <p className="footer-admin"><Link to="/admin">Staff Login</Link></p>
        </div>
      </div>
      <p className="footer-note">
        © 2026 Life Saver Care Circle Inc. — Yakap: PhilHealth-accredited Primary Care Facility · Gamot: pharmacy
        where PhilHealth members may avail of medicines.
      </p>
    </footer>
  )
}
