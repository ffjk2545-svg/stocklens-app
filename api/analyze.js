export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const API_KEY = process.env.GEMINI_API_KEY;
    
    // 💡 อัปเกรดเป็นรุ่น Pro สำหรับการวิเคราะห์ขั้นสูง
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${API_KEY}`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(req.body)
        });

        if (!response.ok) {
            const errorInfo = await response.text();
            console.error("Google Error:", errorInfo);
            throw new Error(`Google API Error: ${response.status}`);
        }

        const data = await response.json();
        res.status(200).json(data);

    } catch (error) {
        console.error("Backend Error:", error);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์ตัวกลาง' });
    }
}
