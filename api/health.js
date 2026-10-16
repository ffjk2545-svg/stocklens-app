export default function handler(req, res) {
  return res.status(200).json({
    ok: true,
    app: "StockLens Radar",
    version: "2026-10-17-radar-v1",
    model: "optional analyze endpoint",
    note: "This endpoint checks deployment only; it does not call Gemini or external news sources."
  });
}
