export default function handler(req, res) {
  return res.status(200).json({
    ok: true,
    app: "StockLensBooji",
    version: "2026-10-17-v5",
    model: "gemini-3.8-flash",
    note: "This endpoint checks deployment only; it does not call Gemini or external news sources."
  });
}
