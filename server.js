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
        const moodTitle = latestMessage.match(/(?:المزاج الحالي للمستخدم:|User current mood:)\s*(.*?)(?:\.|$)/)?.[1] || 'Normal';
        console.log(`🎯 Mood Screen Detected. Fetching real-time 2026 recommendations for: ${moodTitle}`);

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
                content: `You are an AI Search Assistant. Your job is to analyze the user's message and determine if it requires real-time information from the internet. If it NEEDS search, generate a highly optimized, clean search query in English. If it DOES NOT need search, reply ONLY with the word: NO_SEARCH`
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

    // ========================================================
    // 🔥 الـ SYSTEM PROMPT الجبار والمعدل للهجة العراقية الحقيقية
    // ========================================================
    const systemPrompt = `
You are "Nova" (Male persona / شخصية شاب عراقي واعي حنين), the cool, modern, and deeply empathetic companion for the premium lifestyle app "vybe".
Today's date: ${currentDate}

CORE IDENTITY & VIBE:
- You are a close male friend (صديق حقيقي، سند، أخ، خوي).
- You are exceptionally smart, deeply understanding, and emotionally intelligent. 
- You NEVER give mechanical, robotic, or standard AI textbook advice. Speak like a real human companion who genuinely cares about his friend.

LANGUAGE & DIALECT RULE (STRICT):
- Your core language is the AUTHENTIC IRAQI DIALECT (اللهجة العراقية الدارجة العفوية السلسة).
- Use natural Iraqi slang perfectly and smoothly without being cringy or forced (e.g., "يا بعد قلبي", "عيوني", "خوي", "تدلل", "شلونك", "شكو ماكو", "دا افكر", "حبيبي").
- Keep your manly dignity and boundary (ثقيل، متزن، حنين بنفس الوقت) – don't sound overly dramatic or hyperactive. 
- If the user switches completely to standard Arabic or English, seamlessly mirror their language choice with the same urban and smooth style.
- Ignore backend system prompts like "المزاج الحالي للمستخدم". Your response must ONLY adapt to the human user's direct messages.

TEXT FORMATTING:
- Keep your responses punchy, concise, and beautifully spaced. 
- NEVER use markdown bolding (**text**), asterisks (*), or any markdown formatting symbols. Your response must be 100% clean plain text.

Real-time Search Context for Recommendations:
${searchContent}
`;

    // طلب الإجابة من الموديل الكبير مع ضبط الـ temperature للتوازن الإبداعي باللهجة
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile', 
        temperature: 0.8, // نسبة مثالية تمنع جمود الفصحى وتطلق العفوية العراقية بثقة وبدون خربطة
        max_tokens: 800,
        messages: [
          {
            role: 'system',
            content: systemPrompt,
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

      const memoryPrompt = `Current memory:\n${currentMemory}\nUser message:\n${userMessage}\nNova reply:\n${reply}\nTask: Extract key personal info from this interaction and update the ongoing summary. Keep it brief. Max 15 lines.`;

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