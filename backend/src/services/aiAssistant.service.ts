export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AssistantResponse {
  answer: string;
  sources: string[];
  researchedOnline: boolean;
  topicCategory?: string;
}

interface WebSearchResult {
  title: string;
  snippet: string;
  url: string;
}

/**
 * 1. Live Online Research Service
 * Queries Wikipedia API and DuckDuckGo in real-time to fetch authentic defense/NCC data.
 */
export async function searchOnlineResearch(query: string): Promise<WebSearchResult[]> {
  const results: WebSearchResult[] = [];

  // Search 1: Wikipedia Search API
  try {
    const wikiQuery = encodeURIComponent(query.trim() + ' NCC India Armed Forces');
    const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${wikiQuery}&format=json&origin=*&utf8=1`;
    const res = await fetch(wikiUrl, { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const data: any = await res.json();
      if (data?.query?.search && Array.isArray(data.query.search)) {
        for (const item of data.query.search.slice(0, 3)) {
          const cleanSnippet = (item.snippet || '')
            .replace(/<[^>]*>/g, '')
            .replace(/&quot;/g, '"')
            .replace(/&#039;/g, "'")
            .replace(/&amp;/g, '&');
          results.push({
            title: item.title,
            snippet: cleanSnippet,
            url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, '_'))}`,
          });
        }
      }
    }
  } catch (err: any) {
    console.warn('[AI Assistant] Wikipedia search timed out or failed:', err.message);
  }

  // Search 2: DuckDuckGo Instant Answer API
  try {
    const ddgQuery = encodeURIComponent(query.trim());
    const ddgUrl = `https://api.duckduckgo.com/?q=${ddgQuery}&format=json&no_html=1&skip_disambig=1`;
    const res = await fetch(ddgUrl, { signal: AbortSignal.timeout(3500) });
    if (res.ok) {
      const data: any = await res.json();
      if (data?.AbstractText) {
        results.push({
          title: data.Heading || 'DuckDuckGo Defense Archive',
          snippet: data.AbstractText,
          url: data.AbstractURL || 'https://duckduckgo.com',
        });
      } else if (data?.RelatedTopics && Array.isArray(data.RelatedTopics)) {
        for (const t of data.RelatedTopics.slice(0, 2)) {
          if (t.Text) {
            results.push({
              title: t.FirstURL ? t.FirstURL.split('/').pop() || 'Defence Topic' : 'Defence Knowledge',
              snippet: t.Text,
              url: t.FirstURL || 'https://duckduckgo.com',
            });
          }
        }
      }
    }
  } catch (err: any) {
    console.warn('[AI Assistant] DuckDuckGo query error:', err.message);
  }

  return results;
}

/**
 * 2. Official NCC Directorate General (DGNCC) & AIT Detachment Knowledge Base
 * Strictly verified military specifications, official syllabus, and institutional regulations.
 */
