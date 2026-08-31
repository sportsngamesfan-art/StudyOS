import Groq from 'groq-sdk'

const groqApiKey = process.env.GROQ_API_KEY

if (!groqApiKey) {
  throw new Error('GROQ_API_KEY is not defined')
}

export const groq = new Groq({
  apiKey: groqApiKey,
})
