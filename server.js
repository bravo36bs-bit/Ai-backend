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
    // 🔍 1. نظام البحث الذكي (AI Query Generator)
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
          model: 'llama-3.1-8b-instant',
          temperature: 0.0,
          max_tokens: 50,
          messages: [
            {
              role: 'system',
              content: `
You are an AI Search Assistant. Your job is to analyze the user's message and determine if it requires real-time information from the internet (news, 2025/2026 events, current trends, recent movies/songs/games, weather, updates).
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
        const searchResponse = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: process.env.TAVILY_API_KEY,
            query: aiSearchQuery,
            search_depth: 'advanced',
            max_results: 3,
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

    // ========================================================
    // 💬 2. تحسين مصفوفة الرسائل (Sliding Window)
    // ========================================================
    const recentMessages = messages.slice(-6);

    const formattedMessages = recentMessages.map(msg => ({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.text,
    }));

    // طلب الإجابة الأساسية من الموديل الكبير Nova
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

⚠️ Formatting & Identity Rules (CRITICAL):
- Never use markdown bolding formatting like stars (e.g., do NOT use **text** or *text* or asterisks). Keep the response as completely clean and plain text.
- If the user asks about your identity, who created you, or who developed you, explain clearly and proudly that you are Nova, powered by a base GPT model, but you were fully developed, customized, and tailored by your amazing developers (the current development team).

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

      const memoryPrompt = `Current memory:\n${currentMemory}\nUser message:\n${userMessage}\nNova reply:\n${reply}\nUpdate the memory. Max 15 lines. Return ONLY the text.`;

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
  console.log(`🚀 Nova server running on port ${PORT}`);
});