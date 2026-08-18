export type MiithiiTask = "chat" | "subtitles" | "voice";
export type LlmProvider = "openrouter" | "aimlapi" | "sarvam";

export type LlmRoute = {
  provider: LlmProvider;
  model: string;
  reason: string;
};

export type RouteRequest = {
  task: MiithiiTask;
  language?: string;
  realtime?: boolean;
};

export function selectLlmRoute(request: RouteRequest): LlmRoute {
  if (request.task === "voice" || request.realtime) {
    return {
      provider: "sarvam",
      model: "sarvam-voice",
      reason: "Voice and Indic speech paths start with Sarvam."
    };
  }

  if (request.task === "subtitles") {
    return {
      provider: "sarvam",
      model: "sarvam-translate",
      reason: "Subtitle and translation jobs prefer Sarvam first."
    };
  }

  return {
    provider: "openrouter",
    model: "openrouter/auto",
    reason: "Chat can use the broadest model pool."
  };
}

export type TextGenerationInput = {
  task: MiithiiTask;
  prompt: string;
  system?: string;
  provider?: LlmProvider;
  model?: string;
};

export async function askLlm(input: TextGenerationInput): Promise<string> {
  const route = input.provider
    ? { provider: input.provider, model: input.model ?? "auto", reason: "Provider explicitly selected." }
    : selectLlmRoute({ task: input.task });

  throw new Error(
    `LLM provider '${route.provider}' is routed but not wired yet. Add provider clients in packages/llm-router before calling askLlm.`
  );
}

