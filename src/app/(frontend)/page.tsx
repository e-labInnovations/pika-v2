import { headers as getHeaders } from 'next/headers.js'
import Link from 'next/link'
import { getPayload } from 'payload'
import React from 'react'
import config from '@/payload.config'
import './styles.css'

export default async function HomePage() {
  const headers = await getHeaders()
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })
  const { user } = await payload.auth({ headers })

  const userName = user ? ((user as any).name || (user as any).email) : null

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Mono:wght@400;500&family=DM+Sans:wght@300;400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .pika-page {
          min-height: 100vh;
          background: #080c10;
          color: #e8edf2;
          font-family: 'DM Sans', sans-serif;
          overflow-x: hidden;
          position: relative;
        }

        /* Ambient glow blobs */
        .pika-page::before {
          content: '';
          position: fixed;
          top: -20vh;
          left: -10vw;
          width: 70vw;
          height: 70vh;
          background: radial-gradient(ellipse, rgba(74,144,226,0.07) 0%, transparent 70%);
          pointer-events: none;
          z-index: 0;
        }
        .pika-page::after {
          content: '';
          position: fixed;
          bottom: -10vh;
          right: -5vw;
          width: 50vw;
          height: 50vh;
          background: radial-gradient(ellipse, rgba(16,185,129,0.06) 0%, transparent 70%);
          pointer-events: none;
          z-index: 0;
        }

        /* Nav */
        .pika-nav {
          position: fixed;
          top: 0; left: 0; right: 0;
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1.25rem 2.5rem;
          border-bottom: 1px solid rgba(255,255,255,0.04);
          background: rgba(8,12,16,0.8);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }
        .pika-nav-brand {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          text-decoration: none;
          color: inherit;
        }
        .pika-nav-brand img {
          width: 28px;
          height: 28px;
        }
        .pika-nav-brand span {
          font-family: 'DM Serif Display', serif;
          font-size: 1.15rem;
          letter-spacing: -0.01em;
          color: #e8edf2;
        }
        .pika-nav-cta {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.5rem 1.1rem;
          border-radius: 8px;
          font-size: 0.85rem;
          font-weight: 500;
          text-decoration: none;
          background: rgba(74,144,226,0.12);
          color: #4a90e2;
          border: 1px solid rgba(74,144,226,0.25);
          transition: background 0.2s, border-color 0.2s;
        }
        .pika-nav-cta:hover {
          background: rgba(74,144,226,0.2);
          border-color: rgba(74,144,226,0.45);
        }

        /* Hero */
        .pika-hero {
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: 14rem 2rem 8rem;
          animation: fadeUp 0.8s ease both;
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .pika-hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.35rem 0.85rem;
          border-radius: 100px;
          font-size: 0.75rem;
          font-family: 'DM Mono', monospace;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #10b981;
          background: rgba(16,185,129,0.08);
          border: 1px solid rgba(16,185,129,0.2);
          margin-bottom: 2.5rem;
          animation: fadeUp 0.8s ease 0.1s both;
        }
        .pika-hero-badge::before {
          content: '';
          width: 6px; height: 6px;
          border-radius: 50%;
          background: #10b981;
          box-shadow: 0 0 6px #10b981;
        }
        .pika-hero-logo {
          width: 80px;
          height: 80px;
          margin-bottom: 1.75rem;
          filter: drop-shadow(0 8px 32px rgba(74,144,226,0.35));
          animation: fadeUp 0.8s ease 0.15s both;
        }
        .pika-hero-title {
          font-family: 'DM Serif Display', serif;
          font-size: clamp(3.5rem, 8vw, 6.5rem);
          line-height: 1;
          letter-spacing: -0.03em;
          color: #f0f4f8;
          margin-bottom: 1.25rem;
          animation: fadeUp 0.8s ease 0.2s both;
        }
        .pika-hero-title em {
          font-style: italic;
          color: #4a90e2;
        }
        .pika-hero-sub {
          font-size: 1.15rem;
          font-weight: 300;
          color: #8899a8;
          max-width: 480px;
          line-height: 1.65;
          margin-bottom: 3rem;
          animation: fadeUp 0.8s ease 0.3s both;
        }
        .pika-hero-actions {
          display: flex;
          align-items: center;
          gap: 1rem;
          flex-wrap: wrap;
          justify-content: center;
          animation: fadeUp 0.8s ease 0.4s both;
        }
        .pika-btn-primary {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.85rem 2rem;
          border-radius: 10px;
          font-size: 0.95rem;
          font-weight: 500;
          text-decoration: none;
          background: linear-gradient(135deg, #4a90e2 0%, #357abd 100%);
          color: #fff;
          border: 1px solid rgba(255,255,255,0.1);
          box-shadow: 0 4px 24px rgba(74,144,226,0.3), inset 0 1px 0 rgba(255,255,255,0.15);
          transition: box-shadow 0.2s, transform 0.15s;
          letter-spacing: -0.01em;
        }
        .pika-btn-primary:hover {
          box-shadow: 0 6px 32px rgba(74,144,226,0.45), inset 0 1px 0 rgba(255,255,255,0.2);
          transform: translateY(-1px);
        }
        .pika-btn-ghost {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.85rem 1.75rem;
          border-radius: 10px;
          font-size: 0.95rem;
          font-weight: 400;
          text-decoration: none;
          color: #8899a8;
          border: 1px solid rgba(255,255,255,0.08);
          transition: color 0.2s, border-color 0.2s;
          letter-spacing: -0.01em;
        }
        .pika-btn-ghost:hover {
          color: #e8edf2;
          border-color: rgba(255,255,255,0.18);
        }

        /* Divider */
        .pika-divider {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 0 2.5rem;
          max-width: 960px;
          margin: 0 auto 4rem;
        }
        .pika-divider-line {
          flex: 1;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.07), transparent);
        }
        .pika-divider-label {
          font-size: 0.7rem;
          font-family: 'DM Mono', monospace;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.18);
          white-space: nowrap;
        }

        /* Features */
        .pika-features {
          position: relative;
          z-index: 1;
          max-width: 960px;
          margin: 0 auto;
          padding: 0 2rem 8rem;
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 1px;
          background: rgba(255,255,255,0.05);
          border-radius: 16px;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,0.05);
        }
        @media (max-width: 640px) {
          .pika-features { grid-template-columns: 1fr; }
        }
        .pika-feature {
          background: #0d1117;
          padding: 2.25rem 2.25rem;
          transition: background 0.2s;
          animation: fadeUp 0.8s ease both;
        }
        .pika-feature:hover {
          background: #111820;
        }
        .pika-feature:nth-child(1) { animation-delay: 0.1s; }
        .pika-feature:nth-child(2) { animation-delay: 0.2s; }
        .pika-feature:nth-child(3) { animation-delay: 0.3s; }
        .pika-feature:nth-child(4) { animation-delay: 0.4s; }
        .pika-feature-icon {
          width: 42px;
          height: 42px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 1.25rem;
          font-size: 1.2rem;
        }
        .pika-feature-icon.blue { background: rgba(74,144,226,0.1); border: 1px solid rgba(74,144,226,0.2); }
        .pika-feature-icon.green { background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.2); }
        .pika-feature-h {
          font-family: 'DM Serif Display', serif;
          font-size: 1.15rem;
          color: #dce7f0;
          margin-bottom: 0.5rem;
          letter-spacing: -0.01em;
        }
        .pika-feature-p {
          font-size: 0.875rem;
          color: #5c6e7e;
          line-height: 1.6;
          font-weight: 300;
        }

        /* Footer */
        .pika-footer {
          position: relative;
          z-index: 1;
          text-align: center;
          padding: 2rem;
          font-size: 0.78rem;
          font-family: 'DM Mono', monospace;
          color: rgba(255,255,255,0.15);
          letter-spacing: 0.04em;
          border-top: 1px solid rgba(255,255,255,0.04);
        }
      `}</style>

      <div className="pika-page">
        {/* Nav */}
        <nav className="pika-nav">
          <Link href="/" className="pika-nav-brand">
            <img src="/icon.svg" alt="Pika" />
            <span>Pika</span>
          </Link>
          <Link href="/admin" className="pika-nav-cta">
            {userName ? `Hi, ${userName}` : 'Sign in'} →
          </Link>
        </nav>

        {/* Hero */}
        <section className="pika-hero">
          <div className="pika-hero-badge">Personal Finance Tracker</div>
          <img src="/icon.svg" alt="Pika" className="pika-hero-logo" />
          <h1 className="pika-hero-title">
            Money, <em>tracked</em><br />effortlessly.
          </h1>
          <p className="pika-hero-sub">
            Pika turns receipts, SMS alerts, and plain descriptions into clean, categorized transactions — powered by AI.
          </p>
          <div className="pika-hero-actions">
            {userName ? (
              <Link href="/admin" className="pika-btn-primary">
                Go to Dashboard →
              </Link>
            ) : (
              <>
                <Link href="/admin" className="pika-btn-primary">
                  Open Dashboard →
                </Link>
                <Link href="/admin/login" className="pika-btn-ghost">
                  Sign in
                </Link>
              </>
            )}
          </div>
        </section>

        {/* Divider */}
        <div className="pika-divider">
          <div className="pika-divider-line" />
          <span className="pika-divider-label">What Pika does</span>
          <div className="pika-divider-line" />
        </div>

        {/* Features */}
        <div className="pika-features">
          <div className="pika-feature">
            <div className="pika-feature-icon blue">✦</div>
            <h3 className="pika-feature-h">AI Transaction Parsing</h3>
            <p className="pika-feature-p">Paste any SMS, bank alert, or natural language description and Pika extracts the amount, category, merchant, and date automatically.</p>
          </div>
          <div className="pika-feature">
            <div className="pika-feature-icon green">⬡</div>
            <h3 className="pika-feature-h">Receipt &amp; Screenshot Scanning</h3>
            <p className="pika-feature-p">Photograph a bill or upload a screenshot — Pika reads the image and fills in the transaction for you.</p>
          </div>
          <div className="pika-feature">
            <div className="pika-feature-icon blue">◈</div>
            <h3 className="pika-feature-h">Smart Categorization</h3>
            <p className="pika-feature-p">Organize spending with nested categories, color-coded tags, and custom icons. Your system, your structure.</p>
          </div>
          <div className="pika-feature">
            <div className="pika-feature-icon green">◎</div>
            <h3 className="pika-feature-h">Spending Analytics</h3>
            <p className="pika-feature-p">Monthly calendars, category breakdowns, and people balance views give you a clear picture of where your money goes.</p>
          </div>
        </div>

        {/* Footer */}
        <footer className="pika-footer">© {new Date().getFullYear()} Pika — Personal Finance</footer>
      </div>
    </>
  )
}