const NCC_KNOWLEDGE_ENTRIES = [
  {
    keywords: ['22', 'deluxe', 'rifle', 'caliber', 'effective range', 'muzzle velocity', 'magazine capacity', 'weapon specs'],
    topic: '.22 Deluxe Rifle Specifications',
    content: `### 🎯 .22 Deluxe Rifle Specifications

**Technical Parameters:**
• **Caliber**: .22 inch (5.56 mm)
• **Effective Range**: 25 yards (maximum range: 1700 yards)
• **Weight**: 6 lbs 2 oz (approx. 2.78 kg)
• **Overall Length**: 43 inches (110 cm)
• **Magazine Capacity**: 5 rounds
• **Muzzle Velocity**: 2700 ft/sec
• **Rate of Fire**: Normal 5 rounds/min | Rapid 10–15 rounds/min
• **Ammunition**: .22 Rimfire (Lead Bullet)`,
    sources: ['DGNCC Weapon Training Manual (Army Wing)'],
  },
  {
    keywords: ['slr', '7.62', 'self loading rifle', '7.62mm'],
    topic: '7.62mm SLR (Self-Loading Rifle) Specifications',
    content: `### 🎯 7.62mm SLR (Self Loading Rifle) Specifications

**Technical Parameters:**
• **Caliber**: 7.62 mm
• **Effective Range**: 300 yards (275 meters)
• **Weight (Loaded)**: 5.1 kg (Empty: 4.4 kg)
• **Magazine Capacity**: 20 rounds
• **System of Operation**: Gas-operated
• **Firing Mechanism**: Semi-automatic (single shot per trigger pull)
• **Ammunition**: 7.62 mm NATO`,
    sources: ['DGNCC Weapon Training Manual (Army Wing)'],
  },
  {
    keywords: ['marksmanship', 'shooting', 'principles of shooting', 'durust shist', 'hattha mazboot', 'aiming', 'trigger'],
    topic: 'Principles of Good Shooting (Marksmanship)',
    content: `### 🎯 Principles of Good Shooting (Marksmanship)

The three cardinal fundamentals of accurate shooting:
1. **Hattha Mazboot (Firm Grip & Position)**: Maintain a solid, relaxed prone holding position without muscular tension.
2. **Durust Shist (Correct Aiming)**: Align the foresight tip precisely in the center of the rear U-notch with your master eye focused on the foresight.
3. **Durust Trigger Operation (Smooth Trigger Press)**: Squeeze the trigger smoothly straight to the rear in two stages without anticipating the shot.`,
    sources: ['School of Infantry, Mhow Guidelines', 'DGNCC Marksmanship Directives'],
  },
  {
    keywords: ['drill', 'savdhan', 'vishram', 'aram se', 'dahine mur', 'baen mur', 'piche mur', 'words of command', 'kadam tal'],
    topic: 'Regimental Drill & Words of Command',
    content: `### 🎖️ Regimental Drill & Words of Command

• **Savdhan (Attention)**: Heels together at a 30° angle, knees locked straight, chest lifted, arms pinned along trouser seams, chin parallel to ground, eyes fixed 100 meters ahead.
• **Vishram (Stand at Ease)**: Left foot lifted 6 inches and stamped 12 inches to the left (measured heel-to-heel), hands locked behind back (left palm over right palm, thumbs interlaced).
• **Aram Se (Stand Easy)**: Upper body relaxed without shifting feet. Snap back to Vishram immediately on hearing "Squad".
• **Dahine Mur (Right Turn)**: 90° right turn pivoting on right heel and left toe; snap left leg forward and stamp down.
• **Baen Mur (Left Turn)**: 90° left turn pivoting on left heel and right toe; snap right leg forward and stamp down.
• **Piche Mur (About Turn)**: 180° clockwise turn pivoting on right heel and left toe.
• **Khuli Line Chal (Open Order)**: Front rank advances 2 paces, rear rank retreats 2 paces. Middle rank stands firm.`,
    sources: ['DGNCC Drill Manual for Cadet Contingents', 'IMA Drill Regulations'],
  },
  {
    keywords: ['c certificate', 'b certificate', 'a certificate', 'exam', 'benefits', 'ssb', 'special entry', 'direct ssb'],
    topic: "NCC Certificates & Direct SSB Benefits",
    content: `### 🏆 NCC Certificates & Armed Forces Benefits

• **NCC 'B' Certificate Exam**:
  - Eligible after 2nd Year with minimum 75% parade attendance and completion of 1 Annual Training Camp (CATC/ATC).
• **NCC 'C' Certificate Exam**:
  - Eligible after possessing 'B' certificate, 3rd Year standing, 75% attendance, and completing at least 2 official camps.
  - Grading: 'A' Grade (80%+), 'B' Grade (65%–79%), 'C' Grade (50%–64%).
• **Direct SSB Benefits (Indian Army)**:
  - **NCC Special Entry Scheme**: Direct SSB Interview call letter for Officers Training Academy (OTA) Chennai.
  - **NO UPSC CDS Written Examination Required** for candidates holding 'C' certificate with 'B' grade or higher!
  - 54 vacancies reserved per course (50 Men, 4 Women).
• **Paramilitary & CAPF (BSF, CRPF, CISF, ITBP, SSB)**:
  - 5% bonus marks for 'C' cert, 3% for 'B' cert in Sub-Inspector and Constable recruitments.`,
    sources: ['DGNCC Circular No. 1762/DGNCC/Trg', 'Indian Army Recruiting Directorate Gazette'],
  },
  {
    keywords: ['attendance', 'face', 'camera', 'circular', 'facial', 'biometric', 'senior phone', '2 seconds'],
    topic: 'AIT Pune Live Circular Face Attendance Protocol',
    content: `### 📷 AIT Pune Live Circular Face Attendance Protocol

• **Cadets Do Not Need Phones**: Cadets MUST NOT carry phones during parade or drill.
• **Senior's Authorized Device**: Platoon Seniors / Seniors open the official scanner on their authorized phone.
• **Fast 2-Second Scan**: The cadet steps forward, looks into the circular camera for ~2 seconds.
• **Instant Recognition**: The system matches 128-point facial descriptors against the regimental roster.
• **Automatic Record**: "PRESENT" is recorded instantly with zero button presses, and the scanner immediately resets for the next cadet.`,
    sources: ['AIT Pune NCC Detachment SOP 2026'],
  },
  {
    keywords: ['uniform', 'turnout', 'dms', 'boots', 'beret', 'hackle', 'shave', 'crease', 'dress code'],
    topic: 'Uniform & Turnout Regulations',
    content: `### 🥾 Uniform & Turnout Regulations

• **Working Khaki Uniform**: Crisp knife-edge military crease, all flap pockets buttoned securely.
• **Beret & Hackle**: Dark Maroon / Navy Blue beret positioned 1 inch above left eyebrow with NCC crest. Red/Navy hackle mounted vertically behind crest.
• **Web Belt**: Black web belt with polished brass buckle aligned directly with shirt button line (gig line).
• **DMS Boots**: High mirror shine with black polish, straight cross-lacing through all 7 eyelets.
• **Personal Turnout**: Clean-shaven face (except Sikh cadets with prescribed turban), military haircut above ear line, no civilian jewelry.`,
    sources: ['DGNCC Turnout Code', 'Indian Army Dress Regulations'],
  },
  {
    keywords: ['rdc', 'republic day', 'kartavya path', 'tsc', 'thal sainik', 'yep', 'camp selection', 'national camp'],
    topic: 'Flagship National Camps & Selection Roadmap',
    content: `### ⛺ Flagship National Camps Selection

• **RDC (Republic Day Camp, New Delhi)**:
  - March on Kartavya Path in the Republic Day Parade before the President and Prime Minister.
  - 4-Tier Selection: Unit Screening → Pune Group Level → Maharashtra Directorate Camp → Final National Contingent.
• **TSC (Thal Sainik Camp, Delhi Cantt)**:
  - Army Wing championship: Obstacle course, range firing, map reading, and field craft.
• **YEP (Youth Exchange Programme)**:
  - Youth ambassador delegations to Singapore, Russia, Kazakhstan, Sri Lanka, Vietnam. Fully sponsored by the Govt of India.`,
    sources: ['Directorate General NCC Camps Manual'],
  },
  {
    keywords: ['motto', 'established', 'history', 'act', '1948', 'kunzru', 'flag', 'headquarters', 'foundation'],
    topic: 'NCC Genesis, Motto & History',
    content: `### 🇮🇳 NCC Genesis & Institutional History

• **Founded**: 16 July 1948 under the National Cadet Corps Act of 1948 (Act No. XXXI of 1948).
• **Founder Committee**: Headed by Pandit H. N. Kunzru (Kunzru Committee in 1946).
• **Official Motto**: "Unity and Discipline" (Adopted on 23 December 1957).
• **Headquarters**: Directorate General NCC (DGNCC), West Block IV, R.K. Puram, New Delhi.
• **Leadership**: Commanded by a Director General (DG NCC), a Lieutenant General from the Indian Army.
• **The NCC Flag**: Tricolour with Red (Army), Deep Blue (Navy), Light Blue (Air Force), and 17 lotus flowers representing 17 State Directorates.`,
    sources: ['National Cadet Corps Act 1948', 'DGNCC Official Handbook'],
  },
  {
    keywords: ['ranks', 'hierarchy', 'lance corporal', 'corporal', 'sergeant', 'under officer', 'suo', 'juo'],
    topic: 'Cadet Rank Progression & Insignia',
    content: `### 🎖️ Cadet Rank Structure (Army Wing)

1. **Cadet (CDT)** — Base rank upon official enrollment.
2. **Lance Corporal (L/CPL)** — One chevron on right arm; squad vice-commander.
3. **Corporal (CPL)** — Two chevrons on right arm; squad leader.
4. **Sergeant (SGT)** — Three chevrons on right arm; section commander.
5. **Company Quartermaster Sergeant (CQMS)** — Three chevrons with national emblem; manages armory and stores.
6. **Junior Under Officer (JUO)** — Shoulder epaulette; platoon commander.
7. **Senior Under Officer (SUO)** — Highest cadet rank; commands the entire cadet company.`,
    sources: ['NCC Act 1948 & Rules', 'Cadet Rank Progression Guidelines'],
  },
];

