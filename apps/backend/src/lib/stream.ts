import { streamText } from 'ai'
import type { LanguageModel } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import type { Env } from '../env'

type ChatMessage = { role: 'user' | 'assistant'; content: string }

type OnFinishResult = {
  text: string
  usage: { promptTokens: number; completionTokens: number; totalTokens: number }
}

export function getModel(env: Env): LanguageModel {
  const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY })
  return openai(env.AI_MODEL)
}

export async function streamAIResponse(params: {
  messages: ChatMessage[]
  env: Env
  onFinish: (result: OnFinishResult) => Promise<void>
}): Promise<Response> {
  const { messages, env, onFinish } = params

  const result = streamText({
    model: getModel(env),
    system: env.SYSTEM_PROMPT,
    messages,
    onFinish: async ({ text, usage }) => {
      await onFinish({
        text,
        usage: {
          promptTokens: usage.inputTokens ?? 0,
          completionTokens: usage.outputTokens ?? 0,
          totalTokens: usage.totalTokens ?? 0,
        },
      })
    },
  })

  return result.toTextStreamResponse()
}
