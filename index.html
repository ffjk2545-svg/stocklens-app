export default async function handler(req, res) {
    // อนุญาตเฉพาะการส่งข้อมูลแบบ POST เท่านั้น
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // ดึง API Key จากที่ซ่อนตู้เซฟของ Vercel (ปลอดภัย ไม่โชว์ในหน้าเว็บ)
    const API_KEY = process.env.GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${API_KEY}`;

    try {
        // ส่งข้อมูลที่ User ค้นหาต่อไปยัง Google Gemini
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body)
        });

        if (!response.ok) {
            throw new Error(`Gemini API Error: ${response.status}`);
        }

        const data = await response.json();
        
        // ส่งผลวิเคราะห์กลับไปให้หน้าเว็บ
        res.status(200).json(data);
    } catch (error) {
        console.error("Backend Error:", error);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์ตัวกลาง' });
    }
}
