
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { Caption } from "../types";

const getAIClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API_KEY missing");
  return new GoogleGenAI({ apiKey });
};

export async function transcribeAudio(audioBase64: string, signal?: AbortSignal): Promise<Caption[]> {
  const ai = getAIClient();
  const prompt = `Transcribe this audio. Return ONLY a JSON array of objects: {id: string, start: number, end: number, text: string}. Keep segments under 4s.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        { text: prompt },
        { inlineData: { mimeType: 'audio/wav', data: audioBase64 } }
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

    return JSON.parse(response.text || '[]');
  } catch (err: any) {
    console.error("Transcription Error:", err);
    throw new Error(err.message || "Transcription failed");
  }
}

export async function translateCaptions(captions: Caption[], targetLanguage: string): Promise<Caption[]> {
  const ai = getAIClient();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [{ text: `Translate to ${targetLanguage}: ${JSON.stringify(captions)}` }],
    config: { responseMimeType: "application/json" }
  });
  return JSON.parse(response.text || '[]');
}

export async function generateSpeech(text: string): Promise<string> {
  const ai = getAIClient();
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: `Naturally: ${text}` }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } }
    },
  });

  const base64 = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64) throw new Error("TTS failed");
  return base64;
}
