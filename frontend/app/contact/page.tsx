import React from 'react'

export default function Contact() {
  return (
    <main className="container" style={{ padding: '120px 0' }}>
      <span className="section-label">Connect with Stella!</span>
      <h1 className="section-heading">How can we assist<br/>your premium journey?</h1>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '80px' }}>
        <div>
          <div style={{ marginBottom: '5rem' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.15em' }}>Call The Vault</h2>
            <p style={{ fontSize: '1.1rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>We are available 24/7, 7 days a week.</p>
            <p style={{ fontSize: '1.1rem', fontWeight: 700 }}>Phone: +88015-88888-9999</p>
          </div>
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '5rem' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.15em' }}>Write To Us</h2>
            <p style={{ fontSize: '1.1rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Fill out our form and we will contact you within 24 hours.</p>
            <p style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>Emails: customer@stella.com</p>
            <p style={{ fontSize: '1.1rem', fontWeight: 700 }}>support@stella.com</p>
          </div>
        </div>
        
        <div style={{ background: 'var(--bg-soft)', padding: '3rem', borderRadius: 'var(--radius-md)' }}>
          <form style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div style={{ display: 'flex', gap: '1.5rem' }}>
              <input type="text" placeholder="Your Name *" style={{ flex: 1, padding: '1.25rem', background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', outline: 'none' }} />
              <input type="email" placeholder="Your Email *" style={{ flex: 1, padding: '1.25rem', background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', outline: 'none' }} />
            </div>
            <input type="text" placeholder="Your Phone *" style={{ padding: '1.25rem', background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', outline: 'none' }} />
            <textarea placeholder="Your Message" style={{ padding: '1.25rem', background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', minHeight: '200px', outline: 'none' }}></textarea>
            <button className="btn-primary" style={{ alignSelf: 'flex-start' }}>Send Message</button>
          </form>
        </div>
      </div>
    </main>
  )
}
