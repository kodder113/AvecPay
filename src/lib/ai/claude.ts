import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/**
 * Claude for Avec's AI reports. Off until ANTHROPIC_API_KEY is set.
 * Server-side refusal fallbacks are on: if the main model declines, the API
 * re-runs the request on a fallback model within the same call.
 */
export const AI_MODEL = process.env.AVEC_AI_MODEL ?? "claude-opus-5-5";

export function aiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

export class AiUnavailable extends Error {}

let client: Anthropic | null = null;
function anthropic(): Anthropic {
  client ??= new Anthropic();
  return client;
}

export async function askClaude(system: string, user: string): Promise<string> {
  if (!aiConfigured()) throw new AiUnavailable("not_configured");
  let response;
  try {
    response = await anthropic().beta.messages.create({
      model: AI_MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium" },
      system,
      messages: [{ role: "user", content: user }],
    });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) throw new AiUnavailable("rate_limited");
    if (e instanceof Anthropic.APIError) throw new AiUnavailable(`api_${e.status ?? "error"}`);
    throw e;
  }
  if (response.stop_reason === "refusal") throw new AiUnavailable("refused");
  const text = response.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
  if (!text) throw new AiUnavailable("empty");
  return text;
}
