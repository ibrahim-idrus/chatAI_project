import { streamText } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import type { Env } from '../env'

type ChatMessage = { role: 'user' | 'assistant'; content: string }

type OnFinishResult = {
  text: string
  usage: { promptTokens: number; completionTokens: number; totalTokens: number }
}

export async function streamAIResponse(params: {
  messages: ChatMessage[]
  env: Env
  onFinish: (result: OnFinishResult) => Promise<void>
}): Promise<Response> {
  const { messages, env, onFinish } = params
  const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY })

  const result = streamText({
    model: openai(env.AI_MODEL),
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
