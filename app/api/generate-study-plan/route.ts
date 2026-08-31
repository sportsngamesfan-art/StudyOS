import { groq } from '@/lib/groq'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json()

    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      )
    }

    const message = await groq.chat.completions.create({
      model: 'mixtral-8x7b-32768',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    })

    const responseText = message.choices[0]?.message?.content || ''

    // Parse the JSON response
    let plan = []
    try {
      // Try to extract JSON from the response
      const jsonMatch = responseText.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        plan = JSON.parse(jsonMatch[0])
      } else {
        plan = JSON.parse(responseText)
      }
    } catch (parseError) {
      console.error('Failed to parse plan:', parseError)
      console.error('Response text:', responseText)
      throw new Error('Failed to parse AI response. Please try again.')
    }

    return NextResponse.json({ plan })
  } catch (error) {
    console.error('Error generating study plan:', error)
    const message = error instanceof Error ? error.message : 'Failed to generate study plan'
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
