import { NextRequest, NextResponse } from 'next/server';
import { AXIOM_FLEET, runAgent } from '@/lib/mastra/agents';

export async function POST(req: NextRequest) {
  try {
    const { agentKey, prompt } = await req.json();
    if (!agentKey || !prompt) {
      return NextResponse.json({ error: 'agentKey and prompt required' }, { status: 400 });
    }
    const fleet = AXIOM_FLEET as Record<string, { name: string; id: string; model: string }>;
    const agentConfig = fleet[agentKey];
    if (!agentConfig) {
      return NextResponse.json({ error: `Unknown agent: ${agentKey}` }, { status: 400 });
    }
    const result = await runAgent(agentConfig.name, agentConfig.id, prompt);
    return NextResponse.json({ success: true, result, agent: agentConfig.name });
  } catch (error) {
    console.error('Agent run error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}