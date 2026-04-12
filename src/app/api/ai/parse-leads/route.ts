import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { text, business } = await req.json();

  const system = `You are a data extraction assistant. Extract customer/lead information from any text format.
Return ONLY a valid JSON array. No explanation, no markdown, no code blocks.
Each object must have these fields (use empty string if not found):
{ "name": "", "phone": "", "email": "", "company": "", "address": "", "city": "", "area": "", "flat_no": "", "pin_code": "", "notes": "" }
Rules:
- Phone: extract Indian mobile numbers (10 digits starting 6-9, with or without +91/91 prefix). Store as 10 digits only.
- Name: proper name only, not labels like "Name:" 
- If text is in Bengali/Hindi, still extract and store values
- Skip rows with no name AND no phone`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4000,
        system,
        messages: [{ role: 'user', content: `Extract leads from this text:\n\n${text}` }],
      }),
    });

    const data = await res.json();
    const raw = data.content?.[0]?.text || '[]';
    const clean = raw.replace(/```json|```/g, '').trim();
    const leads = JSON.parse(clean);
    return NextResponse.json({ leads: Array.isArray(leads) ? leads : [] });
  } catch {
    // Fallback: regex-based extraction
    const lines = text.split('\n').filter((l: string) => l.trim());
    const leads = lines.map((line: string) => {
      const phoneMatch = line.match(/(?:\+?91\s?)?([6-9]\d{9})/);
      const phone = phoneMatch?.[1] || '';
      const cleaned = line.replace(/(?:\+?91\s?)?[6-9]\d{9}/g, '').replace(/[|,\-:]/g, ' ').trim();
      const words = cleaned.split(/\s+/).filter(w => w.length > 1);
      const name = words.slice(0, 3).join(' ') || 'Unknown';
      return { name, phone, email: '', company: '', address: '', city: '', area: '', flat_no: '', pin_code: '', notes: '' };
    }).filter((l: any) => l.phone || (l.name && l.name !== 'Unknown'));

    return NextResponse.json({ leads });
  }
}
