// StockLens Radar: latest ticker/market headlines via Google News RSS.
// Only headlines, publisher, timestamps and outbound links are exposed; article text is not republished.
function xmlText(value = "") {
  return String(value)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]*>/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}
function tagValue(xml, tag) {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  return xmlText(xml.match(re)?.[1] || "");
}
function parseItems(xml) {
  return [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].map((match) => {
    const item = match[1];
    const title = tagValue(item, "title");
    const rawLink = tagValue(item, "link");
    const source = tagValue(item, "source");
    const pubDate = tagValue(item, "pubDate");
    let link = "";
    try {
      const url = new URL(rawLink);
      if (url.protocol === "https:" || url.protocol === "http:") link = url.toString();
    } catch { /* invalid RSS link */ }
    if (!title || !link) return null;
    let cleanTitle = title;
    if (source) cleanTitle = cleanTitle.replace(/\s+-\s+[^-]+$/, "").trim();
    const time = Date.parse(pubDate);
    return { title: cleanTitle || title, source: source || "แหล่งข่าวต้นทาง", publishedAt: Number.isFinite(time) ? new Date(time).toISOString() : null, link };
  }).filter(Boolean);
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const mode = req.query?.mode === "market" ? "market" : "ticker";
  const market = ["US", "TH", "Other"].includes(req.query?.market) ? req.query.market : "US";
  const rawSymbol = String(req.query?.symbol || "NVDA").toUpperCase().trim();
  const symbol = rawSymbol.includes(":") ? rawSymbol.split(":").pop() : rawSymbol;
  if (mode === "ticker" && !/^[A-Z0-9.^_\-]{1,20}$/.test(symbol)) {
    return res.status(400).json({ error: "Ticker ไม่ถูกต้อง" });
  }

  let query;
  let lang;
  let region;
  if (mode === "market") {
    query = market === "TH"
      ? "ตลาดหุ้นไทย หุ้นเด่น SET เศรษฐกิจ when:1d"
      : "stock market finance markets economy when:1d";
  } else if (market === "TH") {
    query = `"${symbol}" หุ้น OR งบ OR ตลาด when:1d`;
  } else {
    query = `"${symbol}" stock OR shares OR earnings when:1d`;
  }
  if (market === "TH") { lang = "th"; region = "TH"; }
  else { lang = "en-US"; region = "US"; }
  const params = new URLSearchParams({ q: query, hl: lang, gl: region, ceid: `${region}:${lang === "en-US" ? "en" : "th"}` });
  const url = `https://news.google.com/rss/search?${params.toString()}`;

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "StockLensRadar/1.0 (news links and headlines)" },
      signal: AbortSignal.timeout(9000)
    });
    if (!response.ok) {
      console.error("News RSS error", response.status);
      return res.status(502).json({ error: `ฟีดข่าวตอบกลับ ${response.status}` });
    }
    const xml = await response.text();
    const items = parseItems(xml).slice(0, 8);
    res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=1800");
    return res.status(200).json({ ok: true, mode, symbol: mode === "ticker" ? symbol : null, market, provider: "Google News RSS", fetchedAt: new Date().toISOString(), items });
  } catch (error) {
    console.error("News RSS fetch failed", error?.message || error);
    return res.status(502).json({ error: "ดึงข่าวล่าสุดไม่สำเร็จ ลองอีกครั้งหรือเปิดลิงก์ข่าวต้นทาง" });
  }
}
