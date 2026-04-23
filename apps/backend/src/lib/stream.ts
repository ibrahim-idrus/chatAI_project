import type { LanguageModel } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import type { Env } from '../env'

export function getModel(env: Env): LanguageModel {
  const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY })
  return openai(env.AI_MODEL)
}
