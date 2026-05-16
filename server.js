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

app.post('/chat', async (req, res) => {
  try {
    const { message } = req.body;

    // هل يحتاج بحث؟
    const needsSearch = [
      '2024',
      '2025',
      '2026',
      'اليوم',
      'حاليا',
      'حالياً',
      'آخر',
      'احدث',
      'أحدث',
      'news',
      'latest',
    ].some((word) =>
      message.includes(word)
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

            query: message,

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

    // إرسال الرسالة للـ AI
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
            'llama-3.3-70b-versatile',

          messages: [
            {
              role: 'system',

              content: `
أنت مساعد ذكي اسمك Nova.

إذا توفرت نتائج بحث استخدمها للإجابة بمعلومات حديثة ودقيقة.

نتائج البحث:
${searchContent}
              `,
            },

            {
              role: 'user',
              content: message,
            },
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

app.listen(5000, '0.0.0.0', () => {
  console.log(
    '🚀 Server running on port 5000'
  );
});