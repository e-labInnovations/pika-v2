import Link from 'next/link'
import Image from 'next/image'
import React from 'react'
import {
  Sparkles,
  ScanLine,
  Tag,
  BarChart3,
  ArrowRight,
} from 'lucide-react'

const FEATURES = [
  {
    icon: Sparkles,
    color: 'blue' as const,
    title: 'AI Transaction Parsing',
    description:
      'Paste any SMS, bank alert, or natural language description and Pika extracts the amount, category, merchant, and date automatically.',
  },
  {
    icon: ScanLine,
    color: 'green' as const,
    title: 'Receipt & Screenshot Scanning',
    description:
      'Photograph a bill or upload a screenshot — Pika reads the image and fills in the transaction for you.',
  },
  {
    icon: Tag,
    color: 'blue' as const,
    title: 'Smart Categorization',
    description:
      'Organize spending with nested categories, color-coded tags, and custom icons. Your system, your structure.',
  },
  {
    icon: BarChart3,
    color: 'green' as const,
    title: 'Spending Analytics',
    description:
      'Monthly calendars, category breakdowns, and people balance views give you a clear picture of where your money goes.',
  },
]

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">

      {/* Ambient glows */}
      <div
        aria-hidden
        className="pointer-events-none fixed top-[-20vh] left-[-10vw] w-[70vw] h-[70vh] rounded-full"
        style={{ background: 'radial-gradient(ellipse, rgba(77,142,255,0.07) 0%, transparent 70%)' }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed bottom-[-10vh] right-[-5vw] w-[50vw] h-[50vh] rounded-full"
        style={{ background: 'radial-gradient(ellipse, rgba(78,222,163,0.06) 0%, transparent 70%)' }}
      />

      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-8 py-4 border-b border-white/[0.04] bg-background/80 backdrop-blur-xl">
        <Link href="/" className="flex items-center gap-2.5 no-underline">
          <Image src="/icon.svg" alt="Pika" width={26} height={26} />
          <span className="text-[15px] font-semibold tracking-tight text-foreground">Pika</span>
        </Link>
        <div className="flex items-center gap-6">
          <Link href="/terms" className="text-[13px] text-muted-foreground hover:text-foreground transition-colors">Terms</Link>
          <Link href="/privacy-policy" className="text-[13px] text-muted-foreground hover:text-foreground transition-colors">Privacy</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 flex flex-col items-center text-center px-6 pt-52 pb-28 animate-[fadeUp_0.8s_ease_both]">

        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[11px] font-medium tracking-widest uppercase mb-10"
          style={{
            color: '#4edea3',
            background: 'rgba(78,222,163,0.08)',
            border: '1px solid rgba(78,222,163,0.18)',
          }}>
          <span className="w-1.5 h-1.5 rounded-full bg-[#4edea3] shadow-[0_0_6px_#4edea3]" />
          Personal Finance Tracker
        </div>

        {/* Logo */}
        <div className="mb-7 drop-shadow-[0_8px_32px_rgba(77,142,255,0.35)]">
          <Image src="/icon.svg" alt="Pika" width={76} height={76} />
        </div>

        {/* Headline */}
        <h1 className="text-[clamp(3rem,8vw,6rem)] font-bold leading-[1.02] tracking-[-0.04em] text-foreground mb-5">
          Money,{' '}
          <span className="italic font-light" style={{ color: '#4d8eff' }}>tracked</span>
          <br />effortlessly.
        </h1>

        {/* Sub */}
        <p className="text-[17px] font-normal text-muted-foreground max-w-[440px] leading-relaxed mb-10">
          Pika turns receipts, SMS alerts, and plain descriptions into clean, categorized transactions — powered by AI.
        </p>

        {/* CTA */}
        <Link
          href="/mcp-setup"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold no-underline transition-opacity hover:opacity-85"
          style={{ background: '#4d8eff', color: '#0d1322' }}
        >
          Connect via MCP
          <ArrowRight size={15} />
        </Link>
      </section>

      {/* Divider */}
      <div className="relative z-10 flex items-center gap-4 px-8 max-w-4xl mx-auto mb-14">
        <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.07), transparent)' }} />
        <span className="text-[10px] font-medium tracking-[0.14em] uppercase text-muted-foreground/40 whitespace-nowrap">What Pika does</span>
        <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.07), transparent)' }} />
      </div>

      {/* Features grid */}
      <div className="relative z-10 max-w-4xl mx-auto px-6 pb-28 grid grid-cols-2 max-sm:grid-cols-1 gap-4">
        {FEATURES.map(({ icon: Icon, color, title, description }) => {
          const isBlue = color === 'blue'
          const accent = isBlue ? '#4d8eff' : '#4edea3'
          return (
            <div
              key={title}
              className="group relative flex flex-col gap-6 p-7 rounded-2xl border border-border bg-card overflow-hidden transition-all duration-300 hover:border-[#424754]"
            >
              {/* Hover radial glow */}
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                style={{ background: `radial-gradient(circle at 0% 0%, ${isBlue ? 'rgba(77,142,255,0.06)' : 'rgba(78,222,163,0.05)'} 0%, transparent 60%)` }}
              />

              {/* Icon */}
              <div
                className="relative w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: `${accent}14`, border: `1px solid ${accent}30` }}
              >
                <Icon size={18} style={{ color: accent }} />
              </div>

              {/* Text */}
              <div className="relative">
                <h3 className="text-[15px] font-semibold text-foreground tracking-tight mb-2">{title}</h3>
                <p className="text-[13px] text-muted-foreground leading-relaxed">{description}</p>
              </div>

              {/* Bottom accent line */}
              <div
                className="absolute bottom-0 left-0 right-0 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{ background: `linear-gradient(90deg, transparent, ${accent}40, transparent)` }}
              />
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <footer className="relative z-10 border-t text-center px-6 py-8" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
        <div className="flex justify-center gap-6 mb-3">
          <Link href="/terms" className="text-xs text-muted-foreground/40 hover:text-muted-foreground transition-colors no-underline">Terms</Link>
          <Link href="/privacy-policy" className="text-xs text-muted-foreground/40 hover:text-muted-foreground transition-colors no-underline">Privacy Policy</Link>
          <Link href="/mcp-setup" className="text-xs text-muted-foreground/40 hover:text-muted-foreground transition-colors no-underline">MCP Setup</Link>
        </div>
        <p className="text-[11px] text-muted-foreground/25 tracking-wide">
          © {new Date().getFullYear()} Pika — Personal Finance
        </p>
      </footer>

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
