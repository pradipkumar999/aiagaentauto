import { GoogleGenerativeAI } from "@google/generative-ai";
import db from "./db";

export async function generateEmail(target: string, productName: string, link: string, tone: string) {
  const settings = db.prepare('SELECT gemini_api_key, gemini_model FROM settings WHERE id = 1').get() as { 
    gemini_api_key: string,
    gemini_model: string 
  };
  
  if (!settings?.gemini_api_key) throw new Error("Gemini API Key not set in settings.");

  const genAI = new GoogleGenerativeAI(settings.gemini_api_key);
  const modelName = settings.gemini_model || "gemini-1.5-flash";
  const model = genAI.getGenerativeModel({ model: modelName });

  const prompt = `
    Write a short outreach email.
    Target: ${target}
    Product: ${productName}
    Affiliate link: ${link}
    Tone: ${tone}

    Goal: Recommend useful book.
    Keep email under 120 words.
    Add CTA to check the link.
    Return ONLY the JSON in the following format:
    {
      "subject": "...",
      "content": "..."
    }
  `;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = response.text();
  
  // Basic cleanup to extract JSON if needed
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Failed to parse Gemini response as JSON.");
  
  return JSON.parse(jsonMatch[0]);
}

export async function generateAutoReply(contactName: string, originalEmail: string, userReply: string) {
  const settings = db.prepare('SELECT gemini_api_key, gemini_model FROM settings WHERE id = 1').get() as { 
    gemini_api_key: string,
    gemini_model: string 
  };
  
  if (!settings?.gemini_api_key) throw new Error("Gemini API Key not set in settings.");

  const genAI = new GoogleGenerativeAI(settings.gemini_api_key);
  const modelName = settings.gemini_model || "gemini-1.5-flash";
  const model = genAI.getGenerativeModel({ model: modelName });

  const prompt = `
    You are an AI assistant for a business. A contact has replied to our outreach email.
    Write a helpful, professional, and friendly response to their message.
    
    Contact Name: ${contactName}
    Our Original Email: ${originalEmail}
    Contact's Reply: ${userReply}

    Goal: Answer their question or acknowledge their interest and encourage further engagement.
    Keep the response concise (under 100 words).
    Return ONLY the response text.
  `;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  return response.text().trim();
}

export async function generateFollowUpEmail(contactName: string, originalSubject: string, productName: string, link: string) {
  const settings = db.prepare('SELECT gemini_api_key, gemini_model FROM settings WHERE id = 1').get() as { 
    gemini_api_key: string,
    gemini_model: string 
  };
  
  if (!settings?.gemini_api_key) throw new Error("Gemini API Key not set.");

  const genAI = new GoogleGenerativeAI(settings.gemini_api_key);
  const modelName = settings.gemini_model || "gemini-1.5-flash";
  const model = genAI.getGenerativeModel({ model: modelName });

  const prompt = `
    Write a short follow-up email for a previous outreach.
    Lead Name: ${contactName}
    Product: ${productName}
    Affiliate Link: ${link}
    Original Subject: ${originalSubject}

    Goal: Remind them about the book/product we recommended. 
    Keep it very brief (under 80 words). 
    Ask if they had a chance to check the recommendation.
    Return ONLY the JSON in this format:
    {
      "subject": "Re: ${originalSubject}",
      "content": "..."
    }
  `;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = response.text();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Failed to parse follow-up JSON.");
  return JSON.parse(jsonMatch[0]);
}
