import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import OpenAI from 'https://esm.sh/openai@4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
if (!OPENAI_API_KEY) console.error('[ai-copy] FATAL: OPENAI_API_KEY not set.')
const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null

// ── Shared auth helper ───────────────────────────────────────────────
async function authenticate(req: Request) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return { error: 'Unauthorized', status: 401 }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return { error: 'Unauthorized', status: 401 }

  const { data: profile, error: profileError } = await supabase
    .from('profiles').select('plan').eq('id', user.id).single()
  if (profileError) console.warn('[ai-copy] Profile fetch failed:', profileError.message)

  return { user, supabase, plan: (profile?.plan ?? 'free') as string }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  if (!openai) {
    return new Response(
      JSON.stringify({ error: 'AI service is temporarily unavailable. Please contact support.' }),
      { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    const auth = await authenticate(req)
    if ('error' in auth && !('user' in auth)) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: auth.status as number,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { user, plan } = auth as { user: any; plan: string }

    if (plan === 'free') {
      return new Response(
        JSON.stringify({ error: 'AI features require the Indie plan or higher. Upgrade at /pricing.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let body: Record<string, any>
    try { body = await req.json() }
    catch { return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }) }

    const action = body.action ?? 'copy'

    // ================================================================
    // ACTION: compose — GPT-4o Vision analysis of screenshots
    // ================================================================
    if (action === 'compose') {
      const { screenshots = [], appDescription = '', appCategory = '' } = body

      if (!Array.isArray(screenshots) || screenshots.length === 0) {
        return new Response(JSON.stringify({ error: 'At least one screenshot is required.' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      if (screenshots.length > 5) {
        return new Response(JSON.stringify({ error: 'Maximum 5 screenshots allowed.' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const systemPrompt = `You are an expert App Store screenshot designer and ASO specialist.
Analyse the provided app screenshots and return actionable design recommendations.
Output ONLY valid JSON matching this schema — no markdown, no prose:
{
  "appInsights": string,
  "overallTone": string,
  "palette": [{ "hex": string, "label": string }],
  "slides": [{ "index": number, "headline": string, "subheadline": string, "layoutTip": string, "backgroundColor": string }],
  "cta": string
}
Rules: palette has exactly 4 entries. slides has one entry per screenshot in order.
headline ≤ 40 chars, subheadline ≤ 60 chars, backgroundColor is a valid hex like #0F172A, cta ≤ 40 chars.`

      const userPrompt = `${screenshots.length} app screenshot(s) attached.${appDescription ? `\nApp: ${appDescription}` : ''}${appCategory ? `\nCategory: ${appCategory}` : ''}
Provide: 4-color palette complementing the app style, headline + subheadline + background color + layout tip for each screenshot, and an overall CTA.
Return exactly ${screenshots.length} slide entries.`

      const imageContent = screenshots.map((url: string) => ({
        type: 'image_url' as const,
        image_url: { url, detail: 'low' as const },
      }))

      console.log(`[ai-copy/compose] user=${user.id} screenshots=${screenshots.length}`)

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: [{ type: 'text' as const, text: userPrompt }, ...imageContent] },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 1500,
      })

      const raw = completion.choices[0]?.message?.content
      if (!raw) throw new Error('No content returned from OpenAI.')

      let result: any
      try { result = JSON.parse(raw) }
      catch { throw new Error('AI returned malformed JSON. Please try again.') }

      if (!Array.isArray(result.slides) || result.slides.length === 0) {
        throw new Error('AI returned no slide suggestions. Please try again.')
      }

      result.slides = result.slides.map((s: any, i: number) => ({
        index: i,
        headline:        String(s.headline ?? '').slice(0, 40),
        subheadline:     String(s.subheadline ?? '').slice(0, 60),
        layoutTip:       String(s.layoutTip ?? ''),
        backgroundColor: /^#[0-9A-Fa-f]{6}$/.test(s.backgroundColor ?? '') ? s.backgroundColor : '#0F172A',
      }))

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ================================================================
    // ACTION: copy (default) — text headline generation
    // ================================================================
    const {
      appDescription,
      appCategory = 'Productivity',
      copyStyle = 'benefit',
    } = body

    if (!appDescription?.trim()) {
      return new Response(JSON.stringify({ error: 'appDescription is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const styleGuide: Record<string, string> = {
      benefit:      'Focus on the outcome and emotional benefit the user gets (aspirational, outcome-focused)',
      feature:      'Focus on key capabilities and differentiators (specific, technical, clear)',
      social_proof: 'Use social proof, trust signals, or user traction (e.g., "Join 100K users who…")',
    }
    const styleInstruction = styleGuide[copyStyle] ?? styleGuide['benefit']

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
- Each headline must be under 40 characters
- Make them compelling and mobile-first
- Avoid generic phrases like "Best app", "Amazing", or "Revolutionary"
- Vary the opening word and sentence structure across all 5
- Set "style" to "${copyStyle}" on every suggestion
- Set "charCount" to the exact number of characters in "text"`

    console.log(`[ai-copy/copy] user=${user.id} category=${appCategory} style=${copyStyle}`)

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
    try { parsed = JSON.parse(raw) }
    catch { throw new Error('AI returned malformed JSON. Please try again.') }

    if (!Array.isArray(parsed.suggestions) || parsed.suggestions.length === 0) {
      throw new Error('AI returned no suggestions. Please try a more specific description.')
    }

    const suggestions = parsed.suggestions.map((s) => ({
      text: s.text ?? '',
      style: s.style ?? copyStyle,
      charCount: (s.text ?? '').length,
    }))

    console.log(`[ai-copy/copy] Success | ${suggestions.length} suggestions | user=${user.id}`)

    return new Response(JSON.stringify({ suggestions }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'An unexpected error occurred'
    console.error('[ai-copy] Error:', message)
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
