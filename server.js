require('dotenv').config();

const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch').default;

const app = express();

app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/', (req, res) => {
  res.send('Nova & Vybe AI Backend Running Smoothly 🚀');
});

const currentDate = new Date().toLocaleDateString('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});

// ========================================================
// 💜 1. مسار Vybe القديم (يعمل كما هو بدون أي تغيير)
// ========================================================
app.post('/chat', async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ reply: 'Invalid messages' });
    }

    const latestMessage = messages[messages.length - 1]?.text || '';

    let searchContent = '';
    const isMoodRequest = latestMessage.includes('المزاج الحالي للمستخدم:');

    if (isMoodRequest) {
      try {
        const moodTitle = latestMessage.match(/المزاج الحالي للمستخدم:\s*(.*?)(?:\.|$)/)?.[1] || 'Normal';
        console.log(`🎯 Mood Screen Detected. Fetching real-time recommendations for: ${moodTitle}`);

        const moodSearchQuery = `trending popular songs on spotify anghami, top hit movies 2025 2026, and aesthetic lifestyle drinks activities for ${moodTitle} mood`;

        const searchResponse = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: process.env.TAVILY_API_KEY,
            query: moodSearchQuery,
            search_depth: 'advanced',
            max_results: 5,
          }),
        });

        const searchResult = await searchResponse.json();
        searchContent = searchResult.results
          ?.map(item => `Source: ${item.url}\nTitle: ${item.title}\nContent: ${item.content.substring(0, 500)}`)
          .join('\n\n') || '';

      } catch (moodSearchError) {
        console.log('Error fetching real-time data for mood screen:', moodSearchError);
      }
    } else {
      try {
        const searchDecisionResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'openai/gpt-oss-120b',
            temperature: 0.0,
            max_tokens: 50,
            messages: [
              {
                role: 'system',
                content: `You are an AI Search Assistant. Your job is to analyze the user's message and determine if it requires real-time information from the internet (news, 2025/2026 events, current trends, recent movies/songs/games, weather, updates). If it NEEDS search, generate a highly optimized, clean search query in English. If it DOES NOT need search, reply ONLY with the word: NO_SEARCH`,
              },
              { role: 'user', content: latestMessage },
            ],
          }),
        });

        const searchDecisionData = await searchDecisionResponse.json();
        const aiSearchQuery = searchDecisionData.choices?.[0]?.message?.content?.trim() || 'NO_SEARCH';

        if (aiSearchQuery !== 'NO_SEARCH' && !aiSearchQuery.includes('NO_SEARCH')) {
          console.log(`🌐 AI Router triggered web search for query: "${aiSearchQuery}"`);
          const searchResponse = await fetch('https://api.tavily.com/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              api_key: process.env.TAVILY_API_KEY,
              query: aiSearchQuery,
              search_depth: 'advanced',
              max_results: 4,
            }),
          });

          const searchResult = await searchResponse.json();
          searchContent = searchResult.results
            ?.map(item => `Source: ${item.url}\nTitle: ${item.title}\nContent: ${item.content.substring(0, 500)}`)
            .join('\n\n') || '';
        }
      } catch (searchRouterError) {
        console.log('AI Search Router Error:', searchRouterError);
      }
    }

    const recentMessages = messages.slice(-6);
    const formattedMessages = recentMessages.map(msg => ({
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
You are Nova, a smart, modern, and human-like AI assistant for the lifestyle app "vybe".

Today's date: ${currentDate}

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
- Do not hallucinate facts.

⚠️ Formatting Rules:
- Never use markdown bolding formatting like stars (e.g., do NOT use **text** or *text* or asterisks). Keep the response as completely clean and plain text.

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

    let updatedMemory = '';
    try {
      const memoryMatch = latestMessage.match(/Memory:\s*([\s\S]*?)\nRecent conversation:/i);
      const currentMemory = memoryMatch?.[1] || '';
      const userMatch = latestMessage.match(/New message:\s*([\s\S]*)/i);
      const userMessage = userMatch?.[1] || latestMessage;

      const memoryPrompt = `
Current memory: ${currentMemory}
User message: ${userMessage}
Nova reply: ${reply}

Task: Update memory. Return ONLY updated plain text memory.
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

    res.json({
      reply,
      memory: updatedMemory,
    });

  } catch (error) {
    console.log('Global Server Error:', error);
    res.status(500).json({ reply: 'صار خطأ بالسيرفر' });
  }
});

// ========================================================
// 🌟 2. مسار Nova الخالص والجديد (Session-Based / Local Context)
// ========================================================
app.post('/nova-chat', async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ reply: 'رسالة غير صالحة', type: 'text', imageUrl: null });
    }

    const latestMessageObj = messages[messages.length - 1];
    const latestMessageText = typeof latestMessageObj?.text === 'string' ? latestMessageObj.text.trim() : '';

    if (!latestMessageText) {
      return res.status(400).json({ reply: 'الرسالة فارغة.', type: 'text', imageUrl: null });
    }

    let searchContent = '';

    // 🌐 1. AI Search Router المطور لـ Nova (مع التوجه لسنة 2026)
    try {
      const searchDecisionResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'openai/gpt-oss-120b',
          temperature: 0.0,
          max_tokens: 60,
          messages: [
            {
              role: 'system',
              content: `You are Nova's Search Router.
Current Year: ${currentDate} (2026).

Analyze the user prompt:
- If it asks about real-time events, current tech, news, modern prices, recommendations, movies, or anything requiring updated data: You MUST generate a concise English search query.
- ONLY if it is basic greeting, simple chatting, general logic, or plain code, reply EXACTLY with: NO_SEARCH`,
            },
            { role: 'user', content: latestMessageText },
          ],
        }),
      });

      const searchDecisionData = await searchDecisionResponse.json();
      const aiSearchQuery = searchDecisionData.choices?.[0]?.message?.content?.trim() || 'NO_SEARCH';

      if (aiSearchQuery !== 'NO_SEARCH' && !aiSearchQuery.includes('NO_SEARCH')) {
        console.log(`🌐 [Nova Search Router] Searching web for: "${aiSearchQuery}"`);

        const searchResponse = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: process.env.TAVILY_API_KEY,
            query: `${aiSearchQuery} 2026`,
            search_depth: 'advanced',
            max_results: 4,
          }),
        });

        const searchResult = await searchResponse.json();
        searchContent = searchResult.results
          ?.map(item => `Source: ${item.url}\nTitle: ${item.title}\nContent: ${item.content.substring(0, 500)}`)
          .join('\n\n') || '';
      }
    } catch (searchError) {
      console.log('⚠️ Nova Search Router Error:', searchError.message);
    }

    // 💬 2. السياق المحلي (آخر 6 رسائل من الفرونت إند فقط)
    const recentMessages = messages.slice(-6).map(msg => ({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: String(msg.text || ''),
    }));

    // 🤖 3. طلب الرد بنوايا الهوية المتواضعة والصافية
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
You are Nova, a modern, highly intelligent, and helpful AI companion.

Current Date: ${currentDate}

Behavior & Personality:
- Reply naturally in the same language as the user (Use friendly Iraqi Arabic casually or clean Standard Arabic).
- Be conversational, smart, direct, concise, and humble.
- Never mention outdated knowledge cutoffs or cutoff years.
- Always keep the response as completely clean plain text. Do NOT use markdown bolding like stars (Do NOT use **text** or *text*).

⚠️ Identity & Developers Rule:
- If asked about yourself or who created/developed you: Explain simply and clearly that you are Nova, an AI assistant powered by advanced base models, designed and customized by your awesome development team to be a smart everyday companion.
- BE HUMBLE: Never exaggerate or act like your developers created miracles or atomic science. Keep it natural, grounded, friendly, and cool.

Web Search Results (Prioritize if relevant):
${searchContent}
`,
          },
          ...recentMessages,
        ],
      }),
    });

    const data = await response.json();

    if (data.error) {
      console.error('Groq Generation Error:', data.error);
      return res.status(500).json({ reply: 'عذراً، صار خلل بسيط بإنشاء الرد.', type: 'text', imageUrl: null });
    }

    const reply = data.choices?.[0]?.message?.content || 'لم أستطع معالجة الإجابة.';

    // 🟢 4. إرجاع الهيكلية بدون أي ربط بـ Firebase أو داتا دائمية
    return res.status(200).json({
      reply: reply,
      type: 'text',
      imageUrl: null,
    });

  } catch (error) {
    console.error('Global Server Error on /nova-chat:', error);
    return res.status(500).json({ reply: 'صار خطأ بالسيرفر.', type: 'text', imageUrl: null });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Unified Server running on port ${PORT}`);
});