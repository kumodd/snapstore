import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Check, Sparkles, ArrowRight, Star } from 'lucide-react'
import { useAuthStore } from '../stores/authStore'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import clsx from 'clsx'

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: '₹0',
    period: '',
    priceNote: 'forever',
    description: 'Perfect for trying SnapStore risk-free.',
    cta: 'Get started free',
    ctaVariant: 'secondary' as const,
    highlighted: false,
    features: [
      '3 active projects',
      '10 exports / month',
      'All templates included',
      'All device frames',
      'PNG & JPEG export',
      'No credit card required',
    ],
    limits: ['No AI features', 'No team collaboration', 'No API access'],
  },
  {
    id: 'indie',
    name: 'Indie',
    price: '₹499',
    priceAnnual: '₹416',
    period: '/ month',
    priceNote: 'or ₹4999/year',
    description: 'All you need as a solo developer.',
    cta: 'Start Indie',
    ctaVariant: 'primary' as const,
    highlighted: false,
    priceId: 'price_indie_monthly',
    features: [
      'Unlimited projects',
      'Unlimited exports',
      'AI copy assistant',
      'AI screenshot composer',
      'AI localization (40+ languages)',
      'A/B variant management',
      'All device frames (incl. 3D)',
      'Version history (10 saves)',
    ],
    limits: [],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '₹999',
    priceAnnual: '₹833',
    period: '/ month',
    priceNote: 'or ₹9999/year',
    description: 'For professionals who need API & team access.',
    cta: 'Start Pro',
    ctaVariant: 'gradient' as const,
    highlighted: true,
    priceId: 'price_pro_monthly',
    badge: 'Most Popular',
    features: [
      'Everything in Indie',
      'REST API access',
      'Figma plugin',
      'Up to 3 team users',
      'Webhook support',
      'Priority support',
    ],
    limits: [],
  },
  {
    id: 'team',
    name: 'Team',
    price: '₹2499',
    priceAnnual: '₹2083',
    period: '/ month',
    priceNote: 'or ₹24999/year',
    description: 'For studios shipping multiple apps.',
    cta: 'Start Team',
    ctaVariant: 'primary' as const,
    highlighted: false,
    priceId: 'price_team_monthly',
    features: [
      'Everything in Pro',
      'Unlimited team members',
      'Team workspaces',
      'Brand kit management',
      'Approval workflow',
      'ASO performance dashboard',
      'SAML SSO (coming soon)',
      'Dedicated support',
    ],
    limits: [],
  },
]

const PPP = {
  price: '₹299',
  description: 'Per project per year. Unlock exports for a single project.',
  features: [
    'Single project export',
    'All device sizes as ZIP',
    'PNG & JPEG formats',
    'No account required',
  ],
}

