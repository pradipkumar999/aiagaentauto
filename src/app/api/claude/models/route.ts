import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { apiKey } = await req.json();
    if (!apiKey) return NextResponse.json({ error: 'API Key is required' }, { status: 400 });

    // Since Anthropic doesn't have a simple public model list endpoint like Gemini, 
    // we return the most popular models for selection.
    const models = [
      { name: 'claude-3-5-sonnet-20240620', displayName: 'Claude 3.5 Sonnet', description: 'Most intelligent model' },
      { name: 'claude-3-opus-20240229', displayName: 'Claude 3 Opus', description: 'Powerful for complex tasks' },
      { name: 'claude-3-haiku-20240307', displayName: 'Claude 3 Haiku', description: 'Fastest and most compact model' },
      { name: 'claude-2.1', displayName: 'Claude 2.1', description: 'Updated Claude 2 model' }
    ];

    return NextResponse.json(models);
  } catch (error) {
    console.error("Claude API Error:", error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
