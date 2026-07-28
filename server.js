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
// 💜 1. مسار Vybe (يعمل كما هو)
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

        const moodSearchQuery = `trending popular songs on spotify anghami, top hit movies, and aesthetic lifestyle drinks activities for ${moodTitle} mood`;

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
                content: `You are an AI Search Assistant. Analyze user prompt: If it NEEDS search (news, current events, recent items, sports, tech questions), generate a clean English query. If NOT, reply ONLY: NO_SEARCH`,
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
- Reply in the same language as the user.
- Keep answers concise unless details are requested.
- Never mention outdated knowledge. Do not hallucinate facts.
- Never use markdown bolding formatting like stars (NO **text** or *text*).

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

    let reply = data.choices?.[0]?.message?.content || 'Something went wrong.';
    reply = reply.replace(/\*\*/g, '').replace(/\*/g, '');

    let updatedMemory = '';
    try {
      const memoryMatch = latestMessage.match(/Memory:\s*([\s\S]*?)\nRecent conversation:/i);
      const currentMemory = memoryMatch?.[1] || '';
      const userMatch = latestMessage.match(/New message:\s*([\s\S]*)/i);
      const userMessage = userMatch?.[1] || latestMessage;

      const memoryPrompt = `Current memory: ${currentMemory}\nUser message: ${userMessage}\nNova reply: ${reply}\nTask: Update memory. Return ONLY updated plain text memory.`;

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

    res.json({ reply, memory: updatedMemory });

  } catch (error) {
    console.log('Global Server Error:', error);
    res.status(500).json({ reply: 'صار خطأ بالسيرفر' });
  }
});

// ========================================================
// 🌟 2. مسار Nova الخالص (النسخة المحصنة من الهلوسة والنجوم)
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

    // 🌐 1. AI Search Router الدقيق والمعتمد على Tavily
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
          max_tokens: 80,
          messages: [
            {
              role: 'system',
              content: `You are Nova's Active Search Router.

Task:
- Generate a concise English search query for Tavily if the user prompt asks about real-world facts, device specs, phone prices, news, sports, or releases.
- ONLY reply "NO_SEARCH" if it is strictly a simple greeting like "hi", "hello", "مرحبا", "شلونك".`,
            },
            { role: 'user', content: latestMessageText },
          ],
        }),
      });

      const searchDecisionData = await searchDecisionResponse.json();
      const aiSearchQuery = searchDecisionData.choices?.[0]?.message?.content?.trim() || 'NO_SEARCH';

      if (aiSearchQuery !== 'NO_SEARCH' && !aiSearchQuery.includes('NO_SEARCH')) {
        console.log(`🌐 [Nova Search Router] Executing Tavily Search for: "${aiSearchQuery}"`);

        const searchResponse = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: process.env.TAVILY_API_KEY,
            query: aiSearchQuery,
            search_depth: 'advanced',
            max_results: 5,
          }),
        });

        const searchResult = await searchResponse.json();
        searchContent = searchResult.results
          ?.map(item => `Title: ${item.title}\nContent: ${item.content.substring(0, 600)}`)
          .join('\n\n') || '';
      }
    } catch (searchError) {
      console.log('⚠️ Nova Search Router Error:', searchError.message);
    }

    // 💬 2. السياق المحلي (آخر 6 رسائل)
    const recentMessages = messages.slice(-6).map(msg => ({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: String(msg.text || ''),
    }));

    // 🤖 3. طلب الرد المحصن تماماً ضد الهلوسات
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        temperature: 0.1, // درجة حرارة منخفضة جداً لمنع افتراض الهواتف المستقبلية أو الأسعار الخيالية
        max_tokens: 1000,
        messages: [
          {
            role: 'system',
            content: `
You are Nova, an intelligent, modern, and honest AI companion.

Behavior & Tone:
- Reply in friendly Iraqi Arabic or clean Standard Arabic.
- Be conversational, humble, smart, direct, and concise.
- Keep responses as plain clean text. DO NOT use markdown bolding (DO NOT use **text** or *text*).

⚠️ STRICT GROUNDING & ANTI-HALLUCINATION:
- Base your answers strictly on real-world facts and the Web Search Results provided below.
- NEVER invent imaginary devices (e.g. A57), fake processors, or incorrect phone prices (e.g. $1500 for Samsung A35).
- If information is not found in the search results, state honestly that details are unavailable.

⚠️ Identity Rule:
- Explain simply that you are Nova, designed and customized by your awesome development team to be a smart everyday companion. Be humble!

Web Search Results:
${searchContent || 'No real-time search context required.'}
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

    let reply = data.choices?.[0]?.message?.content || 'لم أستطع معالجة الإجابة.';

    // 🧹 تنظيف إضافي من السيرفر: مسح أي نجوم ** قبل إرسال النص للواجهة
    reply = reply.replace(/\*\*/g, '').replace(/\*/g, '');

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