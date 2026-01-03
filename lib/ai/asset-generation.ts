/*
IMPORTANT NOTICE: DO NOT REMOVE
This is a custom asset generation service using OpenRouter image-capable models.
If the user wants to build an app that generates images, assets, icons, or anything else, use this service.
You may update this service, but you should not need to. Does not support video or audio generation.
*/

import { getOpenRouterClient } from "@/lib/ai/openrouter";

type ImageGenOptions = {
  model?: string; // e.g. "google/gemini-2.5-flash-image-preview"
  aspectRatio?:
    | "1:1"
    | "2:3"
    | "3:2"
    | "3:4"
    | "4:3"
    | "4:5"
    | "5:4"
    | "9:16"
    | "16:9"
    | "21:9";
};

/**
 * Generate a single image as a base64 data URL using OpenRouter image-capable models.
 * Returns the first image URL from the response (data:image/...;base64,....)
 */
export async function generateImage(
  prompt: string,
  options?: ImageGenOptions
): Promise<string> {
  const client = getOpenRouterClient();
  const model = options?.model || "google/gemini-2.5-flash-image-preview";

  const body: Record<string, unknown> = {
    model,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
    modalities: ["image", "text"],
  };

  if (options?.aspectRatio) {
    body.image_config = { aspect_ratio: options.aspectRatio };
  }

  const res = await fetch(`${client.baseUrl}/chat/completions`, {
    method: "POST",
    headers: client.headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`OpenRouter image generation error ${res.status}: ${txt}`);
  }

  const data = (await res.json()) as any;
  const message = data?.choices?.[0]?.message;
  const images = message?.images as
    | Array<{ type: string; image_url: { url: string } }>
    | undefined;
  const first = images?.[0]?.image_url?.url;
  if (!first) {
    throw new Error("No image returned by the model");
  }
  return first;
}

export function convertAspectRatioToSize(
  aspectRatio: string,
): "1024x1024" | "1536x1024" | "1024x1536" | "auto" {
  switch (aspectRatio) {
    case "1:1":
      return "1024x1024";
    case "3:2":
      return "1536x1024"; // map to closest preset
    case "2:3":
      return "1024x1536"; // map to closest preset
    default:
      return "auto";
  }
}


