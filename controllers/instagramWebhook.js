
export const verifyInstagramWebhook = (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  const verifyToken =
    process.env.META_VERIFY_TOKEN ||
    process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN;

  if (mode === "subscribe" && token === verifyToken) {
    console.log("[INSTAGRAM WEBHOOK] Verified successfully");
    return res.status(200).type("text/plain").send(challenge);
  }

  console.error("[INSTAGRAM WEBHOOK] Verification failed. Token mismatch.");
  return res.sendStatus(403);
};

export const handleInstagramWebhook = async (req, res) => {
  try {
    const body = req.body;

    if (body.object === "instagram" || body.object === "page") {
      if (Array.isArray(body.entry)) {
        for (const entry of body.entry) {
          console.log("[INSTAGRAM WEBHOOK EVENT]:", JSON.stringify(entry, null, 2));
        }
      }

      return res.status(200).send("EVENT_RECEIVED");
    }

    return res.sendStatus(404);
  } catch (error) {
    console.error("[INSTAGRAM WEBHOOK ERROR]:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};