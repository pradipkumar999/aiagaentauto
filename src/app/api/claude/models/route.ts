import { NextResponse } from 'next/server';

const VPS_TAGS_URL = "http://62.171.155.215/api/tags";

export async function POST() {
  try {
    // Fetch available models from VPS Ollama instance
    const res = await fetch(VPS_TAGS_URL);
    
    if (!res.ok) {
      throw new Error(`VPS returned ${res.status}`);
    }

    const data = await res.json();
    // Ollama /api/tags returns { models: [{ name, modified_at, size }] }
    const models = (data.models || []).map((m: { name: string }) => ({
      name: m.name,
      displayName: m.name,
      description: 'VPS hosted model'
    }));

    // Fallback if no models returned
    if (models.length === 0) {
      models.push({ name: 'llama3', displayName: 'llama3', description: 'Default VPS model' });
    }

    return NextResponse.json(models);
  } catch (error) {
    console.error("VPS Model Fetch Error:", error);
    // Return a default fallback model on error
    return NextResponse.json([
      { name: 'llama3', displayName: 'llama3', description: 'Default VPS model' }
    ]);
  }
}
