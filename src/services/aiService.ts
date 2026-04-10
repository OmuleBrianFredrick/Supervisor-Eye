import { GoogleGenAI, Type, Modality, VideoGenerationReferenceType } from "@google/genai";
import { Report, Attachment } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export async function summarizeReport(report: Report): Promise<string> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
      contents: `Summarize this work report for a supervisor. Focus on key achievements, critical challenges, and pending items.
      
      Title: ${report.title}
      Description: ${report.description}
      Challenges: ${report.challenges}
      Pending Tasks: ${report.pendingTasks}`,
      config: {
        systemInstruction: "You are a professional supervisor's assistant. Provide concise, actionable summaries.",
      },
    });
    return response.text || "Summary unavailable.";
  } catch (error) {
    console.error("AI Summarization error:", error);
    return "Failed to generate AI summary.";
  }
}

export async function analyzeReport(report: Report): Promise<Report['aiAnalysis']> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analyze this work report for potential risks, anomalies, or areas of concern.
      
      Title: ${report.title}
      Description: ${report.description}
      Challenges: ${report.challenges}
      Pending Tasks: ${report.pendingTasks}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            riskLevel: {
              type: Type.STRING,
              enum: ["low", "medium", "high"],
              description: "The overall risk level of the reported situation."
            },
            anomalies: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "List of any suspicious or unusual findings."
            },
            suggestions: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Actionable suggestions for the supervisor."
            }
          },
          required: ["riskLevel", "anomalies", "suggestions"]
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text);
    }
    return undefined;
  } catch (error) {
    console.error("AI Analysis error:", error);
    return undefined;
  }
}

export async function chatWithGemini(message: string, history: any[] = []): Promise<string> {
  try {
    const chat = ai.chats.create({
      model: "gemini-3.1-pro-preview",
      config: {
        systemInstruction: "You are Supervisor Eye AI, a helpful assistant for workspace monitoring and report management. Use Google Search for up-to-date info.",
        tools: [{ googleSearch: {} }]
      }
    });

    const response = await chat.sendMessage({ message });
    return response.text || "I'm sorry, I couldn't process that.";
  } catch (error) {
    console.error("Chat error:", error);
    return "Error communicating with AI.";
  }
}

export async function analyzeImage(base64Data: string, mimeType: string, prompt: string): Promise<string> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: {
        parts: [
          { inlineData: { data: base64Data, mimeType } },
          { text: prompt }
        ]
      }
    });
    return response.text || "No analysis generated.";
  } catch (error) {
    console.error("Image analysis error:", error);
    return "Failed to analyze image.";
  }
}

export async function generateImage(prompt: string, size: "1K" | "2K" | "4K" = "1K", aspectRatio: string = "1:1"): Promise<string | undefined> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-image-preview",
      contents: { parts: [{ text: prompt }] },
      config: {
        imageConfig: {
          imageSize: size,
          aspectRatio: aspectRatio as any
        }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return undefined;
  } catch (error) {
    console.error("Image generation error:", error);
    return undefined;
  }
}

export async function generateVideo(prompt: string, aspectRatio: "16:9" | "9:16" = "16:9"): Promise<string | undefined> {
  try {
    let operation = await ai.models.generateVideos({
      model: 'veo-3.1-lite-generate-preview',
      prompt,
      config: {
        numberOfVideos: 1,
        resolution: '720p',
        aspectRatio
      }
    });

    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 10000));
      operation = await ai.operations.getVideosOperation({ operation });
    }

    return operation.response?.generatedVideos?.[0]?.video?.uri;
  } catch (error) {
    console.error("Video generation error:", error);
    return undefined;
  }
}

export async function textToSpeech(text: string): Promise<string | undefined> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  } catch (error) {
    console.error("TTS error:", error);
    return undefined;
  }
}
