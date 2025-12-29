import { GoogleGenAI, Type } from "@google/genai";
import { Question, Language } from "../types";

// Helper to sanitize JSON string if Markdown code blocks are included
const cleanJson = (text: string) => {
  return text.replace(/```json/g, '').replace(/```/g, '').trim();
};

// Helper for retry logic
const fetchWithRetry = async <T>(
  operation: () => Promise<T>,
  retries = 3,
  delay = 1000
): Promise<T> => {
  try {
    return await operation();
  } catch (error: any) {
    if (retries <= 0) throw error;

    // Check if error is related to quota (429) or overload (503)
    const isRetryable =
      error?.status === 429 ||
      error?.status === 503 ||
      error?.response?.status === 429 ||
      error?.message?.includes('429') ||
      error?.message?.includes('Quota exceeded');

    if (!isRetryable) throw error;

    console.warn(`API Limit hit. Retrying in ${delay}ms... (${retries} attempts left)`);
    await new Promise(resolve => setTimeout(resolve, delay));

    return fetchWithRetry(operation, retries - 1, delay * 2); // Exponential backoff
  }
};

export const generateQuizQuestions = async (
  apiKey: string,
  theme: string,
  count: number,
  language: Language,
  difficulty: string,
  questionTypes: 'mixed' | 'mc' | 'open' = 'mixed'
): Promise<Question[]> => {
  if (!apiKey) throw new Error("API Key required");

  const ai = new GoogleGenAI({ apiKey });

  // System instruction to ensure personality and strict formatting
  const systemInstruction = `
    You are 'ElBureau', a chaotic, witty, and high-energy game show host AI.
    Your goal is to entertain, challenge, and slightly roast the players.
    Generate a quiz based on the requested theme.
    The output MUST be valid JSON.
    IMPORTANT: You MUST generate all content (questions, options, hints, explanations) in the requested language: "${language}".
    If the language is Arabic (ar), ensure all text is in proper Arabic script and culturally relevant if possible.
    If the language is French (fr), ensure the content is in French.
  `;

  // Schema definition for strictly typed JSON
  const responseSchema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING },
        text: { type: Type.STRING },
        type: { type: Type.STRING, enum: ['mc', 'open'] },
        options: { type: Type.ARRAY, items: { type: Type.STRING } },
        correctAnswer: { type: Type.STRING },
        hint: { type: Type.STRING },
        explanation: { type: Type.STRING },
        translations: {
          type: Type.OBJECT,
          properties: {
            en: {
              type: Type.OBJECT,
              properties: {
                text: { type: Type.STRING },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                hint: { type: Type.STRING },
                explanation: { type: Type.STRING },
                correctAnswer: { type: Type.STRING },
              }
            },
            fr: {
              type: Type.OBJECT,
              properties: {
                text: { type: Type.STRING },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                hint: { type: Type.STRING },
                explanation: { type: Type.STRING },
                correctAnswer: { type: Type.STRING },
              }
            },
            ar: {
              type: Type.OBJECT,
              properties: {
                text: { type: Type.STRING },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                hint: { type: Type.STRING },
                explanation: { type: Type.STRING },
                correctAnswer: { type: Type.STRING },
              }
            }
          }
        }
      },
      required: ['id', 'text', 'type', 'correctAnswer', 'explanation', 'translations'],
    },
  };

  let typeInstruction = "Include a mix of Open Ended and Multiple Choice questions.";
  if (questionTypes === 'mc') {
    typeInstruction = "All questions MUST be Multiple Choice ('mc') with 4 options.";
  } else if (questionTypes === 'open') {
    typeInstruction = "All questions MUST be Open Ended ('open'). Do not provide options.";
  }

  const prompt = `
    Generate ${count} quiz questions about "${theme}".
    Difficulty: ${difficulty}.
    Question Type Constraint: ${typeInstruction}
    
    CRITICAL: You must allow players to play in their own language.
    For EACH question, you MUST provide translations for: English (en), French (fr), and Arabic (ar).
    
    Populate the 'translations' object with keys 'en', 'fr', 'ar'.
    For the main root fields (text, options, etc), use the requested language: "${language}".
    
    Rules for Translations:
    - 'text': The question itself.
    - 'options': 4 choices (only for 'mc'). Empty for 'open'.
    - 'hint': Witty hint in that language.
    - 'explanation': Short funny host comment in that language.
    - 'correctAnswer': The answer text in that language.
    
    Rules:
    1. The main root 'text' MUST be in ${language}.
    2. The main root 'options' MUST be in ${language}.
    3. The main root 'correctAnswer' MUST be in ${language}.
    4. Provide a witty 'hint' and 'explanation' in all languages.
  `;

  try {
    const response = await fetchWithRetry(() => ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      },
    }));

    if (response.text) {
      const questions = JSON.parse(cleanJson(response.text)) as Question[];
      return questions;
    }
    throw new Error("No content generated");
  } catch (error) {
    console.error("Gemini Error:", error);
    throw error;
  }
};

