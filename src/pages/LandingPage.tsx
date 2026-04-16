import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Sparkles, Zap, Shield, Users, Code, Wand2, Globe,
  ArrowRight, Star,
  BarChart3
} from 'lucide-react'

const PAIN_POINTS = [
  { item: 'Projects don\'t save', competitor: '❌ AppLaunchpad', snapstore: '✅ Auto-saves every 5s' },
  { item: 'Export sizes wrong', competitor: '❌ AppLaunchpad', snapstore: '✅ Pixel-accurate, store-validated' },
  { item: 'Paywall after hours of work', competitor: '❌ AppLaunchpad', snapstore: '✅ Free tier exports, no gates' },
  { item: 'No team collaboration', competitor: '❌ All competitors', snapstore: '✅ Built-in team workspaces' },
  { item: 'No API access', competitor: '❌ All competitors', snapstore: '✅ Full REST API + webhooks' },
  { item: 'AI screenshot generation', competitor: '❌ None', snapstore: '✅ GPT-4o powered composer' },
]

const FEATURES = [
  {
    icon: Shield,
    color: 'text-accent-green',
    bg: 'bg-accent-green/10',
    title: 'Zero Data Loss, Guaranteed',
    desc: 'Dual autosave: IndexedDB locally every 5 seconds, then Supabase every 30 seconds. Your work survives browser crashes, tab closures, and Wi-Fi drops.',
  },
  {
    icon: Wand2,
    color: 'text-accent-purple',
    bg: 'bg-accent-purple/10',
    title: 'AI That Actually Helps',
    desc: 'GPT-4o generates compelling screenshot headlines, complete layout compositions, and localizations in 40+ languages — all from your app description.',
  },
  {
    icon: Users,
    color: 'text-brand-400',
    bg: 'bg-brand-600/10',
    title: 'Real Team Collaboration',
    desc: 'Live presence, shared workspaces, brand kits, approval workflows with comment threads — the first screenshot tool built for teams.',
  },
  {
    icon: Code,
    color: 'text-accent-cyan',
    bg: 'bg-accent-cyan/10',
    title: 'API for Your CI/CD Pipeline',
    desc: 'The only screenshot tool with a REST API. Auto-generate and update screenshots on every app release. SDKs for JavaScript and Python.',
  },
  {
    icon: BarChart3,
    color: 'text-accent-amber',
    bg: 'bg-accent-amber/10',
    title: 'ASO Performance Loop',
    desc: 'Connect your AppFollow or AppTweak account. See how screenshot changes correlate with conversion rate — close the design-to-data loop.',
  },
  {
    icon: Globe,
    color: 'text-accent-pink',
    bg: 'bg-accent-pink/10',
    title: 'Instant Localization',
    desc: 'One click generates a full set of localized screenshot projects in 40+ languages. Text expands intelligently for CJK and RTL languages.',
  },
]

