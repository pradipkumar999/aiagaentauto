import supabase from "./db";

const VPS_API_URL = "http://62.171.155.215/api/generate";

async function callVPS(model: string, prompt: string): Promise<string> {
  const response = await fetch(VPS_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`VPS API error ${response.status}: ${text}`);
  }

  const data = await response.json();
  // Ollama /api/generate returns { response: "..." }
  return (data.response as string) || "";
}

async function getVPSSettings() {
  if (!supabase) throw new Error("Supabase client not initialized.");

  const { data: settings } = await supabase
    .from("settings")
    .select("gemini_model")
    .eq("id", 1)
    .single();

  // If DB has old Claude model name, override with phi3:mini
  const storedModel = settings?.gemini_model || "";
  const model = (!storedModel || storedModel.startsWith("claude-")) ? "phi3:mini" : storedModel;
  return { model };
}

export async function generateEmail(
  target: string,
  productName: string,
  link: string,
  tone: string
) {
  const { model } = await getVPSSettings();

  const prompt = `
    Write a short outreach email.
    Target: ${target}
    Product: ${productName}
    Affiliate link: ${link}
    Tone: ${tone}

    Goal: Recommend useful book.
    Keep email under 120 words.
    Add CTA to check the link.
    Return ONLY the JSON in the following format with no extra text:
    {
      "subject": "...",
      "content": "..."
    }
  `;

  const text = await callVPS(model, prompt);
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Failed to parse VPS response as JSON.");
  return JSON.parse(jsonMatch[0]);
}

export async function generateAutoReply(
  contactName: string,
  originalEmail: string,
  userReply: string
) {
  const { model } = await getVPSSettings();

  const prompt = `
    You are an AI assistant for a business. A contact has replied to our outreach email.
    Write a helpful, professional, and friendly response to their message.
    
    Contact Name: ${contactName}
    Our Original Email: ${originalEmail}
    Contact's Reply: ${userReply}

    Goal: Answer their question or acknowledge their interest and encourage further engagement.
    Keep the response concise (under 100 words).
    Return ONLY the response text with no extra commentary.
  `;

  const text = await callVPS(model, prompt);
  return text.trim();
}

export async function generateFollowUpEmail(
  contactName: string,
  originalSubject: string,
  productName: string,
  link: string
) {
  const { model } = await getVPSSettings();

  const prompt = `
    Write a short follow-up email for a previous outreach.
    Lead Name: ${contactName}
    Product: ${productName}
    Affiliate Link: ${link}
    Original Subject: ${originalSubject}

    Goal: Remind them about the book/product we recommended. 
    Keep it very brief (under 80 words). 
    Ask if they had a chance to check the recommendation.
    Return ONLY the JSON in this format with no extra text:
    {
      "subject": "Re: ${originalSubject}",
      "content": "..."
    }
  `;

  const text = await callVPS(model, prompt);
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Failed to parse follow-up JSON.");
  return JSON.parse(jsonMatch[0]);
}
