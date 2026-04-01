import './globals.css'
import type { Metadata } from 'next'
import Navbar from '../components/Navbar'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Stella! Everything You Love, Delivered.',
  description: 'Stella! — Everything You Love, Delivered. Premium ecommerce platform with the best products across electronics, fashion, beauty, furniture and more.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Poppins:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body>
        <Navbar />
        {children}
        
        <footer>
          {/* Back to top */}
          <a href="#" className="footer-back-to-top">
            Back to top
          </a>

          {/* Sign in section */}
          <div className="footer-signin-section">
            <p>See personalized recommendations</p>
            <Link href="/signup" className="footer-signin-btn">
              Sign in
            </Link>
            <p style={{ fontSize: '0.82rem', marginTop: '0.75rem', color: '#999' }}>
              New customer? <Link href="/signup" style={{ color: '#6EACDA', textDecoration: 'underline' }}>Start here.</Link>
            </p>
          </div>

          {/* Main footer grid */}
          <div className="container">
            <div className="footer-grid">
              <div className="footer-col">
                <h4>Get to Know Us</h4>
                <ul>
                  <li><Link href="/about">About Stella</Link></li>
                  <li><a href="#">Careers</a></li>
                  <li><a href="#">Press Releases</a></li>
                  <li><a href="#">Stella Cares</a></li>
                </ul>
              </div>

              <div className="footer-col">
                <h4>Connect with Us</h4>
                <ul>
                  <li><a href="#">Facebook</a></li>
                  <li><a href="#">Twitter</a></li>
                  <li><a href="#">Instagram</a></li>
                </ul>
              </div>

              <div className="footer-col">
                <h4>Make Money with Us</h4>
                <ul>
                  <li><a href="#">Sell on Stella</a></li>
                  <li><a href="#">Sell under Stella Accelerator</a></li>
                  <li><a href="#">Protect and Build Your Brand</a></li>
                  <li><a href="#">Stella Global Selling</a></li>
                  <li><a href="#">Supply to Stella</a></li>
                  <li><a href="#">Become an Affiliate</a></li>
                  <li><a href="#">Advertise Your Products</a></li>
                </ul>
              </div>

              <div className="footer-col">
                <h4>Let Us Help You</h4>
                <ul>
                  <li><Link href="/signup">Your Account</Link></li>
                  <li><a href="#">Returns Centre</a></li>
                  <li><a href="#">Recalls and Safety Alerts</a></li>
                  <li><a href="#">100% Purchase Protection</a></li>
                  <li><a href="#">Stella App Download</a></li>
                  <li><Link href="/contact">Help</Link></li>
                </ul>
              </div>
            </div>
          </div>

          {/* Bottom section */}
          <div className="footer-bottom-section">
            <div className="container">
              <div className="footer-brand-row">
                <span className="logo">Stella!</span>
              </div>

              <div className="footer-sub-links">
                <div className="footer-sub-link-group">
                  <h5>Stella Music</h5>
                  <p>Stream ad-free music</p>
                </div>
                <div className="footer-sub-link-group">
                  <h5>Stella Business</h5>
                  <p>Everything For Your Business</p>
                </div>
                <div className="footer-sub-link-group">
                  <h5>Stella Fresh</h5>
                  <p>Groceries & More Right To Your Door</p>
                </div>
                <div className="footer-sub-link-group">
                  <h5>Stella Prime</h5>
                  <p>Fast delivery, exclusive deals</p>
                </div>
              </div>
            </div>

            <div className="footer-copyright">
              <a href="#">Conditions of Use & Sale</a>
              <a href="#">Privacy Notice</a>
              <a href="#">Interest-Based Ads</a>
              <br />
              © 2026, Stella!, Inc. or its affiliates
            </div>
          </div>
        </footer>
      </body>
    </html>
  )
}
