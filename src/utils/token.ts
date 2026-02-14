const CHARS_PER_TOKEN = 4;

export function estimateTokensFromText(text: string): number {
  if (!text.trim()) {
    return 0;
  }
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

export function clampBudget(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.floor(value)));
}
