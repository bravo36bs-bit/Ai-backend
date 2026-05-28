require('dotenv').config();

const express = require('express');
const cors = require('cors');

const fetch =
  require('node-fetch').default;

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Nova AI Backend Running 🚀');
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

    if (
      !messages ||
      !Array.isArray(messages)
    ) {
      return res.status(400).json({
        reply: 'Invalid messages',
      });
    }

    const latestMessage =
      messages[messages.length - 1]
        ?.text || '';

    // كلمات البحث
    const searchKeywords = [
      'song',
  'music',
  'movie',
  'film',
  'actor',
  'artist',
  'album',
  'series',
  'netflix',

  'اغنية',
  'موسيقى',
  'فلم',
  'فيلم',
  'مسلسل',
  'ممثل',
  'مطرب',
  'مغني',
  'اغاني',
  'أفلام',

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
      'update',
      'updates',
      'breaking',
      'live',

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
      'ترندات',
      'جديد',
      'تحديث',
      'تحديثات',
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
      try {
        const searchResponse =
          await fetch(
            'https://api.tavily.com/search',
            {
              method: 'POST',

              headers: {
                'Content-Type':
                  'application/json',
              },

              body: JSON.stringify({
                api_key:
                  process.env
                    .TAVILY_API_KEY,

                query: latestMessage,

                search_depth:
                  'advanced',

                max_results: 5,
              }),
            }
          );

        const searchResult =
          await searchResponse.json();

        searchContent =
          searchResult.results
            ?.map(
              item =>
                `Source: ${item.url}\n${item.content}`
            )
            .join('\n\n');
      } catch (searchError) {
        console.log(
          'Search Error:',
          searchError
        );
      }
    }

    // تحويل الرسائل
   const formattedMessages = [];

messages.forEach(msg => {

  formattedMessages.push({
    role:
      msg.role === 'assistant'
        ? 'assistant'
        : 'user',

    content: msg.text,
  });

});

    // طلب الذكاء الاصطناعي
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
            'openai/gpt-oss-120b',

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
- Avoid robotic wording.
- Avoid repeating yourself.
- Avoid unnecessary long paragraphs.
- Answer directly and clearly.
- Use polished and correct Arabic.
- Use natural Iraqi Arabic casually when appropriate.
- Keep English professional and natural.
- Maintain clean spelling and grammar.
- Never mention being outdated.
- If uncertain, admit uncertainty instead of inventing information.
- Do not hallucinate facts.
- Never guess song names.
- Never guess movie names.
- Never invent artists.
- If uncertain, say you are not sure.
- Accuracy is more important than sounding confident.
- Never create fake recommendations.
- If the user asks for a specific song/movie/person, answer only if confident.
- If the question is casual, answer casually.
- If the question is technical, answer professionally.
- Keep the conversation engaging and human-like.
- Prioritize clarity and usefulness.

Web Search Rules:

- If web search results are provided, prioritize them for factual or recent information.
- Use web results intelligently, not blindly.
- If the user asks about recent events, updates, trends, news, or current information, rely on web search data.
- Never invent recent information without web results.

Web Search Results:
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
      data.choices?.[0]?.message
        ?.content ||
      'Something went wrong.';

      const memoryResponse = await fetch(
  'https://api.groq.com/openai/v1/chat/completions',
  {
    method: 'POST',

    headers: {
      Authorization:
        `Bearer ${process.env.GROQ_API_KEY}`,

      'Content-Type':
        'application/json',
    },

    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',

      temperature: 0.2,

      max_tokens: 120,

      messages: [
        {
          role: 'system',

          content: `
Update the user's long-term memory.

Rules:
- Keep memory short.
- Save only important facts.
- Save preferences.
- Save emotional patterns.
- Ignore casual talk.
- Return ONLY the memory text.
`,
        },

        {
          role: 'user',

          content: `
Current memory:
${messages.memory || ''}

User message:
${latestMessage}

Assistant reply:
${reply}
`,
        },
      ],
    }),
  }
);


     // ======================
// MEMORY AI UPDATE
// ======================

let updatedMemory = '';

const memoryData =
  await memoryResponse.json();

updatedMemory =
  memoryData.choices?.[0]
    ?.message?.content || '';


try {

  // استخراج الميموري الحالية

  const memoryMatch =
    latestMessage.match(
      /Memory:\s*([\s\S]*?)\nRecent conversation:/i
    );

  const currentMemory =
    memoryMatch?.[1] || '';

  // استخراج اخر رسالة مستخدم

  const userMatch =
    latestMessage.match(
      /New message:\s*([\s\S]*)/i
    );

  const userMessage =
    userMatch?.[1] || '';

  const memoryPrompt = `
Current memory:
${currentMemory}

User message:
${userMessage}

Nova reply:
${reply}

Update the memory.

Rules:

- Keep ONLY important long-term information.
- Keep personality traits.
- Keep emotional behavior.
- Keep relationships.
- Keep preferences.
- Remove temporary details.
- Remove repetitive information.
- Keep memory short and clean.
- Maximum 15 lines.
- Return ONLY the updated memory text.
`;

  const memoryResponse =
    await fetch(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        method: 'POST',

        headers: {
          Authorization:
            `Bearer ${process.env.GROQ_API_KEY}`,

          'Content-Type':
            'application/json',
        },

        body: JSON.stringify({
          model:
            'openai/gpt-oss-120b',

          temperature: 0.3,

          max_tokens: 300,

          messages: [
            {
              role: 'user',
              content:
                memoryPrompt,
            },
          ],
        }),
      }
    );

  const memoryData =
    await memoryResponse.json();

  updatedMemory =
    memoryData.choices?.[0]
      ?.message?.content || '';

} catch (memoryError) {

  console.log(
    'Memory Error:',
    memoryError
  );

        
        }


   res.json({
  reply,
  memory:
    updatedMemory,
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
    `🚀 Nova server running on port ${PORT}`
  );
});