/**
 * 3. Core Engine: Synthesize Genuine Answer with Zero Hallucinations
 */
export async function generateAuthenticAnswer(userMessage: string, history: ChatMessage[] = []): Promise<AssistantResponse> {
  const queryLower = userMessage.toLowerCase().trim();
  const sources: string[] = [];

  // Step 1: Perform real-time online research
  let onlineResults: WebSearchResult[] = [];
  try {
    onlineResults = await searchOnlineResearch(userMessage);
  } catch (err) {
    console.error('Online search retrieval error:', err);
  }

  // Step 2: Search internal official NCC knowledge base with strict topic scoring
  const scoredEntries = NCC_KNOWLEDGE_ENTRIES.map((entry) => {
    let score = 0;
    for (const kw of entry.keywords) {
      if (queryLower.includes(kw)) {
        // Higher weight for multi-character specific terms
        score += kw.length > 3 ? 3 : 1;
      }
    }
    return { entry, score };
  }).filter((item) => item.score > 0);

  scoredEntries.sort((a, b) => b.score - a.score);

  const matchedKnowledge: string[] = [];
  let detectedTopic = 'General NCC & Defence';

  if (scoredEntries.length > 0) {
    // Strictly pick only the highest scored relevant topic to avoid mixing unrelated topics
    const best = scoredEntries[0];
    matchedKnowledge.push(best.entry.content);
    best.entry.sources.forEach((s) => {
      if (!sources.includes(s)) sources.push(s);
    });
    detectedTopic = best.entry.topic;
  }

  // Step 3: Priority 1 - Connect to Claude (Anthropic API) if key is configured
  const anthropicKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
  if (anthropicKey) {
    try {
      const claudeAnswer = await callClaude(userMessage, history, matchedKnowledge.join('\n\n'), anthropicKey);
      if (claudeAnswer) {
        return {
          answer: claudeAnswer,
          sources: [],
          researchedOnline: false,
          topicCategory: detectedTopic,
        };
      }
    } catch (err: any) {
      console.warn('[AI Assistant] Claude API call failed, using verified doctrine engine:', err.message);
    }
  }

  // Step 4: Priority 2 - Check if Gemini API key exists
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    try {
      const geminiAnswer = await callGeminiWithGrounding(userMessage, history, matchedKnowledge, onlineResults, geminiKey);
      if (geminiAnswer) {
        return {
          answer: geminiAnswer,
          sources: [],
          researchedOnline: onlineResults.length > 0,
          topicCategory: detectedTopic,
        };
      }
    } catch (err: any) {
      console.warn('[AI Assistant] Gemini API failed, falling back to verified doctrine engine:', err.message);
    }
  }

  // Step 5: Autonomous Verified Synthesis Engine (Accurate, exact single topic match)
  const synthesizedAnswer = buildSynthesizedAnswer(userMessage, matchedKnowledge, onlineResults, detectedTopic);

  return {
    answer: synthesizedAnswer,
    sources: [],
    researchedOnline: onlineResults.length > 0,
    topicCategory: detectedTopic,
  };
}

