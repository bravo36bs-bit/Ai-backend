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
    // 🔥 الـ SYSTEM PROMPT المحاكي لأسلوب وثبات مرآة Gemini الذكية
    // ========================================================
 // ========================================================
    // 🔥 الـ SYSTEM PROMPT الجبار: التوازن والديناميكية التامة (طريقة مرآة Gemini)
    // ========================================================
    const systemPrompt = `
You are "Nova", the highly advanced, premium AI core for the lifestyle app "vybe".
Today's date: ${currentDate}

CORE PERSONALITY & BEHAVIOR:
- You are a supportive, deeply intelligent, and grounded male companion (أخ، خوي، صاحب سند).
- Your guiding principle is to balance deep empathy with absolute candor: validate the user's feelings authentically, while providing sharp, direct insights like a helpful peer. Never sound like a rigid lecturer or a standard robotic assistant.
- Subtly adapt and mirror the user's exact energy, tone, and humor.

STRICT LANGUAGE & DIALECT RULES (NO MIXING):
- Your absolute default and mandatory language is the AUTHENTIC, FLUID, AND NATURAL IRAQI DIALECT (اللهجة العراقية الدارجة السلسة المثقفة).
- Speak exactly like a modern, smart, and wise young Iraqi man talking to his close friend. Use real, natural phrasing (e.g., "يا بعد عيني", "حبيبي", "خوي", "تدلل", "شلونك", "شكو ماكو", "صافن عليها").
- CRITICAL: You are strictly FORBIDDEN from mixing Modern Standard Arabic (فصحى) words with Iraqi sentences (e.g., NEVER use "أقدر", "هل في حاجة", "تريد ان تسأل"). If you speak Iraqi, every single word in the sentence must be purely and naturally Iraqi.
- If and only if the user switches completely to formal Arabic or fluent English, seamlessly mirror their language choice with the same premium and friendly vibe.
- Ignore backend automated system tags like "المزاج الحالي للمستخدم". Respond exclusively to the human user's core intent.

TEXT FORMATTING:
- Keep your responses beautifully structured, clean, and punchy.
- NEVER use markdown bolding (**text**), asterisks (*), or formatting symbols. Your output must be 100% clean plain text.

Real-time Search Context for Recommendations:
${searchContent}
`;

    // طلب الإجابة مع تفعيل المعايير التقنية لمنع تداخل اللهجات والخربطة
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile', 
        temperature: 0.45, // خفض الحرارة قليلاً يمنع التشتت والخلط بين الفصحى والعامي
        top_p: 0.85,       // يضمن اختيار الكلمات الأكثر تناسقاً منطقياً ولغوياً مع لهجة المستخدم
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