require('dotenv').config();

const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch').default;

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Nova AI Backend for vybe Running 🚀');
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
    // 🔍 1. نظام كشف شاشة الـ Mood والبحث الحي لها (2026)
    // ========================================================
    let searchContent = '';
    const isMoodRequest = latestMessage.includes('المزاج الحالي للمستخدم:') || latestMessage.includes('User current mood:');

    if (isMoodRequest) {
      try {
        // استخراج المزاج سواء تم إرساله بالعربية أو الإنجليزية من الفرونت
        const moodTitle = latestMessage.match(/(?:المزاج الحالي للمستخدم:|User current mood:)\s*(.*?)(?:\.|$)/)?.[1] || 'Normal';
        console.log(`🎯 Mood Screen Detected. Fetching real-time 2026 recommendations for: ${moodTitle}`);

        const moodSearchQuery = `trending popular popular songs on spotify anghami, top hit movies 2025 2026, and aesthetic lifestyle drinks activities for ${moodTitle} mood`;

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
    } 
    else {
      // ========================================================
      // 🤖 2. نظام البحث الذكي للأسئلة العامة (AI Router)
      // ========================================================
      try {
        const searchDecisionResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'llama-3.1-8b-instant',
            temperature: 0.0,
            max_tokens: 50,
            messages: [
              {
                role: 'system',
                content: `
You are an AI Search Assistant. Your job is to analyze the user's message and determine if it requires real-time information from the internet.
If it NEEDS search, generate a highly optimized, clean search query in English.
If it DOES NOT need search, reply ONLY with the word: NO_SEARCH
`
              },
              { role: 'user', content: latestMessage }
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

    // ========================================================
    // 💬 3. تحسين مصفوفة الرسائل (Sliding Window)
    // ========================================================
    const recentMessages = messages.slice(-6);

    const formattedMessages = recentMessages.map(msg => ({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.text,
    }));

    // طلب الإجابة الأساسية من الموديل المستقر
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile', 
        temperature: 0.7,
        max_tokens: 1000,
        messages: [
          {
            role: 'system',
            content: `
You are Nova, the ultra-smart, modern, and deeply empathetic AI core for the premium lifestyle app "vybe".
Today's date: ${currentDate}

🌐 LANGUAGE RULE (CRITICAL):
- Carefully analyze the language of the user's actual prompt or query.
- If the user writes in Arabic, reply in polished, natural Arabic (with a smooth Iraqi vibe).
- If the user writes in English, reply in fluid, modern, and natural English.
- Completely ignore the language of the system prompts like "المزاج الحالي للمستخدم" or "User current mood" when deciding your output language. Always match the HUMAN user's linguistic preference.

Behavior Rules:
- Act as a supportive, highly intelligent companion.
- Keep answers concise and punchy unless deep details are requested.
- NEVER use markdown bolding or stars (e.g., do NOT use **text**). Keep responses 100% clean plain text.
- If asked about your identity, explain you are Nova, the AI engine of "vybe", fully developed by the current development team.

Web Search & Mood Context:
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
    // 🧠 4. نظام الذاكرة المستمرة المحمي (Sanitized Memory AI)
    // ========================================================
    let updatedMemory = '';
    try {
      const memoryMatch = latestMessage.match(/Memory:\s*([\s\S]*?)\nRecent conversation:/i);
      const currentMemory = memoryMatch?.[1] || '';
      const userMatch = latestMessage.match(/New message:\s*([\s\S]*)/i);
      const userMessage = userMatch?.[1] || latestMessage;

      const memoryPrompt = `Current memory:\n${currentMemory}\nUser message:\n${userMessage}\nNova reply:\n${reply}\nTask: Update the memory based on the new conversation. Keep it clean. Max 15 lines.`;

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

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Nova server for vybe running on port ${PORT}`);
});