export default function PricingPage() {
  const { user, plan: currentPlan } = useAuthStore()
  const navigate = useNavigate()
  const [isAnnual, setIsAnnual] = useState(false)
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)

  const loadRazorpay = () => new Promise((resolve) => {
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })

  const handleUpgrade = async (planId: string) => {
    if (!user) { navigate('/auth/signup'); return }
    if (planId === 'free') { navigate('/dashboard'); return }

    setLoadingPlan(planId)
    try {
      const res = await loadRazorpay()
      if (!res) throw new Error('Razorpay SDK failed to load')

      const { data, error } = await supabase.functions.invoke('create-razorpay-order', {
        body: { planId, isAnnual },
      })
      if (error) throw error

      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount: data.amount,
        currency: "INR",
        name: "SnapStore",
        description: "Pro Subscription",
        order_id: data.type === 'order' ? data.id : undefined,
        subscription_id: data.type === 'subscription' ? data.id : undefined,
        handler: async function (_response: any) {
          toast.success('Payment successful! Your plan will update momentarily.')
          // Note: Full auth refresh relies on Webhook hitting DB + Zustand authStore listener
        },
        prefill: { email: user?.email },
        theme: { color: "#6c5ce7" },
      }

      const rzp = new (window as any).Razorpay(options)
      rzp.on('payment.failed', function (resp: any) {
        toast.error(resp.error.description || 'Payment Failed')
      })
      rzp.open()
    } catch (err: any) {
      toast.error(err.message || 'Checkout failed')
    } finally {
      setLoadingPlan(null)
    }
  }

  return (
    <div className="min-h-screen bg-surface-950 py-20 px-6">
      {/* Header */}
      <motion.div
        className="text-center max-w-3xl mx-auto mb-16"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Link to="/" className="inline-flex items-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-xl bg-gradient-brand flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="font-display font-bold text-lg text-white">SnapStore</span>
        </Link>
        <h1 className="font-display font-bold text-5xl text-white leading-tight">
          Simple, transparent pricing.
        </h1>
        <p className="mt-4 text-xl text-surface-400">
          No export gates. No watermarks. No surprises — ever.
        </p>

        {/* Annual toggle */}
        <div className="flex items-center justify-center gap-4 mt-8">
          <span className={clsx('text-sm', !isAnnual ? 'text-white' : 'text-surface-500')}>Monthly</span>
          <button
            onClick={() => setIsAnnual(!isAnnual)}
            className={clsx(
              'relative w-12 h-6 rounded-full transition-colors',
              isAnnual ? 'bg-brand-600' : 'bg-surface-700'
            )}
          >
            <span className={clsx(
              'absolute top-1 w-4 h-4 rounded-full bg-white transition-transform',
              isAnnual ? 'translate-x-7' : 'translate-x-1'
            )} />
          </button>
          <span className={clsx('text-sm', isAnnual ? 'text-white' : 'text-surface-500')}>
            Annual <span className="badge-green ml-1">Save 20%</span>
          </span>
        </div>
      </motion.div>

      {/* Pricing cards */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
        {PLANS.map((plan, i) => (
          <motion.div
            key={plan.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className={clsx(
              'rounded-2xl p-6 flex flex-col relative',
              plan.highlighted
                ? 'bg-brand-600/10 border-2 border-brand-500 shadow-glow-brand'
                : 'bg-surface-900 border border-surface-800'
            )}
          >
            {plan.badge && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="badge-brand px-3 py-0.5 text-xs font-bold">
                  <Star className="w-2.5 h-2.5" />
                  {plan.badge}
                </span>
              </div>
            )}

            {currentPlan === plan.id && (
              <div className="badge-green text-[10px] mb-3 self-start">Current plan</div>
            )}

            <h3 className="font-display font-bold text-xl text-white">{plan.name}</h3>
            <div className="mt-3 mb-1">
              <span className="font-display font-bold text-4xl text-white">
                {isAnnual && (plan as any).priceAnnual ? (plan as any).priceAnnual : plan.price}
              </span>
              <span className="text-surface-400 text-sm">{plan.period}</span>
            </div>
            <p className="text-[11px] text-surface-500 mb-4">{plan.priceNote}</p>
            <p className="text-sm text-surface-400 mb-6 flex-1">{plan.description}</p>

            <button
              id={`btn-plan-${plan.id}`}
              onClick={() => handleUpgrade(plan.id)}
              disabled={loadingPlan === plan.id || currentPlan === plan.id}
              className={clsx(
                'mb-6 w-full',
                plan.ctaVariant === 'gradient' ? 'btn-gradient btn-md' : plan.ctaVariant === 'primary' ? 'btn-primary btn-md' : 'btn-secondary btn-md',
                currentPlan === plan.id && 'opacity-50 cursor-not-allowed'
              )}
            >
              {loadingPlan === plan.id ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : currentPlan === plan.id ? 'Current plan' : plan.cta}
            </button>

            <ul className="space-y-2">
              {plan.features.map(f => (
                <li key={f} className="flex items-start gap-2 text-xs text-surface-300">
                  <Check className="w-3.5 h-3.5 text-accent-green flex-shrink-0 mt-0.5" />
                  {f}
                </li>
              ))}
              {plan.limits.map(l => (
                <li key={l} className="flex items-start gap-2 text-xs text-surface-600">
                  <span className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-center">·</span>
                  {l}
                </li>
              ))}
            </ul>
          </motion.div>
        ))}
      </div>

      {/* Pay-per-project */}
      <motion.div
        className="max-w-xl mx-auto card p-6 text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        <h3 className="font-display font-bold text-2xl text-white mb-1">
          Just need one project?
        </h3>
        <p className="text-surface-400 text-sm mb-1">{PPP.description}</p>
        <p className="font-display font-bold text-3xl text-white my-4">{PPP.price} <span className="text-base font-normal text-surface-500">one-time</span></p>
        <ul className="flex flex-wrap justify-center gap-x-6 gap-y-1 mb-6">
          {PPP.features.map(f => (
            <li key={f} className="flex items-center gap-1.5 text-xs text-surface-400">
              <Check className="w-3 h-3 text-accent-green" />{f}
            </li>
          ))}
        </ul>
        <button
          id="btn-pay-per-project"
          onClick={() => handleUpgrade('ppp')}
          className="btn-secondary btn-md px-8"
        >
          Pay once, download all <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </motion.div>

      {/* FAQ teaser */}
      <div className="mt-16 text-center">
        <p className="text-surface-500 text-sm">
          Questions? <a href="mailto:hello@snapstore.io" className="text-brand-400 hover:text-brand-300">hello@snapstore.io</a>
        </p>
      </div>
    </div>
  )
}