export const generateFinalQuestion = async (
  apiKey: string,
  theme: string,
  language: Language,
  difficulty: string
): Promise<Question> => {
  const ai = new GoogleGenAI({ apiKey });

  const systemInstruction = `You are 'ElBureau'. Generate ONE extremely challenging, high-stakes final quiz question in ${language}.`;

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      id: { type: Type.STRING },
      text: { type: Type.STRING },
      type: { type: Type.STRING, enum: ['open'] }, // Final question is always open-ended for drama
      correctAnswer: { type: Type.STRING },
      explanation: { type: Type.STRING },
      translations: {
        type: Type.OBJECT,
        properties: {
          en: {
            type: Type.OBJECT,
            properties: {
              text: { type: Type.STRING },
              explanation: { type: Type.STRING },
              correctAnswer: { type: Type.STRING },
            }
          },
          fr: {
            type: Type.OBJECT,
            properties: {
              text: { type: Type.STRING },
              explanation: { type: Type.STRING },
              correctAnswer: { type: Type.STRING },
            }
          },
          ar: {
            type: Type.OBJECT,
            properties: {
              text: { type: Type.STRING },
              explanation: { type: Type.STRING },
              correctAnswer: { type: Type.STRING },
            }
          }
        }
      }
    },
    required: ['id', 'text', 'type', 'correctAnswer', 'explanation', 'translations'],
  };

  const prompt = `
    Generate 1 FINAL BOSS question about "${theme}".
    Difficulty: ${difficulty} (Make it harder than usual).
    Type: Open Ended.
    
    Generate translations for English, French, and Arabic in the 'translations' object.
    The main root fields should be in ${language}.
    The explanation should be dramatic and declare the end of the game.
  `;

  try {
    const response = await fetchWithRetry(() => ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      },
    }));

    if (response.text) {
      return JSON.parse(cleanJson(response.text)) as Question;
    }
    throw new Error("No final question generated");
  } catch (error) {
    console.error("Gemini Final Error:", error);
    throw error;
  }
};

export const validateAnswerWithAI = async (
  apiKey: string,
  question: string,
  correctAnswer: string,
  userAnswer: string,
  language: Language
): Promise<boolean> => {
  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
    Question: "${question}"
    Official Answer: "${correctAnswer}"
    User Answer: "${userAnswer}"
    Language Context: ${language}

    The user is answering in ${language}.
    Is the User Answer essentially correct based on the Official Answer? 
    Allow for minor typos or phonetic spelling.
    Respond with ONLY "TRUE" or "FALSE".
  `;

  try {
    const response = await fetchWithRetry(() => ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    }));
    const text = response.text?.trim().toUpperCase();
    return text?.includes("TRUE") || false;
  } catch (e) {
    console.error("Validation error", e);
    return false; // Default to strict if AI fails
  }
};