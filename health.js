export default function handler(req, res) {
  return res.status(200).json({
    ok: true,
    app: "StockLensBooji",
    version: "2026-10-15-v3",
    model: process.env.GEMINI_MODEL || "gemini-3.8-flash",
    note: "This endpoint checks deployment only; it does not call the Gemini API."
  });
}
