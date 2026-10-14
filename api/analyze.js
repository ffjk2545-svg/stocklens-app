export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const API_KEY = process.env.GEMINI_API_KEY;
    
    if (!API_KEY) {
        return res.status(400).json({ 
            error: "Vercel แจ้งว่า: ไม่พบ API Key (กรุณาเช็ค Environment Variables และกด Redeploy อีกครั้ง)" 
        });
    }

    // 💡 ใช้ URL และชื่อโมเดลมาตรฐานที่รองรับกับระบบ Serverless ของ Vercel อย่างถูกต้อง
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body)
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("Google Error:", data);
            return res.status(400).json({ 
                error: `Google API ปฏิเสธ: ${data.error?.message || 'ข้อผิดพลาดที่ไม่รู้จัก'}` 
            });
        }

        res.status(200).json(data);

    } catch (error) {
        console.error("Backend Error:", error);
        res.status(500).json({ error: `เซิร์ฟเวอร์ล่ม: ${error.message}` });
    }
}
