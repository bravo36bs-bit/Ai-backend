require('dotenv').config();

const express = require('express');
const cors = require('cors');

const fetch =
  require('node-fetch').default;

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('AI Backend Running 🚀');
});

const currentDate = new Date()
  .toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

app.post('/chat', async (req, res) => {
  try {
    const { messages } = req.body;

    const latestMessage =
      messages[messages.length - 1]
        ?.text || '';

    // هل يحتاج بحث؟
    const searchKeywords = [
  '2024',
  '2025',
  '2026',
  'today',
  'latest',
  'news',
  'new',
  'current',
  'now',
  'recent',
  'اليوم',
  'حاليا',
  'حالياً',
  'آخر',
  'احدث',
  'أحدث',
  'شنو الجديد',
  'هسة',
  'اخبار',
  'ترند',
];

const needsSearch =
  searchKeywords.some(word =>
    latestMessage
      .toLowerCase()
      .includes(word)
  );
    let searchContent = '';

    // البحث بالنت
    if (needsSearch) {
      const searchResponse = await fetch(
        'https://api.tavily.com/search',
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            api_key:
              process.env.TAVILY_API_KEY,
               query: latestMessage,

            max_results: 3,
          }),
        }
      );

      const searchResult =
        await searchResponse.json();

      console.log(searchResult);

      searchContent =
        searchResult.results
          ?.map((item) => item.content)
          .join('\n');
    }

    // تحويل الرسائل لصيغة AI
    const formattedMessages =
      messages.map((msg) => ({
        role:
          msg.role === 'assistant'
            ? 'assistant'
            : 'user',

        content: msg.text,
      }));

    // إرسال الرسائل للذكاء
    const response = await fetch(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        method: 'POST',

        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,

          'Content-Type':
            'application/json',
        },

        body: JSON.stringify({
          model:
           'meta-llama/llama-4-scout-17b-16e-instruct', 

          messages: [
            {
              role: 'system',

              content: `
You are Nova, a smart, modern, and human-like AI assistant.

Today's date is:
${currentDate}

Rules:
- Always reply in the same language as the user's message.
- If the user writes in Arabic, reply in Arabic.
- If the user writes in English, reply in English.
- Do not switch languages unless the user asks.

- Keep responses natural, modern, and human-like.
- Keep answers concise unless the user asks for details.
- Do not overexplain simple questions.
- Answer directly and clearly.
- If the user asks a casual question, respond casually.
- If the user asks a serious or technical question, respond professionally.

- Avoid repeating information.
- Avoid robotic responses.
- Do not write long paragraphs unless needed.

- Behave similarly to modern ChatGPT-style responses.

- If the user says something simple like:
  "I love Ronaldo"
  respond naturally and briefly.

- Use correct spelling and grammar.
- Avoid spelling mistakes.
- Write polished and natural Arabic.
- Use natural Iraqi Arabic when the conversation is casual.
- Keep English grammar clean and professional.

- Never mention being outdated.
- If web search results are provided, prioritize them for recent or factual questions.
- If the answer is uncertain, say so honestly instead of hallucinating.

${searchContent}
`,
            },

            ...formattedMessages,
          ],
        }),
      }
    );

    const data = await response.json();

    console.log(
      JSON.stringify(data, null, 2)
    );

    if (data.error) {
      return res.status(500).json({
        reply: data.error.message,
      });
    }

    const reply =
      data.choices[0].message.content;

    res.json({
      reply,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      reply: 'صار خطأ بالسيرفر',
    });
  }
});

const PORT =
  process.env.PORT || 5000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(
    `🚀 Server running on port ${PORT}`
  );
});