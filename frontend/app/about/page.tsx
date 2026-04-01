import React from 'react'
import Link from 'next/link'

export default function About() {
  return (
    <main className="container" style={{ padding: '120px 0' }}>
      <span className="section-label">Since 2010</span>
      <h1 className="section-heading">Redefining Digital<br/>Premium Commerce</h1>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '100px', alignItems: 'center' }}>
        <div style={{ position: 'relative', height: '600px', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
          <img 
            src="https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?q=80&w=1000&auto=format&fit=crop" 
            alt="Business" 
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
        
        <div>
          <h2 style={{ fontSize: '2.5rem', marginBottom: '2rem' }}>Curating only the<br/>exceptional.</h2>
          <p style={{ fontSize: '1.15rem', color: 'var(--text-muted)', marginBottom: '2rem', lineHeight: '1.8' }}>
            Stella! was born from a simple belief: you shouldn’t have to settle. We curate a selection of the world's most impressive brands, from tech pioneers like Apple to fashion legends like Dior, bringing them together under one premium digital roof.
          </p>
          <p style={{ fontSize: '1.15rem', color: 'var(--text-muted)', marginBottom: '3rem', lineHeight: '1.8' }}>
            Every product in the Stella! vault has been vetted for quality, authenticity, and design excellence. Everything you love, delivered with the care it deserves.
          </p>
          <Link href="/" className="btn-primary">Explore The Collection</Link>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '2rem', marginTop: '10rem', textAlign: 'center' }}>
        {[
          { label: 'Sellers', val: '10.5k' },
          { label: 'Monthly Sales', val: '33k' },
          { label: 'Active Customers', val: '45.5k' },
          { label: 'Annual Revenue', val: '25.5B' }
        ].map((stat, i) => (
          <div key={i} style={{ padding: '3rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', transition: '0.3s' }}>
            <h3 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>{stat.val}</h3>
            <p style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{stat.label}</p>
          </div>
        ))}
      </div>
    </main>
  )
}
