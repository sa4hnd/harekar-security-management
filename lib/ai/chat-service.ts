/*
IMPORTANT NOTICE: DO NOT REMOVE
./lib/ai/chat-service.ts
If the user wants to use AI to generate text, answer questions, or analyze images you can use the functions defined in this file to communicate with OpenRouter models (OpenAI, Anthropic, Grok routed via OpenRouter).
*/
import { AIMessage, AIRequestOptions, AIResponse } from "@/lib/types/ai";
import { getOpenRouterClient } from "@/lib/ai/openrouter";

type ORChatResponse = {
  id: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  choices: Array<{ index: number; message: { role: string; content: string } }>;
};

async function postChat(model: string, messages: AIMessage[], options?: AIRequestOptions): Promise<AIResponse> {
  const client = getOpenRouterClient();
  const res = await fetch(`${client.baseUrl}/chat/completions`, {
    method: "POST",
    headers: client.headers,
    body: JSON.stringify({
      model: options?.model || model,
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 2048,
      top_p: options?.topP,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`OpenRouter error ${res.status}: ${text}`);
  }
  const data = (await res.json()) as ORChatResponse;
  const content = data.choices[0]?.message?.content ?? "";
  return {
    content,
    usage: {
      promptTokens: data.usage?.prompt_tokens ?? 0,
      completionTokens: data.usage?.completion_tokens ?? 0,
      totalTokens: data.usage?.total_tokens ?? 0,
    },
  };
}

export const getOpenAITextResponse = async (
  messages: AIMessage[],
  options?: AIRequestOptions
): Promise<AIResponse> => {
  const defaultModel = "openai/gpt-4o"; // accepts images as well
  return postChat(defaultModel, messages, options);
};

export const getOpenAIChatResponse = async (prompt: string): Promise<AIResponse> => {
  return getOpenAITextResponse([{ role: "user", content: prompt }]);
};

export const getAnthropicTextResponse = async (
  messages: AIMessage[],
  options?: AIRequestOptions
): Promise<AIResponse> => {
  const defaultModel = "anthropic/claude-3.5-sonnet";
  return postChat(defaultModel, messages, options);
};

export const getAnthropicChatResponse = async (prompt: string): Promise<AIResponse> => {
  return getAnthropicTextResponse([{ role: "user", content: prompt }]);
};

export const getGrokTextResponse = async (
  messages: AIMessage[],
  options?: AIRequestOptions
): Promise<AIResponse> => {
  const defaultModel = "xai/grok-3";
  return postChat(defaultModel, messages, options);
};

export const getGrokChatResponse = async (prompt: string): Promise<AIResponse> => {
  return getGrokTextResponse([{ role: "user", content: prompt }]);
};


