import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const RAZORPAY_KEY_ID = Deno.env.get('RAZORPAY_KEY_ID')!
const RAZORPAY_KEY_SECRET = Deno.env.get('RAZORPAY_KEY_SECRET')!
const authHeader = 'Basic ' + btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`)

const PLAN_MAP: Record<string, { monthly: string; annual: string }> = {
  indie: { monthly: 'plan_SeEF9mCMHarHf0', annual: 'plan_SeEGQlHBCTASRH' },
  pro: { monthly: 'plan_SeEH7Zh5gfi0SE', annual: 'plan_SeEHksijr4I6lO' },
  team: { monthly: 'plan_SeEIKupZKJem24', annual: 'plan_SeEIiydlRd65UC' },
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { planId, isAnnual } = await req.json()

    // Handle Pay-Per-Project (One-time Order)
    if (planId === 'ppp') {
      const orderRes = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: 29900, // ₹299.00 in paise
          currency: 'INR',
          receipt: `user_${user.id}_${Date.now()}`,
          notes: { userId: user.id }
        }),
      })
      const order = await orderRes.json()
      if (order.error) throw new Error(order.error.description)

      return new Response(JSON.stringify({ type: 'order', id: order.id, amount: 29900 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Handle Subscription Plans
    if (!PLAN_MAP[planId]) throw new Error('Invalid plan selection')
    const razorpayPlanId = isAnnual ? PLAN_MAP[planId].annual : PLAN_MAP[planId].monthly

    // Create Subscription
    const subRes = await fetch('https://api.razorpay.com/v1/subscriptions', {
      method: 'POST',
      headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plan_id: razorpayPlanId,
        total_count: 120, // max billing cycles
        customer_notify: 1,
        notes: { userId: user.id, planId }
      }),
    })
    const subscription = await subRes.json()
    if (subscription.error) throw new Error(subscription.error.description)

    return new Response(JSON.stringify({ type: 'subscription', id: subscription.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
