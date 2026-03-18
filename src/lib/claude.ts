import Anthropic from "@anthropic-ai/sdk";
import supabase from "./db";

export async function generateEmail(target: string, productName: string, link: string, tone: string) {
  if (!supabase) throw new Error("Supabase client not initialized.");

  const { data: settings } = await supabase
    .from('settings')
    .select('gemini_api_key, gemini_model')
    .eq('id', 1)
    .single();
  
  if (!settings?.gemini_api_key) throw new Error("Claude API Key not set in settings.");

  const anthropic = new Anthropic({
    apiKey: settings.gemini_api_key,
  });

  const modelName = settings.gemini_model || "claude-3-5-sonnet-20240620";

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

  const response = await anthropic.messages.create({
    model: modelName,
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  
  // Basic cleanup to extract JSON if needed
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Failed to parse Claude response as JSON.");
  
  return JSON.parse(jsonMatch[0]);
}

export async function generateAutoReply(contactName: string, originalEmail: string, userReply: string) {
  if (!supabase) throw new Error("Supabase client not initialized.");

  const { data: settings } = await supabase
    .from('settings')
    .select('gemini_api_key, gemini_model')
    .eq('id', 1)
    .single();
  
  if (!settings?.gemini_api_key) throw new Error("Claude API Key not set in settings.");

  const anthropic = new Anthropic({
    apiKey: settings.gemini_api_key,
  });

  const modelName = settings.gemini_model || "claude-3-5-sonnet-20240620";

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

  const response = await anthropic.messages.create({
    model: modelName,
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  return (response.content[0].type === 'text' ? response.content[0].text : '').trim();
}

export async function generateFollowUpEmail(contactName: string, originalSubject: string, productName: string, link: string) {
  if (!supabase) throw new Error("Supabase client not initialized.");

  const { data: settings } = await supabase
    .from('settings')
    .select('gemini_api_key, gemini_model')
    .eq('id', 1)
    .single();
  
  if (!settings?.gemini_api_key) throw new Error("Claude API Key not set.");

  const anthropic = new Anthropic({
    apiKey: settings.gemini_api_key,
  });

  const modelName = settings.gemini_model || "claude-3-5-sonnet-20240620";

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

  const response = await anthropic.messages.create({
    model: modelName,
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Failed to parse follow-up JSON.");
  return JSON.parse(jsonMatch[0]);
}
