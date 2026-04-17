import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import OpenAI from 'https://esm.sh/openai@4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── Validate required secrets at startup ──────────────────────────────
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
if (!OPENAI_API_KEY) {
  console.error('[ai-copy] FATAL: OPENAI_API_KEY environment variable is not set.')
}

const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Guard: key missing — return 503 instead of crashing with 500
  if (!openai) {
    return new Response(
      JSON.stringify({ error: 'AI service is temporarily unavailable. Please contact support.' }),
      { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    // ── Authenticate user ────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      console.warn('[ai-copy] Auth failed:', authError?.message)
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ── Check user plan (null-safe — missing profile ≠ 500) ──────────
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('plan')
      .eq('id', user.id)
      .single()

    if (profileError) {
      // Log but don't crash — treat missing profile as free
      console.warn('[ai-copy] Profile fetch failed for user', user.id, ':', profileError.message)
    }

    const plan = profile?.plan ?? 'free'
    if (plan === 'free') {
      return new Response(
        JSON.stringify({
          error: 'AI Copy requires the Indie plan or higher. Upgrade at /pricing to unlock this feature.',
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ── Parse request body ───────────────────────────────────────────
    let body: { appDescription?: string; appCategory?: string; copyStyle?: string }
    try {
      body = await req.json()
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON request body' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const {
      appDescription,
      appCategory = 'Productivity',
      copyStyle = 'benefit',
    } = body

    if (!appDescription?.trim()) {
      return new Response(JSON.stringify({ error: 'appDescription is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const styleGuide: Record<string, string> = {
      benefit:      'Focus on the outcome and emotional benefit the user gets (aspirational, outcome-focused)',
      feature:      'Focus on key capabilities and differentiators (specific, technical, clear)',
      social_proof: 'Use social proof, trust signals, or user traction (e.g., "Join 100K users who…")',
    }
    const styleInstruction = styleGuide[copyStyle] ?? styleGuide['benefit']

    // ── System prompt forces strict JSON schema ──────────────────────
    const systemPrompt = `You are an expert App Store copywriter who specialises in high-converting screenshot headlines.
Your output must always be valid JSON matching exactly this schema — no extra keys, no markdown, no prose:
{
  "suggestions": [
    { "text": string, "style": string, "charCount": number }
  ]
}`

    const userPrompt = `App Description: ${appDescription.trim()}
App Category: ${appCategory}
Copy Style: ${styleInstruction}

Generate exactly 5 short, punchy screenshot headlines.

Rules:
- Each headline must be under 40 characters (ideal for screenshot readability on mobile)
- Make them compelling and mobile-first
- Avoid generic phrases like "Best app", "Amazing", or "Revolutionary"
- Vary the opening word and sentence structure across all 5 headlines
- Set "style" to "${copyStyle}" on every suggestion
- Set "charCount" to the exact number of characters in "text"`

    console.log(
      `[ai-copy] Generating copy | user=${user.id} plan=${plan} category=${appCategory} style=${copyStyle}`
    )

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.8,
      max_tokens: 800,
    })

    const raw = completion.choices[0]?.message?.content
    if (!raw) throw new Error('No content returned from OpenAI. Please try again.')

    let parsed: { suggestions?: Array<{ text: string; style: string; charCount: number }> }
    try {
      parsed = JSON.parse(raw)
    } catch {
      console.error('[ai-copy] Malformed OpenAI JSON:', raw)
      throw new Error('AI returned malformed JSON. Please try again.')
    }

    if (!Array.isArray(parsed.suggestions) || parsed.suggestions.length === 0) {
      throw new Error('AI returned no suggestions. Please try a more specific app description.')
    }

    // Recompute charCount server-side for accuracy
    const suggestions = parsed.suggestions.map((s) => ({
      text: s.text ?? '',
      style: s.style ?? copyStyle,
      charCount: (s.text ?? '').length,
    }))

    console.log(`[ai-copy] Success | ${suggestions.length} suggestions | user=${user.id}`)

    return new Response(JSON.stringify({ suggestions }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'An unexpected error occurred'
    console.error('[ai-copy] Unhandled error:', message)
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
