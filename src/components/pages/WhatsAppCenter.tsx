'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { showToast } from '../Toast';

interface Props { business: 'muktifresh' | 'cloud_kitchen'; }

type Lang = 'english' | 'bengali' | 'hindi' | 'hinglish';

const TEMPLATES = {
  muktifresh: [
    { label: 'Re-engagement (not ordered)', type: 'reengagement' },
    { label: 'New product available', type: 'product_launch' },
    { label: 'Due payment reminder', type: 'payment_reminder' },
    { label: 'Complaint follow-up', type: 'complaint_followup' },
    { label: 'Special offer / discount', type: 'offer' },
  ],
  cloud_kitchen: [
    { label: 'Try our new dish', type: 'new_dish' },
    { label: 'Re-order reminder', type: 'reorder' },
    { label: 'Complaint resolved', type: 'complaint_resolved' },
    { label: 'Delivery feedback request', type: 'feedback' },
    { label: 'Festive offer', type: 'festive_offer' },
  ],
};

export default function WhatsAppCenter({ business }: Props) {
  const { user } = useAuth();
  const [customers, setCustomers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<any | null>(null);
  const [template, setTemplate] = useState('');
  const [lang, setLang] = useState<Lang>('bengali');
  const [customNote, setCustomNote] = useState('');
  const [generating, setGenerating] = useState(false);
  const [draft, setDraft] = useState('');
  const [history, setHistory] = useState<any[]>([]);

  const accent = business === 'muktifresh' ? 'var(--fresh-500)' : 'var(--kitchen-500)';
  const templates = TEMPLATES[business];

  useEffect(() => {
    loadCustomers();
    loadHistory();
  }, [business]);

  async function loadCustomers() {
    const { data } = await supabase
      .from('customers')
      .select('id, name, phone, whatsapp, area, due_amount, last_purchase, customer_type')
      .or(`business.eq.${business},business.eq.both`)
      .order('name');
    setCustomers(data || []);
  }

  async function loadHistory() {
    const { data } = await supabase
      .from('whatsapp_drafts')
      .select('*')
      .eq('business', business)
      .order('created_at', { ascending: false })
      .limit(20);
    setHistory(data || []);
  }

  const filtered = customers.filter(c =>
    !search || c.name?.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search)
  );

  async function generateAI() {
    if (!selected || !template) { showToast('Select customer and template', 'error'); return; }
    setGenerating(true);
    setDraft('');

    try {
      const res = await fetch('/api/ai/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business,
          template,
          lang,
          customer: {
            name: selected.name,
            area: selected.area,
            lastPurchase: selected.last_purchase,
            dueAmount: selected.due_amount,
            type: selected.customer_type,
          },
          customNote,
        }),
      });
      const { message } = await res.json();
      setDraft(message);
    } catch {
      // Fallback draft
      setDraft(getOfflineDraft(template, lang, selected));
    }
    setGenerating(false);
  }

  function getOfflineDraft(type: string, l: Lang, c: any): string {
    const name = c.name.split(' ')[0];
    if (l === 'bengali') {
      if (type === 'reengagement') return `নমস্কার ${name} দা/দি! 🌿\n\nMuktiFresh থেকে বলছি। অনেকদিন আপনার অর্ডার পাইনি। আজকে তাজা সব্জি, মাছ, ও মাংস পাওয়া যাচ্ছে।\n\nঅর্ডার করতে এখনই যোগাযোগ করুন! 🙏`;
      if (type === 'payment_reminder') return `নমস্কার ${name} দা/দি!\n\nআপনার MuktiFresh-এ ₹${c.due_amount || '...'} বাকি আছে। সুবিধামতো পরিশোধ করলে ভালো হয়।\n\nধন্যবাদ 🙏`;
      return `নমস্কার ${name} দা/দি! MuktiFresh থেকে আপনার জন্য একটি বিশেষ বার্তা। 🌿`;
    }
    if (l === 'hindi') {
      if (type === 'reengagement') return `नमस्ते ${name} जी! 🌿\n\nMuktiFresh से बात कर रहे हैं। काफी दिनों से आपका ऑर्डर नहीं मिला। आज ताजा सब्जी, मछली और मांस उपलब्ध है।\n\nअभी ऑर्डर करें! 🙏`;
      return `नमस्ते ${name} जी! MuktiFresh की तरफ से आपके लिए एक खास संदेश। 🌿`;
    }
    if (l === 'hinglish') {
      if (type === 'reengagement') return `Hi ${name} bhai/didi! 🌿\n\nMuktiFresh se bol raha hun. Kaafi din se aapka order nahi aaya. Aaj fresh sabzi, machhi aur gosht available hai.\n\nOrder karo abhi! 🙏`;
      return `Hi ${name}! MuktiFresh se ek special message aapke liye. 🌿`;
    }
    // English
    if (type === 'reengagement') return `Hello ${name}! 🌿\n\nThis is MuktiFresh. We haven't received your order in a while. We have fresh vegetables, fish and meat available today.\n\nPlace your order now! 🙏`;
    if (type === 'payment_reminder') return `Hello ${name}!\n\nYou have a pending balance of ₹${c.due_amount || '...'} at MuktiFresh. Please clear it at your convenience.\n\nThank you 🙏`;
    return `Hello ${name}! A special message from MuktiFresh for you. 🌿`;
  }

  function openWhatsApp() {
    if (!selected?.phone && !selected?.whatsapp) { showToast('No phone number', 'error'); return; }
    const phone = (selected.whatsapp || selected.phone).replace(/\D/g, '');
    const fullPhone = phone.startsWith('91') ? phone : `91${phone}`;
    const url = `https://wa.me/${fullPhone}?text=${encodeURIComponent(draft)}`;
    window.open(url, '_blank');

    // Save to log
    supabase.from('whatsapp_drafts').insert({
      customer_id: selected.id,
      business,
      phone: fullPhone,
      message: draft,
      message_type: template || 'manual',
      language: lang,
      sent_by: user?.id,
      is_sent: true,
      sent_at: new Date().toISOString(),
    }).then(() => loadHistory());
  }

  const langOptions: { v: Lang; l: string }[] = [
    { v: 'bengali', l: 'বাংলা' },
    { v: 'hindi', l: 'हिंदी' },
    { v: 'hinglish', l: 'Hinglish' },
    { v: 'english', l: 'English' },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20 }}>

      {/* Customer list */}
      <div>
        <div style={{ marginBottom: 10 }}>
          <input className="inp" placeholder="Search customer…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div style={{ background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 'var(--r2)', overflow: 'hidden', maxHeight: 'calc(100vh - 240px)', overflowY: 'auto' }}>
          {filtered.slice(0, 100).map(c => (
            <div
              key={c.id}
              onClick={() => { setSelected(c); setDraft(''); }}
              style={{
                padding: '10px 14px', cursor: 'pointer',
                borderBottom: '1px solid var(--border)',
                background: selected?.id === c.id ? `${accent}15` : 'none',
                borderLeft: selected?.id === c.id ? `3px solid ${accent}` : '3px solid transparent',
                transition: 'all 0.1s',
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 13 }}>{c.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{c.phone}</div>
              {c.due_amount > 0 && (
                <div style={{ fontSize: 10, color: 'var(--amber)', marginTop: 2 }}>Due: ₹{c.due_amount}</div>
              )}
              {c.last_purchase && (
                <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 1 }}>
                  Last: {new Date(c.last_purchase).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </div>
              )}
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ padding: 20, color: 'var(--text3)', textAlign: 'center', fontSize: 12 }}>No customers found</div>
          )}
        </div>
      </div>

      {/* Draft panel */}
      <div>
        {!selected ? (
          <div className="card" style={{ padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>💬</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text2)', marginBottom: 4 }}>Select a customer</div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>Choose from the list to draft a WhatsApp message</div>
          </div>
        ) : (
          <div>
            {/* Customer info */}
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{selected.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
                    {selected.phone} · {selected.area}
                  </div>
                </div>
                <div style={{ textAlign: 'right', fontSize: 11, color: 'var(--text3)' }}>
                  {selected.due_amount > 0 && <div style={{ color: 'var(--red)' }}>Due ₹{selected.due_amount}</div>}
                  {selected.last_purchase && <div>Last order: {new Date(selected.last_purchase).toLocaleDateString('en-IN')}</div>}
                </div>
              </div>
            </div>

            <div className="card">
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 700 }}>
                ✨ AI Message Draft
              </div>
              <div style={{ padding: 18 }}>
                {/* Template + Language */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>Message type</div>
                    <select className="inp" value={template} onChange={e => setTemplate(e.target.value)}>
                      <option value="">Select type…</option>
                      {templates.map(t => <option key={t.type} value={t.type}>{t.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>Language</div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {langOptions.map(l => (
                        <button key={l.v} onClick={() => setLang(l.v)} style={{
                          flex: 1, padding: '7px 4px', borderRadius: 6,
                          border: `1px solid ${lang === l.v ? accent : 'var(--border)'}`,
                          background: lang === l.v ? `${accent}18` : 'var(--bg2)',
                          color: lang === l.v ? accent : 'var(--text2)',
                          cursor: 'pointer', fontFamily: 'var(--font)', fontSize: 11, fontWeight: 600,
                        }}>{l.l}</button>
                      ))}
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>Additional context (optional)</div>
                  <textarea className="inp" rows={2} placeholder="e.g. Hilsa fish available at ₹600/kg, special discount for regular customers…" value={customNote} onChange={e => setCustomNote(e.target.value)} />
                </div>

                <button
                  className="btn"
                  style={{ background: accent, color: '#fff', marginBottom: 16, width: '100%', justifyContent: 'center' }}
                  onClick={generateAI}
                  disabled={generating}
                >
                  {generating ? '⏳ Generating…' : '✨ Generate AI Message'}
                </button>

                {/* Draft output */}
                {draft && (
                  <div>
                    <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 6 }}>
                      Draft — edit before sending
                    </div>
                    <textarea
                      value={draft}
                      onChange={e => setDraft(e.target.value)}
                      style={{
                        width: '100%', background: 'var(--bg2)', border: '1px solid var(--border)',
                        borderRadius: 'var(--r)', padding: '12px 14px', color: 'var(--text)',
                        fontFamily: 'var(--font)', fontSize: 13, minHeight: 120, resize: 'vertical', outline: 'none',
                        lineHeight: 1.6,
                      }}
                    />
                    <button
                      className="wa-btn"
                      style={{ marginTop: 12, padding: '10px 20px', fontSize: 13, fontWeight: 700, width: '100%', justifyContent: 'center' }}
                      onClick={openWhatsApp}
                    >
                      📱 Open in WhatsApp → Send Manually
                    </button>
                    <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center', marginTop: 6 }}>
                      Opens WhatsApp with message pre-filled — you tap send
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Sent history */}
        {history.length > 0 && (
          <div className="card" style={{ marginTop: 16 }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 700 }}>Recent Messages</div>
            <div style={{ maxHeight: 200, overflowY: 'auto' }}>
              {history.map(h => (
                <div key={h.id} style={{ padding: '10px 18px', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontFamily: 'var(--mono)', color: 'var(--text3)' }}>{h.phone}</span>
                    <span style={{ fontSize: 10, color: 'var(--text3)' }}>{new Date(h.created_at).toLocaleDateString('en-IN')}</span>
                  </div>
                  <div style={{ color: 'var(--text2)', fontSize: 12, lineHeight: 1.4, overflow: 'hidden', maxHeight: 40, textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {h.message}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