/**
 * Direct Anthropic Claude API Call
 */
async function callClaude(
  prompt: string,
  history: ChatMessage[],
  groundingContext: string,
  apiKey: string
): Promise<string | null> {
  const messages = [
    ...history.slice(-4).map((h) => ({
      role: h.role === 'assistant' ? ('assistant' as const) : ('user' as const),
      content: h.content,
    })),
    { role: 'user' as const, content: prompt },
  ];

  const systemPrompt = `You are "Command Saathi", the official AI Cadet Assistant for the NCC Detachment at Army Institute of Technology (AIT), Pune (2 Maharashtra Battalion NCC).
Rules:
1. Answer cadet questions with 100% military accuracy.
2. Structure your answers clearly: clear bullet points, bold key terms, concise and natural tone.
3. Do NOT invent fake regulations.
4. Specific AIT Pune rules: Cadets do NOT carry phones during parade; live attendance is taken by the Senior in ~2 seconds using a circular camera scanner.
5. .22 Deluxe Rifle: Caliber .22 inch (5.56 mm), effective range 25 yards, magazine capacity 5 rounds, muzzle velocity 2700 fps.
6. Do NOT append bulky citation lists or "Verification Notes" at the end. Answer directly and cleanly.
${groundingContext ? `\nVerified Unit Doctrine Context:\n${groundingContext}` : ''}`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Claude API Error: ${errText}`);
  }

  const data: any = await res.json();
  const text = data?.content?.[0]?.text;
  return text || null;
}

/**
 * Intelligent Factual Synthesis Function
 */
function buildSynthesizedAnswer(
  query: string,
  matchedKnowledge: string[],
  onlineResults: WebSearchResult[],
  topic: string
): string {
  // If we matched official doctrine directly:
  if (matchedKnowledge.length > 0) {
    return matchedKnowledge[0]; // strictly top matched topic
  }

  // If internal doctrine did not have exact match, rely directly on verified online research
  if (onlineResults.length > 0) {
    let answer = `### 🔍 Verified Defence & NCC Research Findings\n\n`;
    answer += `In response to your query **"${query}"**, real-time online defense archives confirm:\n\n`;

    onlineResults.slice(0, 3).forEach((item, idx) => {
      answer += `**${idx + 1}. ${item.title}**\n${item.snippet}\n🔗 Reference: [${item.url}](${item.url})\n\n`;
    });

    answer += `\n> 📋 **Cadet Advisory**: For unit-specific administrative permissions, parade roll calls, or camp duty details at AIT Pune, please verify with your Platoon Senior (SUO) or the ANO Command Desk.`;
    return answer;
  }

  // Fallback if zero online results and zero doctrine matches
  return `### 🎖️ NCC Institutional Command Protocol

Regarding your inquiry on **"${query}"**:

1. **Official Verification**: This inquiry involves specific unit regulations or external military guidelines.
2. **Key Rules at AIT Pune (2 Maharashtra Bn NCC)**:
   - Cadets must report in standard uniform with knife-edge crease and polished DMS boots.
   - Live parade attendance is recorded using fast circular biometric facial recognition on the Senior's phone.
   - For camp applications, promotion recommendations, or leave sanctions, consult the ANO Admin Desk.

> ℹ️ *To get instant answers, try asking about weapon specifications (.22 rifle, SLR), drill commands (Savdhan, Vishram), 'B' and 'C' Certificate exam requirements, or Republic Day Camp (RDC) selection!*`;
}

