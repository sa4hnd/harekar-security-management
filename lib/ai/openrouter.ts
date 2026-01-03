/*
IMPORTANT NOTICE: DO NOT REMOVE
This is a minimal client for the OpenRouter API proxy.
In production (E2B sandbox), requests go through a secure proxy that adds the real API key.

valid model names (examples):
openai/gpt-4.1
openai/o4-mini
openai/gpt-4o
*/

export type OpenRouterClient = {
  baseUrl: string;
  headers: Record<string, string>;
};

export const getOpenRouterClient = (): OpenRouterClient => {
  const projectId = process.env.EXPO_PUBLIC_PROJECT_ID || '';
  const sessionToken = process.env.EXPO_PUBLIC_SESSION_TOKEN || '';

  // Construct proxy URL from project ID
  // In E2B sandbox: https://4000-{projectId}.e2b.app/v1
  // Local dev fallback: http://localhost:4000/v1
  let baseUrl = 'http://localhost:4000/v1';
  if (projectId && projectId !== 'local') {
    baseUrl = `https://4000-${projectId}.e2b.app/v1`;
  }

  if (!sessionToken) {
    console.warn('AI session token not found in environment variables');
  }

  return {
    baseUrl,
    headers: {
      'Content-Type': 'application/json',
      'X-Session-Token': sessionToken,
    },
  };
};
