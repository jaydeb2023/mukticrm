import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { business, template, lang, customer, customNote } = await req.json();

  const bizName = business === 'muktifresh' ? 'MuktiFresh' : 'Mukti Cloud Kitchen';
  const bizEmoji = business === 'muktifresh' ? '🌿' : '🍳';

  const systemPrompt = `You are a WhatsApp message writer for ${bizName}, a business in Kolkata.
Write SHORT, warm, personal messages (max 5 lines) in ${lang}.
Use simple words. Sound like a friendly local shop owner.
For Bengali: use proper Bengali script. For Hindi: use Devanagari. For hinglish: mix Hindi words in English script.
End with a polite closing. Include 1-2 relevant emojis.
Do NOT use formal or corporate language. Keep it conversational.
Output ONLY the message, no preamble.`;

  const userPrompt = `Write a WhatsApp message for:
Customer: ${customer.name} (${customer.area || 'Kolkata'})
Message type: ${template}
Last purchase: ${customer.lastPurchase || 'unknown'}
Due amount: ${customer.dueAmount ? `₹${customer.dueAmount}` : 'none'}
Customer type: ${customer.type || 'regular'}
Extra context: ${customNote || 'none'}
Business: ${bizName} ${bizEmoji}
Language: ${lang}`;

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
        max_tokens: 300,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    const data = await res.json();
    const message = data.content?.[0]?.text || getFallback(lang, customer.name, bizName, template);

    return NextResponse.json({ message });
  } catch {
    return NextResponse.json({ message: getFallback(lang, customer.name, bizName, template) });
  }
}

function getFallback(lang: string, name: string, biz: string, type: string) {
  const first = name.split(' ')[0];
  if (lang === 'bengali') return `নমস্কার ${first} দা/দি! ${biz} থেকে বলছি। আপনার কথা মনে পড়লো। আজকে তাজা মাল পাওয়া যাচ্ছে। একটু জানাবেন? 🙏🌿`;
  if (lang === 'hindi') return `नमस्ते ${first} जी! ${biz} से बात कर रहे हैं। आज ताजा माल उपलब्ध है। ऑर्डर करना हो तो बताइए। 🙏🌿`;
  if (lang === 'hinglish') return `Hi ${first} bhai/didi! ${biz} se bol raha hun. Aaj fresh maal available hai. Order karna ho toh batao! 🙏🌿`;
  return `Hello ${first}! This is ${biz}. We have fresh products available today. Let us know if you'd like to order! 🙏🌿`;
}