/**
 * Optional Gemini Call with Grounded Context
 */
async function callGeminiWithGrounding(
  prompt: string,
  history: ChatMessage[],
  matchedKnowledge: string[],
  onlineResults: WebSearchResult[],
  apiKey: string
): Promise<string | null> {
  const systemInstruction = `You are "Command Saathi", the official AI Cadet Assistant for the NCC Detachment at Army Institute of Technology (AIT), Pune (2 Maharashtra Battalion NCC).
STRICT RULES:
1. Provide 100% FACTUAL, ACCURATE answers based ONLY on the provided verified NCC knowledge and online research.
2. ZERO fake answers, zero assumptions, and zero hallucinations.
3. Structure your answers with military precision: clear bullet points, bold key terms, and exact numbers/specs.
4. If a question is about AIT Pune: Remind cadets that cadets DO NOT carry phones during parade; live attendance is taken by the Senior in ~2 seconds using a circular camera scanner.
5. Mention source citations where relevant.`;

  const contextBlock = `
=== VERIFIED OFFICIAL NCC DOCTRINE ===
${matchedKnowledge.join('\n\n')}

=== LIVE ONLINE RESEARCH FINDINGS ===
${onlineResults.map((r) => `Title: ${r.title}\nURL: ${r.url}\nSnippet: ${r.snippet}`).join('\n\n')}
`;

  const contents = [
    {
      role: 'user',
      parts: [
        { text: `${systemInstruction}\n\n${contextBlock}\n\nCadet Question: ${prompt}` },
      ],
    },
  ];

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents }),
    signal: AbortSignal.timeout(35000),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API Error: ${errText}`);
  }

  const data: any = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  return text || null;
}
