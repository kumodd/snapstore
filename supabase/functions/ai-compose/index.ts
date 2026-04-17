import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import OpenAI from 'https://esm.sh/openai@4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
if (!OPENAI_API_KEY) console.error('[ai-compose] FATAL: OPENAI_API_KEY not set.')
const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null

const systemPrompt = `You are an expert App Store screenshot designer and ASO specialist.
Analyze the provided app screenshots and return actionable design recommendations.
Your output must be valid JSON matching this schema exactly — no markdown, no prose outside the JSON:
{
  "appInsights": string,
  "overallTone": string,
  "palette": [{ "hex": string, "label": string }],
  "slides": [{ "index": number, "headline": string, "subheadline": string, "layoutTip": string, "backgroundColor": string }],
  "cta": string
}
Rules:
- palette: exactly 4 colors that complement the app's visual style
- slides: one entry per screenshot, in order
- headline: max 40 characters
- subheadline: max 60 characters
- backgroundColor: a valid hex color (e.g. #0F172A)
- cta: max 40 characters`

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  if (!openai) {
    return new Response(JSON.stringify({ error: 'AI service is temporarily unavailable.' }), {
      status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles').select('plan').eq('id', user.id).single()
    if (profileError) console.warn('[ai-compose] Profile fetch failed:', profileError.message)

    const plan = profile?.plan ?? 'free'
    if (plan === 'free') {
      return new Response(JSON.stringify({ error: 'AI Composer requires the Indie plan or higher.' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let body: { screenshots?: string[]; appDescription?: string; appCategory?: string }
    try { body = await req.json() }
    catch { return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }) }

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

    const userPrompt = `I have ${screenshots.length} app screenshot(s) attached.${appDescription ? `\nApp description: ${appDescription}` : ''}${appCategory ? `\nApp category: ${appCategory}` : ''}

Analyze these screenshots and provide:
1. A color palette (4 colors) that complements the app's visual style
2. A compelling headline and subheadline for each screenshot (under 40 and 60 chars)
3. Layout tips for each screenshot
4. A background color recommendation per screenshot
5. An overall call-to-action for the screenshot set

Focus on high-converting App Store marketing assets. Return exactly ${screenshots.length} slide entries.`

    const imageContent = screenshots.map((dataUrl: string) => ({
      type: 'image_url' as const,
      image_url: { url: dataUrl, detail: 'low' as const },
    }))

    console.log(`[ai-compose] Generating for user=${user.id} plan=${plan} screenshots=${screenshots.length}`)

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

    // Enforce char limits server-side
    result.slides = result.slides.map((s: any, i: number) => ({
      index: i,
      headline:        String(s.headline ?? '').slice(0, 40),
      subheadline:     String(s.subheadline ?? '').slice(0, 60),
      layoutTip:       String(s.layoutTip ?? ''),
      backgroundColor: /^#[0-9A-Fa-f]{6}$/.test(s.backgroundColor) ? s.backgroundColor : '#0F172A',
    }))

    console.log(`[ai-compose] Success | user=${user.id}`)
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'An unexpected error occurred'
    console.error('[ai-compose] Error:', msg)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
