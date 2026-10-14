export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({
    ok: true,
    service: "StockLensBooji API",
    version: "2026-10-15-fix-1",
    model: "gemini-3.8-flash"
  });
}
