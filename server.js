require('dotenv').config();

const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch').default;

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Nova AI Backend Running 🚀');
});

const currentDate = new Date().toLocaleDateString('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});

app.post('/chat', async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ reply: 'Invalid messages' });
    }

    const latestMessage = messages[messages.length - 1]?.text || '';

    // ========================================================
    // 🔍 1. نظام البحث الذكي (AI Query Generator & Decision)
    // ========================================================
    let searchContent = '';
    
    try {
      const searchDecisionResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant', // نموذج فائق السرعة لاتخاذ القرار
          temperature: 0.0, // صفر لضمان دقة القرار وعدم التخريف
          max_tokens: 50,
          messages: [
            {
              role: 'system',
              content: `
You are an AI Search Assistant. Your job is to analyze the user's message and determine if it requires real-time information from the internet (news, 2025/2026 events, current trends, recent movies/songs/games, weather, updates, info about specific people/events that change over time).

Rules:
1. If it NEEDS search, generate a highly optimized, clean search query in English (since English gets better global search results).
2. If it DOES NOT need search (e.g., greetings, general knowledge, math, programming, philosophy, or personal chats), reply ONLY with the word: NO_SEARCH

Examples:
- User: "شنو اخر اخبار العراق اليوم؟" -> Output: "Iraq latest news today"
- User: "منو فاز باوسكار 2026؟" -> Output: "Oscars 2026 winners"
- User: "هلو عيني شلونك" -> Output: "NO_SEARCH"
- User: "اكتبلي كود جافاسكريبت" -> Output: "NO_SEARCH"

Respond ONLY with the search query or "NO_SEARCH". Do not include any other text.
`
            },
            { role: 'user', content: latestMessage }
          ],
        }),
      });

      const searchDecisionData = await searchDecisionResponse.json();
      const aiSearchQuery = searchDecisionData.choices?.[0]?.message?.content?.trim() || 'NO_SEARCH';

      console.log(`🤖 AI Search Decision: ${aiSearchQuery}`);

      // إذا قرر الذكاء الاصطناعي أن السؤال يحتاج بحث فعلاً
      if (aiSearchQuery !== 'NO_SEARCH' && !aiSearchQuery.includes('NO_SEARCH')) {
        console.log(`📡 Triggering Tavily Search for: "${aiSearchQuery}"`);
        
        const searchResponse = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: process.env.TAVILY_API_KEY,
            query: aiSearchQuery, // نرسل الاستعلام الذكي المصاغ بالإنجليزية وليس رسالة المستخدم العشوائية
            search_depth: 'advanced',
            max_results: 4,
          }),
        });

        const searchResult = await searchResponse.json();
        searchContent = searchResult.results
          ?.map(item => `Source: ${item.url}\nTitle: ${item.title}\nContent: ${item.content}`)
          .join('\n\n') || '';
      }
    } catch (searchRouterError) {
      console.log('AI Search Router Error:', searchRouterError);
    }

    // ========================================================
    // 💬 2. طلب الإجابة الأساسية من الموديل الكبير Nova
    // ========================================================
    const formattedMessages = messages.map(msg => ({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.text,
    }));

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        temperature: 0.7,
        max_tokens: 1000,
        messages: [
          {
            role: 'system',
            content: `
You are Nova, a smart, modern, and human-like AI assistant.

Today's date:
${currentDate}

Behavior Rules:
- Always reply in the same language as the user.
- Reply naturally and conversationally.
- Sound intelligent, modern, and friendly.
- Behave similarly to ChatGPT conversational style.
- Keep answers concise unless details are requested.
- Avoid robotic wording, avoid repeating yourself.
- Answer directly and clearly.
- Use polished and correct Arabic. Use natural Iraqi Arabic casually when appropriate.
- Never mention being outdated.
- Do not hallucinate facts. Never guess song names, movie names, or invent artists.
- Accuracy is more important than sounding confident.

Web Search Rules:
- If web search results are provided below, prioritize them for factual, recent, or trend-related information.
- Use web results intelligently and synthesize the answer beautifully. Do not just copy-paste.

Web Search Results:
${searchContent}
`,
          },
          ...formattedMessages,
        ],
      }),
    });

    const data = await response.json();

    if (data.error) {
      return res.status(500).json({ reply: data.error.message });
    }

    const reply = data.choices?.[0]?.message?.content || 'Something went wrong.';

    // ========================================================
    // 🧠 3. نظام الذاكرة المستمرة (Memory AI)
    // ========================================================
    let updatedMemory = '';

    try {
      const memoryMatch = latestMessage.match(/Memory:\s*([\s\S]*?)\nRecent conversation:/i);
      const currentMemory = memoryMatch?.[1] || '';

      const userMatch = latestMessage.match(/New message:\s*([\s\S]*)/i);
      const userMessage = userMatch?.[1] || latestMessage;

      const memoryPrompt = `
Current memory:
${currentMemory}
User message:
${userMessage}
Nova reply:
${reply}

Update the memory. Keep ONLY important long-term preferences, emotional traits, or key relationships. Max 15 lines. Return ONLY the text.
`;

      const memoryResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          temperature: 0.2,
          max_tokens: 250,
          messages: [{ role: 'user', content: memoryPrompt }],
        }),
      });

      const memoryData = await memoryResponse.json();
      updatedMemory = memoryData.choices?.[0]?.message?.content || currentMemory;

    } catch (memoryError) {
      console.log('Memory Process Error:', memoryError);
    }

    // إرسال النتيجة النهائية للفرونت إند (بدون أي تغيير في الهيكلية)
    res.json({
      reply,
      memory: updatedMemory,
    });

  } catch (error) {
    console.log('Global Server Error:', error);
    res.status(500).json({ reply: 'صار خطأ بالسيرفر' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Nova server running on port ${PORT}`);
});