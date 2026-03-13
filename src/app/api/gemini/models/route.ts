import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { apiKey } = await req.json();
    if (!apiKey) return NextResponse.json({ error: 'API Key is required' }, { status: 400 });

    // Using the REST API directly to ensure we get ALL models
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Failed to fetch models from Google API');
    }

    interface GeminiModel {
      name: string;
      displayName: string;
      description: string;
      supportedGenerationMethods: string[];
    }

    const data = await response.json();
    
    // Filter models that support generating content
    const filteredModels = (data.models as GeminiModel[])
      .filter((m: GeminiModel) => m.supportedGenerationMethods.includes('generateContent'))
      .map((m: GeminiModel) => ({
        name: m.name.replace('models/', ''),
        displayName: m.displayName,
        description: m.description
      }));

    return NextResponse.json(filteredModels);
  } catch (error) {
    console.error("Gemini API Error:", error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