const TESTIMONIALS = [
  {
    text: '"I spent 3 hours in AppLaunchpad only for my project to vanish on refresh. SnapStore saved my work every 5 minutes. Never going back."',
    author: 'Sam K.', role: 'Indie iOS Developer', color: '#6171f6',
  },
  {
    text: '"The AI copy suggestions gave me 5 headline options in 8 seconds. One of them outperformed my hand-written copy by 23% CVR in A/B testing."',
    author: 'Maya R.', role: 'Mobile Growth Lead', color: '#a78bfa',
  },
  {
    text: '"We ship 6 apps a year. SnapStore\'s team workspace and brand kit means every app has consistent visuals without any Slack back-and-forth."',
    author: 'Alex T.', role: 'App Studio Lead', color: '#34d399',
  },
]

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handler)
    return () => window.removeEventListener('scroll', handler)
  }, [])

  return (
    <div className="min-h-screen bg-surface-950 text-surface-100">
      {/* Navbar */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-surface-950/90 backdrop-blur-md border-b border-surface-800' : ''}`}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-brand flex items-center justify-center shadow-glow-sm">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-display font-bold text-lg text-white">SnapStore</span>
          </div>

          <div className="hidden md:flex items-center gap-8">
            {['Features', 'Pricing', 'API Docs'].map(item => (
              <Link key={item} to={item === 'Pricing' ? '/pricing' : '#'} className="text-sm text-surface-400 hover:text-white transition-colors">
                {item}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <Link to="/auth/login" className="btn-ghost btn-sm hidden sm:inline-flex">Sign in</Link>
            <Link to="/auth/signup" className="btn-gradient btn-sm">
              Get started free <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-glow opacity-20" />
        <div className="absolute top-20 -left-40 w-96 h-96 bg-brand-600/15 rounded-full blur-3xl" />
        <div className="absolute top-40 -right-40 w-96 h-96 bg-accent-purple/10 rounded-full blur-3xl" />

        <div className="relative max-w-5xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 badge-brand px-4 py-1.5 mb-6 text-sm">
              <Zap className="w-3.5 h-3.5" />
              App Store Screenshots, Reimagined with AI
            </div>

            <h1 className="font-display font-black text-6xl md:text-7xl text-white leading-[1.05] text-balance">
              Your work always saves.
              <span className="block text-gradient">Your exports always work.</span>
            </h1>

            <p className="mt-6 text-xl text-surface-400 leading-relaxed max-w-2xl mx-auto">
              SnapStore is the screenshot platform that indie developers actually trust — AI-powered design,
              pixel-accurate exports, team collaboration, and zero data loss.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10">
              <Link to="/auth/signup" className="btn-gradient btn-xl w-full sm:w-auto">
                Start for free — no credit card <ArrowRight className="w-4 h-4" />
              </Link>
              <Link to="/pricing" className="btn-secondary btn-xl w-full sm:w-auto">
                View pricing
              </Link>
            </div>

            <p className="mt-4 text-sm text-surface-600">
              3 projects free · No watermarks · No export gates
            </p>
          </motion.div>

          {/* Hero visual — Editor mockup */}
          <motion.div
            className="mt-16 relative"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.7 }}
          >
            <div className="rounded-2xl overflow-hidden border border-surface-700/50 shadow-[0_40px_120px_rgba(0,0,0,0.7)] bg-surface-900">
              {/* Editor chrome */}
              <div className="h-10 bg-surface-900 border-b border-surface-800 flex items-center px-4 gap-2">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-accent-red/60" />
                  <div className="w-3 h-3 rounded-full bg-accent-amber/60" />
                  <div className="w-3 h-3 rounded-full bg-accent-green/60" />
                </div>
                <div className="flex-1 mx-4">
                  <div className="w-64 h-5 bg-surface-800 rounded-lg mx-auto" />
                </div>
                <div className="flex gap-2">
                  <div className="w-16 h-5 rounded-lg bg-brand-600/20 border border-brand-600/30" />
                  <div className="w-16 h-5 rounded-lg bg-brand-600 animate-pulse-glow" />
                </div>
              </div>
              <div className="h-72 bg-gradient-surface flex items-center justify-center canvas-bg relative">
                {/* Simulated canvas content */}
                <div className="w-32 h-64 bg-surface-800 rounded-3xl border border-surface-700 shadow-2xl flex flex-col items-center justify-center gap-3">
                  <div className="w-16 h-16 rounded-2xl bg-brand-600/40 border border-brand-600/30" />
                  <div className="w-20 h-3 rounded bg-surface-600" />
                  <div className="w-16 h-2 rounded bg-surface-700" />
                </div>
                <div className="absolute top-4 right-4 card-glass rounded-xl p-3 w-48">
                  <p className="text-[10px] text-surface-500 mb-1">AI Copy Suggestions</p>
                  {['Track habits. Win days.', 'Your best self, daily.', 'Build streaks. Build life.'].map(t => (
                    <div key={t} className="text-[10px] text-surface-300 py-1 border-b border-surface-700/50 last:border-0">{t}</div>
                  ))}
                </div>
                <div className="absolute bottom-4 left-4 flex items-center gap-1.5 card-glass rounded-lg px-3 py-1.5">
                  <div className="glow-dot w-1.5 h-1.5" />
                  <span className="text-[10px] text-accent-green">Saved · 2s ago</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Pain points comparison */}
      <section className="py-20 px-6 bg-surface-900/30">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-display font-bold text-4xl text-white">Why developers switch to SnapStore</h2>
            <p className="mt-3 text-surface-400">Built to fix every problem with the current market leader.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-800">
                  <th className="text-left text-sm text-surface-500 font-normal pb-3 pr-4">Feature</th>
                  <th className="text-center text-sm text-surface-500 font-normal pb-3 px-4">AppLaunchpad</th>
                  <th className="text-center text-sm font-semibold text-brand-400 pb-3 pl-4">SnapStore</th>
                </tr>
              </thead>
              <tbody>
                {PAIN_POINTS.map((row, i) => (
                  <motion.tr
                    key={row.item}
                    className="border-b border-surface-800/50"
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.06 }}
                    viewport={{ once: true }}
                  >
                    <td className="py-3 pr-4 text-sm text-surface-300">{row.item}</td>
                    <td className="py-3 px-4 text-center text-sm text-surface-500">{row.competitor}</td>
                    <td className="py-3 pl-4 text-center text-sm text-surface-100 font-medium">{row.snapstore}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-display font-bold text-4xl text-white">Everything a screenshot tool should be</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feat, i) => (
              <motion.div
                key={feat.title}
                className="card p-6 space-y-4"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07 }}
                viewport={{ once: true }}
              >
                <div className={`w-10 h-10 rounded-xl ${feat.bg} flex items-center justify-center`}>
                  <feat.icon className={`w-5 h-5 ${feat.color}`} />
                </div>
                <h3 className="font-display font-bold text-lg text-white">{feat.title}</h3>
                <p className="text-sm text-surface-400 leading-relaxed">{feat.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-6 bg-surface-900/30">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-display font-bold text-4xl text-white text-center mb-12">Loved by indie developers</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <motion.div
                key={i}
                className="card p-6 space-y-4"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                viewport={{ once: true }}
              >
                <div className="flex">
                  {[...Array(5)].map((_, s) => (
                    <Star key={s} className="w-4 h-4 text-accent-amber fill-current" />
                  ))}
                </div>
                <p className="text-sm text-surface-300 leading-relaxed italic">{t.text}</p>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: t.color }}>
                    {t.author[0]}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{t.author}</p>
                    <p className="text-xs text-surface-500">{t.role}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6">
        <motion.div
          className="max-w-2xl mx-auto text-center"
          initial={{ opacity: 0, scale: 0.96 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
        >
          <div className="relative card p-12 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-card" />
            <div className="relative">
              <div className="w-14 h-14 rounded-2xl bg-gradient-brand flex items-center justify-center mx-auto mb-6 shadow-glow-brand animate-bounce-subtle">
                <Sparkles className="w-7 h-7 text-white" />
              </div>
              <h2 className="font-display font-bold text-4xl text-white mb-4">Start in under 5 minutes</h2>
              <p className="text-surface-400 mb-8">
                Free forever. 3 projects. No credit card. No watermarks.
                Your screenshots will be better before lunch.
              </p>
              <Link to="/auth/signup" className="btn-gradient btn-xl inline-flex">
                Create your free account <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-surface-800 py-8 px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-brand flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-display font-bold text-white">SnapStore</span>
          </div>
          <p className="text-surface-600 text-xs">© 2026 SnapStore. All rights reserved.</p>
          <div className="flex gap-6">
            {['Terms', 'Privacy', 'Status'].map(link => (
              <a key={link} href="#" className="text-xs text-surface-600 hover:text-surface-400 transition-colors">{link}</a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  )
}
