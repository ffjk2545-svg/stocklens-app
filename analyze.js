export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "ไม่พบ GEMINI_API_KEY ใน Vercel Environment Variables กรุณาตั้งค่าแล้ว Deploy ใหม่"
    });
  }

  if (!req.body || !Array.isArray(req.body.contents)) {
    return res.status(400).json({
      error: "รูปแบบคำขอไม่ถูกต้อง: ต้องมี contents เป็น array"
    });
  }

  // Use a currently documented stable model and the Gemini REST v1beta endpoint.
  const model = "gemini-3.8-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  try {
    const requestBody = {
      ...req.body,
      generationConfig: {
        ...(req.body.generationConfig || {}),
        responseMimeType: "application/json",
        temperature: 0.2
      }
    };

    const googleResponse = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify(requestBody)
    });

    const data = await googleResponse.json().catch(() => ({}));

    if (!googleResponse.ok) {
      console.error("Gemini API error:", {
        status: googleResponse.status,
        message: data.error?.message
      });
      const status = googleResponse.status === 429 ? 429
        : googleResponse.status >= 500 ? 502
        : 400;
      return res.status(status).json({
        error: `Gemini API (${googleResponse.status}): ${data.error?.message || "Google ไม่สามารถประมวลผลคำขอได้"}`
      });
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error("Backend error:", error);
    return res.status(500).json({
      error: "เกิดข้อผิดพลาดบนเซิร์ฟเวอร์ขณะเรียก Gemini API"
    });
  }
}
