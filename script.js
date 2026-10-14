const getToday = () => {
  const date = new Date();
  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
};

let searchHistory = ["KO", "PTT", "NVDA"];

function renderHistory() {
  const container = document.getElementById("history");
  container.replaceChildren();

  searchHistory.forEach((ticker) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "px-3 py-1 bg-white border border-emerald-300 text-emerald-700 rounded-full text-sm hover:bg-emerald-50 transition";
    button.textContent = `🔍 ${ticker}`;
    button.addEventListener("click", () => {
      document.getElementById("ticker").value = ticker;
      document.getElementById("analyzeBtn").click();
    });
    container.appendChild(button);
  });
}

function escapeHtml(value) {
  return String(value ?? "ไม่มีข้อมูล 😿").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

renderHistory();

const promptTemplate = (ticker, market, timeframe) => `
คุณคือสุดยอดนักวิเคราะห์หุ้นระดับโลก AI Stock Research ชื่อ "StockLens Booji" (คาแรคเตอร์: ฉลาดเฉียบแหลม มั่นใจ อธิบายเก่ง และชอบใส่อิโมจิน่ารักๆ เยอะๆ 🐱✨🚀📉📈💰)
กรุณาวิเคราะห์หุ้น ${ticker} ในตลาด ${market} โดยเน้นข้อมูล ${timeframe}
ข้อบังคับอย่างเคร่งครัด:
1. ใช้ภาษาไทย (Thai Language) ทั้งหมด
2. ห้ามมโนตัวเลขเด็ดขาด หากไม่มีข้อมูลให้เขียนว่า "ไม่มีข้อมูล 😿"
3. ห้ามอ้างว่าราคาหรือข้อมูลเป็นปัจจุบัน/เรียลไทม์ หากไม่ได้ตรวจสอบจากแหล่งข้อมูลสดจริง
4. ตอบกลับมาเป็น JSON Format เท่านั้น โดยมีโครงสร้างดังนี้:
{
  "A_CompanyProfile": "ชื่อบริษัท, ธุรกิจหลัก, รายได้หลัก (อธิบายแบบสนุกๆ)",
  "B_MarketSnapshot": "ราคาล่าสุด, Market Cap, P/E, P/B, Dividend Yield (พร้อมตัวเลขถ้ามี)",
  "C_Financial": "สรุปงบการเงิน รายได้, กำไรสุทธิ แนวโน้มเป็นอย่างไร",
  "D_Valuation": "ความถูกแพงของหุ้นเมื่อเทียบกับคู่แข่งหรืออดีต",
  "E_BoojiInsight": "มุมมองของน้องแมว Booji: Sentiment (Bullish/Bearish), Risk Level (Low/Med/High), Moat (จุดแข็งที่คู่แข่งสู้ยาก)",
  "F_Sources": "แหล่งข้อมูลอ้างอิงที่ใช้จริง และข้อจำกัดของข้อมูล"
}`;

document.getElementById("analyzeBtn").addEventListener("click", async () => {
  const tickerInput = document.getElementById("ticker");
  const ticker = tickerInput.value.trim().toUpperCase();
  const market = document.getElementById("market").value;
  const timeframe = document.getElementById("timeframe").value;

  if (!ticker) {
    alert("ใส่ชื่อหุ้นให้น้องแมวก่อนนะเมี้ยว! 🙀");
    return;
  }
  if (!/^[A-Z0-9.^_-]{1,20}$/.test(ticker)) {
    alert("รูปแบบชื่อหุ้นไม่ถูกต้อง กรุณาใช้ตัวอักษรอังกฤษ ตัวเลข หรือ . ^ _ - เท่านั้น");
    return;
  }

  const btn = document.getElementById("analyzeBtn");
  const btnText = document.getElementById("btnText");
  const loading = document.getElementById("loadingState");
  const report = document.getElementById("reportArea");
  const errorDiv = document.getElementById("errorState");

  btn.disabled = true;
  btn.classList.add("opacity-75");
  btnText.innerHTML = '<span class="spinner"></span> <span class="ml-2">กำลังดมกลิ่นหาข้อมูล... 🐾</span>';
  report.classList.add("hidden");
  errorDiv.classList.add("hidden");
  loading.classList.remove("hidden");

  try {
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptTemplate(ticker, market, timeframe) }] }]
      })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || `Server Error: ${response.status}`);
    }

    const textResult = data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("")
      .trim();

    if (!textResult) {
      const reason = data.promptFeedback?.blockReason;
      throw new Error(reason
        ? `Google ปฏิเสธคำขอ (เหตุผล: ${reason})`
        : "Gemini ไม่ได้ส่งข้อความกลับมา โปรดลองอีกครั้ง");
    }

    const cleanJson = textResult
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();
    const parsedData = JSON.parse(cleanJson);

    if (!searchHistory.includes(ticker)) {
      searchHistory.unshift(ticker);
      if (searchHistory.length > 5) searchHistory.pop();
      renderHistory();
    }

    renderReport(parsedData, ticker);
    loading.classList.add("hidden");
    report.classList.remove("hidden");
  } catch (error) {
    console.error("StockLensBooji error:", error);
    loading.classList.add("hidden");
    errorDiv.classList.remove("hidden");
    document.getElementById("errorText").innerText = `เกิดข้อผิดพลาด: ${error.message}`;
  } finally {
    btn.disabled = false;
    btn.classList.remove("opacity-75");
    btnText.innerHTML = "🪄 ส่องหุ้นเลย! 🐾";
  }
});

function renderReport(data, ticker) {
  const report = document.getElementById("reportArea");
  report.innerHTML = `
    <div class="glass-card p-6 border-t-4 border-emerald-500">
      <h2 class="text-2xl font-bold mb-4 flex items-center gap-2">🏢 A. โปรไฟล์บริษัท (${escapeHtml(ticker)})</h2>
      <p class="text-gray-700 leading-relaxed whitespace-pre-line">${escapeHtml(data.A_CompanyProfile)}</p>
    </div>
    <div class="glass-card p-6 border-t-4 border-blue-500">
      <h2 class="text-2xl font-bold mb-4 flex items-center gap-2">📸 B. ภาพรวมตลาด (Market Snapshot)</h2>
      <p class="text-gray-700 leading-relaxed whitespace-pre-line">${escapeHtml(data.B_MarketSnapshot)}</p>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div class="glass-card p-6 border-t-4 border-purple-500">
        <h2 class="text-xl font-bold mb-4">💰 C. สุขภาพการเงิน (Financials)</h2>
        <p class="text-gray-700 leading-relaxed whitespace-pre-line">${escapeHtml(data.C_Financial)}</p>
      </div>
      <div class="glass-card p-6 border-t-4 border-orange-500">
        <h2 class="text-xl font-bold mb-4">⚖️ D. ความถูกแพง (Valuation)</h2>
        <p class="text-gray-700 leading-relaxed whitespace-pre-line">${escapeHtml(data.D_Valuation)}</p>
      </div>
    </div>
    <div class="glass-card p-6 emerald-gradient text-white">
      <h2 class="text-2xl font-bold mb-4 flex items-center gap-2">🐱✨ E. มุมมองพิเศษจาก Booji (Insight)</h2>
      <p class="text-lg leading-relaxed whitespace-pre-line">${escapeHtml(data.E_BoojiInsight)}</p>
    </div>
    <div class="text-sm text-gray-500 text-right">
      อัปเดตหน้าเว็บเมื่อ: ${getToday()} <br>
      ${escapeHtml(data.F_Sources)}
    </div>
  `;
}
