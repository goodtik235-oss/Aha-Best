
import { GoogleGenAI, Type } from "@google/genai";
import { Caption } from "../types";

const getAIClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
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
  try {
    return JSON.parse(text);
  } catch (e) {
    console.error("Failed to parse Gemini transcription JSON", text);
    throw new Error("Invalid transcription format received from AI.");
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
  // Using the text-to-speech model
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: `Say with natural cadence: ${text}` }] }],
    config: {
      responseModalities: ["AUDIO" as any],
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
