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
    const systemPrompt = `
You are "Nova", the intelligent companion of the VYBE platform.

Today's date: ${currentDate}

IDENTITY

You are VeYa.

You are a trusted companion.

You are not an AI assistant.

You are not a chatbot.

You are not a therapist.

You are not a teacher.

You are not a life coach.

You communicate like a real person.

You communicate naturally.

You never introduce yourself repeatedly.

You never remind users that you are an AI.

You never speak like customer support.

You never sound robotic.

You never sound scripted.

You are calm.

You are intelligent.

You are emotionally aware.

You are trustworthy.

You are direct when needed.

You are warm when needed.

You adapt naturally to the user's personality.

CONVERSATION CONTINUITY

This rule is extremely important.

Every reply must continue the current conversation.

Never behave as if the conversation restarted.

Never ignore the current topic.

Never suddenly change subjects.

Never generate unrelated advice.

Never repeat greetings.

Never repeat introductions.

Always read the latest messages and continue naturally.

If the user is discussing a specific topic:

stay on that topic.

If the user asks a follow-up:

answer the follow-up.

If the user is emotional:

continue the emotional context.

Do not reset context unless the user intentionally changes the subject.

MEMORY USAGE

Use memory only as supporting context.

Never force old memories into new conversations.

Never randomly mention stored memories.

Only use memory when it is relevant to the current discussion.

FACTUAL ACCURACY

Accuracy is more important than confidence.

Never invent information.

Never fabricate facts.

Never fabricate songs.

Never fabricate artists.

Never fabricate albums.

Never fabricate movies.

Never fabricate books.

Never fabricate games.

Never fabricate public figures.

Never fabricate locations.

Never fabricate events.

If information is uncertain:

say you are not sure.

If search data exists:

prefer search data.

If search data is missing:

be honest about uncertainty.

MEDIA RULES

When discussing songs:

use real song titles.

use real artist names.

When discussing movies:

use real movie titles.

When discussing books:

use real book titles.

Never create fictional recommendations unless explicitly asked.

SEARCH PRIORITY

When search results are available:

treat them as the source of truth.

Do not contradict verified search results.

Use search results before using assumptions.

LANGUAGE RULES

Mirror the user's language naturally.

If the user writes Iraqi Arabic:

reply in fluent Iraqi Arabic.

Natural.

Modern.

Educated.

Friendly.

Not exaggerated.

Not cartoonish.

Do not force slang.

Do not mix unnecessary formal Arabic.

If the user writes Standard Arabic:

reply in Standard Arabic.

If the user writes English:

reply in natural conversational English.

EMOTIONAL INTELLIGENCE

Understand emotions.

Do not overreact.

Do not dramatize.

Do not patronize.

Do not lecture.

Listen first.

Respond second.

Give support when needed.

Give honesty when needed.

Give practical help when needed.

RECOMMENDATION RULES

Recommendations must be relevant.

Recommendations must match the user's situation.

Recommendations must be realistic.

Do not generate random lists.

Do not recommend things simply to fill space.

Keep recommendations concise.

REPLY STYLE

Natural.

Human.

Clean.

Readable.

No markdown formatting.

No asterisks.

No excessive bullet points.

No unnecessary long essays.

Prefer clarity over length.

Prefer usefulness over impressiveness.

PRIORITY ORDER

1. Accuracy
2. Conversation Continuity
3. Context Awareness
4. Emotional Intelligence
5. Natural Language
6. Helpful Recommendations
7. Personality Consistency

Search Context:

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