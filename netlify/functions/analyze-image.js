exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Netlify 환경 변수에 GEMINI_API_KEY가 설정되지 않았습니다.' })
      };
    }

    const { imageBase64, mimeType } = JSON.parse(event.body || '{}');

    if (!imageBase64) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: '이미지 데이터가 전달되지 않았습니다.' })
      };
    }

    const promptText = `Analyze this image containing Chinese characters (Hanzi), English, or Korean vocabulary.
Extract all vocabulary words with their pronunciation and meanings.
Output strictly valid JSON array without markdown formatting or code blocks:
[
  {"word": "單字/Word", "pronunciation": "발음/Pinyin", "meaning": "뜻/해설"}
]`;

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: promptText },
            { inlineData: { mimeType: mimeType || 'image/jpeg', data: imageBase64 } }
          ]
        }],
        generationConfig: { responseMimeType: 'application/json' }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: data.error?.message || 'Gemini API 호출에 실패했습니다.' })
      };
    }

    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
    let cleanJson = rawText.trim();
    if (cleanJson.startsWith('```json')) {
      cleanJson = cleanJson.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    const parsedCards = JSON.parse(cleanJson);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsedCards)
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || '서버 오류가 발생했습니다.' })
    };
  }
};
