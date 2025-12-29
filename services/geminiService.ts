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

// Reusable translation schema block
const createTranslationSchema = (includeOptions: boolean) => ({
  type: Type.OBJECT,
  properties: {
    en: {
      type: Type.OBJECT,
      properties: {
        text: { type: Type.STRING },
        correctAnswer: { type: Type.STRING },
        hint: { type: Type.STRING },
        explanation: { type: Type.STRING },
        ...(includeOptions ? { options: { type: Type.ARRAY, items: { type: Type.STRING } } } : {}),
      },
      required: ['text', 'correctAnswer', 'explanation'],
    },
    fr: {
      type: Type.OBJECT,
      properties: {
        text: { type: Type.STRING },
        correctAnswer: { type: Type.STRING },
        hint: { type: Type.STRING },
        explanation: { type: Type.STRING },
        ...(includeOptions ? { options: { type: Type.ARRAY, items: { type: Type.STRING } } } : {}),
      },
      required: ['text', 'correctAnswer', 'explanation'],
    },
    ar: {
      type: Type.OBJECT,
      properties: {
        text: { type: Type.STRING },
        correctAnswer: { type: Type.STRING },
        hint: { type: Type.STRING },
        explanation: { type: Type.STRING },
        ...(includeOptions ? { options: { type: Type.ARRAY, items: { type: Type.STRING } } } : {}),
      },
      required: ['text', 'correctAnswer', 'explanation'],
    },
  },
  required: ['en', 'fr', 'ar'],
});

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

  const systemInstruction = `
    You are 'ElBureau', a chaotic, witty, and high-energy game show host AI.
    Your goal is to entertain, challenge, and slightly roast the players.
    Generate a quiz based on the requested theme.
    The output MUST be valid JSON.
    
    CRITICAL MULTILINGUAL REQUIREMENT:
    You MUST generate COMPLETE translations for EVERY question in THREE languages: English (en), French (fr), and Arabic (ar).
    Each translation object MUST contain: text, correctAnswer, hint, explanation.
    For multiple choice questions, each translation MUST also contain the 'options' array translated.
    DO NOT skip any language. All three (en, fr, ar) are REQUIRED.
  `;

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
        translations: createTranslationSchema(true),
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
    
    CRITICAL MULTILINGUAL REQUIREMENT:
    For EACH question, you MUST provide COMPLETE translations in the 'translations' object.
    The 'translations' object MUST have THREE keys: 'en', 'fr', 'ar'.
    
    Each translation (en, fr, ar) MUST contain:
    - 'text': The question translated to that language
    - 'correctAnswer': The correct answer translated to that language
    - 'hint': A witty hint in that language
    - 'explanation': A funny host comment in that language
    - 'options': (for MC only) The 4 choices translated to that language
    
    The ROOT level fields (text, options, correctAnswer, etc.) should be in: "${language}".
    
    Example structure for translations:
    {
      "translations": {
        "en": { "text": "...", "correctAnswer": "...", "hint": "...", "explanation": "...", "options": ["...", "...", "...", "..."] },
        "fr": { "text": "...", "correctAnswer": "...", "hint": "...", "explanation": "...", "options": ["...", "...", "...", "..."] },
        "ar": { "text": "...", "correctAnswer": "...", "hint": "...", "explanation": "...", "options": ["...", "...", "...", "..."] }
      }
    }
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

  const systemInstruction = `
    You are 'ElBureau'. Generate ONE extremely challenging, high-stakes final quiz question.
    
    CRITICAL MULTILINGUAL REQUIREMENT:
    You MUST generate COMPLETE translations in THREE languages: English (en), French (fr), and Arabic (ar).
    Each translation MUST contain: text, correctAnswer, explanation.
    DO NOT skip any language. All three (en, fr, ar) are REQUIRED.
  `;

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      id: { type: Type.STRING },
      text: { type: Type.STRING },
      type: { type: Type.STRING, enum: ['open'] },
      correctAnswer: { type: Type.STRING },
      explanation: { type: Type.STRING },
      translations: createTranslationSchema(false),
    },
    required: ['id', 'text', 'type', 'correctAnswer', 'explanation', 'translations'],
  };

  const prompt = `
    Generate 1 FINAL BOSS question about "${theme}".
    Difficulty: ${difficulty} (Make it harder than usual).
    Type: Open Ended.
    
    CRITICAL MULTILINGUAL REQUIREMENT:
    The 'translations' object MUST have THREE keys: 'en', 'fr', 'ar'.
    Each translation MUST contain: text, correctAnswer, explanation.
    
    The ROOT level fields should be in: "${language}".
    The explanation should be dramatic and declare the end of the game.
    
    Example structure:
    {
      "translations": {
        "en": { "text": "...", "correctAnswer": "...", "explanation": "..." },
        "fr": { "text": "...", "correctAnswer": "...", "explanation": "..." },
        "ar": { "text": "...", "correctAnswer": "...", "explanation": "..." }
      }
    }
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

export const validateAnswersBatch = async (
  apiKey: string,
  question: string,
  correctAnswer: string,
  submissions: { id: string, answer: string }[],
  language: Language
): Promise<Record<string, boolean>> => {
  if (submissions.length === 0) return {};

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
    Question: "${question}"
    Official Answer: "${correctAnswer}"
    Language: ${language}

    For each User Answer below, determine if it is essentially correct (TRUE) or incorrect (FALSE).
    Allow for typos, phonetic spelling, and synonyms.
    
    Submissions:
    ${JSON.stringify(submissions)}

    Respond with a JSON object mapping ID to BOOLEAN.
    Example: { "player-1": true, "player-2": false }
    RETURN ONLY JSON.
  `;

  try {
    const response = await fetchWithRetry(() => ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { responseMimeType: "application/json" }
    }));

    const text = response.text || "{}";
    return JSON.parse(cleanJson(text));
  } catch (e) {
    console.error("Batch validation error", e);
    // Fallback: mark all false or try individual? For now, fail safe to false.
    return submissions.reduce((acc, curr) => ({ ...acc, [curr.id]: false }), {});
  }
};