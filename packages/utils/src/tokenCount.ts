/** Rough token estimator: ~4 chars per token */
export function tokenCount(text: string): number {
  return Math.ceil(text.length / 4)
}
