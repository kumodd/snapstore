import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import OpenAI from 'https://esm.sh/openai@4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const openai = new OpenAI({ apiKey: Deno.env.get('OPENAI_API_KEY') })

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Authenticate user
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
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Check user plan
    const { data: profile } = await supabase.from('profiles').select('plan').eq('id', user.id).single()
    if (profile?.plan === 'free') {
      return new Response(JSON.stringify({ error: 'AI features require Indie plan or higher' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Parse request
    const { appDescription, appCategory, copyStyle } = await req.json()

    if (!appDescription) {
      return new Response(JSON.stringify({ error: 'appDescription is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const styleGuide = {
      benefit: 'Focus on the benefit the user gets (outcome-focused, emotional, aspirational)',
      feature: 'Focus on the key features and capabilities (specific, technical, clear)',
      social_proof: 'Use social proof, trust signals, or user count (e.g. "Join 100K users who...")',
    }[copyStyle ?? 'benefit']

    const prompt = `You are an expert App Store copywriter specializing in high-converting screenshot headlines.

App Description: ${appDescription}
App Category: ${appCategory}
Copy Style: ${styleGuide}

Generate exactly 5 short, punchy screenshot headlines for this app.

Rules:
- Each headline must be under 40 characters (ideal for screenshot readability)
- Make them compelling and mobile-first
- Avoid generic phrases like "Best app" or "Amazing"
- Vary the structure across the 5 headlines
- Return ONLY valid JSON in this exact format:
{
  "suggestions": [
    { "text": "Headline here", "style": "${copyStyle}", "charCount": 22 },
    ...
  ]
}`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.8,
      max_tokens: 500,
    })

    const content = completion.choices[0]?.message?.content
    if (!content) throw new Error('No response from OpenAI')

    const parsed = JSON.parse(content)

    // Ensure charCount is accurate
    const suggestions = (parsed.suggestions ?? []).map((s: any) => ({
      ...s,
      charCount: s.text?.length ?? 0,
    }))

    return new Response(JSON.stringify({ suggestions }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
