export type AIMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AIRequestOptions = {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
};

export type AIUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

export type AIResponse = {
  content: string;
  usage?: AIUsage;
};


