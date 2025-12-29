import { GoogleGenAI, Type } from "@google/genai";
import { Question, Language } from "../types";

// Helper to sanitize JSON string if Markdown code blocks are included
const cleanJson = (text: string) => {
  return text.replace(/```json/g, '').replace(/```/g, '').trim();
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
      },
      required: ['id', 'text', 'type', 'correctAnswer', 'explanation'],
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
    Target Language: ${language} (ISO 639-1).
    Question Type Constraint: ${typeInstruction}
    
    Rules:
    1. The question text MUST be in ${language}.
    2. The options (for mc) MUST be in ${language}.
    3. The correct answer MUST be in ${language}.
    4. The hint MUST be in ${language}.
    5. The explanation MUST be in ${language} and funny.
    
    For 'mc' (multiple choice) questions, provide 4 options in the 'options' array.
    For 'open' questions, leave 'options' empty.
    Provide a witty, sarcastic, or helpful 'hint' that doesn't give the answer away.
    For 'explanation', provide a SHORT, HUMOROUS comment by the host revealing the answer. Make it sound like a game show host speaking in ${language}.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-exp',
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      },
    });

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
    },
    required: ['id', 'text', 'type', 'correctAnswer', 'explanation'],
  };

  const prompt = `
    Generate 1 FINAL BOSS question about "${theme}".
    Difficulty: ${difficulty} (Make it harder than usual).
    Language: ${language}.
    Type: Open Ended.
    
    Ensure the 'text', 'correctAnswer', and 'explanation' are strictly in ${language}.
    The explanation should be dramatic and declare the end of the game in ${language}.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-exp', // Updated to latest reliable experimental or use 'gemini-1.5-flash'
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      },
    });

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
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    const text = response.text?.trim().toUpperCase();
    return text?.includes("TRUE") || false;
  } catch (e) {
    console.error("Validation error", e);
    return false; // Default to strict if AI fails
  }
};