import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getGroqClient } from '@/lib/groq'
import { buildStudyPlanPrompt } from '@/lib/study-plan-prompt'

export const dynamic = 'force-dynamic'

/**
 * Reports whether the optional AI path is available so the plan page can
 * hide the button rather than offer something that will fail. Reveals only
 * a boolean. The admin toggle planned for later replaces this env check.
 */
export async function GET() {
  return NextResponse.json({ enabled: Boolean(process.env.GROQ_API_KEY) })
}

/**
 * Optional AI suggestions for the signed-in user. The deterministic
 * scheduler in lib/planner is the default path; this is an extra.
 *
 * The request body is deliberately ignored. The route reads the caller's own
 * timetable and pending assignments (RLS scopes the queries to them) and
 * builds the prompt itself, so it cannot be used as a general-purpose proxy
 * to the Groq key.
 */
export async function POST() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json(
      { error: 'AI suggestions are not enabled on this deployment' },
      { status: 503 }
    )
  }

  try {
    const [timetableRes, assignmentsRes] = await Promise.all([
      supabase
        .from('timetable')
        .select('day, subject, start_time, end_time')
        .eq('user_id', user.id),
      supabase
        .from('assignments')
        .select('title, subject, deadline, difficulty, hours_required')
        .eq('user_id', user.id)
        .eq('completed', false),
    ])
    if (timetableRes.error) throw timetableRes.error
    if (assignmentsRes.error) throw assignmentsRes.error

    const prompt = buildStudyPlanPrompt(
      timetableRes.data ?? [],
      assignmentsRes.data ?? []
    )

    const groq = getGroqClient()
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    })

    const responseText = completion.choices[0]?.message?.content || ''

    let plan: unknown = []
    try {
      const jsonMatch = responseText.match(/\[[\s\S]*\]/)
      plan = JSON.parse(jsonMatch ? jsonMatch[0] : responseText)
    } catch (parseError) {
      console.error('Failed to parse plan:', parseError)
      console.error('Response text:', responseText)
      throw new Error('Failed to parse AI response. Please try again.')
    }

    return NextResponse.json({ plan })
  } catch (error) {
    console.error('Error generating study plan:', error)
    const message =
      error instanceof Error ? error.message : 'Failed to generate study plan'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
