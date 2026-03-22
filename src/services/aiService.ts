import { GoogleGenAI, Type } from "@google/genai";
import { Report } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export async function summarizeReport(report: Report): Promise<string> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
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
