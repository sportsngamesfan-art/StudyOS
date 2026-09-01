import Groq from 'groq-sdk'

let client: Groq | null = null

/**
 * Lazily create the Groq client. Constructing it at module scope would throw
 * during `next build` (page-data collection) on machines without the key set.
 */
export function getGroqClient(): Groq {
  if (!client) {
    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) {
      throw new Error(
        'GROQ_API_KEY is not configured. Add it in your environment settings.'
      )
    }
    client = new Groq({ apiKey })
  }
  return client
}
