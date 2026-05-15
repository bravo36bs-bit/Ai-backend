require('dotenv').config();

const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('AI Backend Running 🚀');
});

app.post('/chat', async (req, res) => {
  try {
    const { message } = req.body;

    const response = await fetch(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [
            {
              role: 'user',
              content: message,
            },
          ],
        }),
      }
    );

    const data = await response.json();

    console.log(JSON.stringify(data, null, 2));

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
  console.log('🚀 Server running on port 5000');
});