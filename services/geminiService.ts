
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { Caption } from "../types";

/**
 * Helper to get a fresh AI client.
 * Using process.env.API_KEY directly as required.
 */
const getAIClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("Gemini API Key is not configured in the environment.");
  }
  return new GoogleGenAI({ apiKey });
};

/**
 * Transcribe audio using Gemini 3 Flash
 */
export async function transcribeAudio(audioBase64: string, signal?: AbortSignal): Promise<Caption[]> {
  const ai = getAIClient();
  const prompt = `
    Analyze the provided audio and generate precise transcriptions with start and end timestamps in seconds.
    The output must be a valid JSON array of objects.
    Each object must have: "id" (string), "start" (number), "end" (number), "text" (string).
    Keep segments natural, between 2 to 5 seconds long.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        { text: prompt },
        {
          inlineData: {
            mimeType: 'audio/wav',
            data: audioBase64
          }
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              start: { type: Type.NUMBER },
              end: { type: Type.NUMBER },
              text: { type: Type.STRING }
            },
            required: ["id", "start", "end", "text"]
          }
        }
      }
    });

    const text = response.text || '[]';
    return JSON.parse(text);
  } catch (err: any) {
    if (err.message?.includes("401") || err.message?.includes("403")) {
      throw new Error("Gemini API authentication failed. Please check your API key permissions.");
    }
    throw err;
  }
}

/**
 * Translate captions using Gemini 3 Flash
 */
export async function translateCaptions(
  captions: Caption[], 
  targetLanguage: string, 
  signal?: AbortSignal
): Promise<Caption[]> {
  const ai = getAIClient();
  const prompt = `Translate the following captions into ${targetLanguage}. Maintain the JSON structure and the exact same 'id', 'start', and 'end' values. Only translate the 'text' field.`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [
      { text: prompt },
      { text: JSON.stringify(captions) }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            start: { type: Type.NUMBER },
            end: { type: Type.NUMBER },
            text: { type: Type.STRING }
          },
          required: ["id", "start", "end", "text"]
        }
      }
    }
  });

  const text = response.text || '[]';
  return JSON.parse(text);
}

/**
 * Generate speech (dubbing) using Gemini 2.5 Flash TTS
 */
export async function generateSpeech(text: string, signal?: AbortSignal): Promise<string> {
  const ai = getAIClient();
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: `Say with natural cadence: ${text}` }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Kore' },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) {
    throw new Error("Failed to generate audio from Gemini.");
  }
  return base64Audio;
}
