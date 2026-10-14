
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "ไม่พบ GEMINI_API_KEY ใน Vercel Environment Variables"
    });
  }

  if (!req.body || !Array.isArray(req.body.contents)) {
    return res.status(400).json({
      error: "รูปแบบคำขอไม่ถูกต้อง"
    });
  }

  const model = "gemini-3.8-flash";
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify({
        ...req.body,
        generationConfig: {
          ...(req.body.generationConfig || {}),
          responseMimeType: "application/json",
          temperature: 0.2
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini API error:", data);

      return res.status(
        response.status === 429 ? 429 :
        response.status >= 500 ? 502 : 400
      ).json({
        error: `Gemini API (${response.status}): ${
          data.error?.message || "ไม่สามารถประมวลผลได้"
        }`
      });
    }

    return res.status(200).json(data);

  } catch (error) {
    console.error("Backend error:", error);

    return res.status(500).json({
      error: "เกิดข้อผิดพลาดในการเชื่อมต่อ Gemini API"
    });
  }
}
