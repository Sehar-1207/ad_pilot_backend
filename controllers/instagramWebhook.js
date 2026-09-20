export const verifyInstagramWebhook = (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  const EXPECTED_TOKEN = process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN;

  if (mode === "subscribe" && token === EXPECTED_TOKEN) {
    console.log("Instagram webhook verified successfully");
    return res
      .status(200)
      .set("Content-Type", "text/plain")
      .send(String(challenge));
  }

  console.error("Instagram webhook verification failed:", {
    receivedToken: token,
    expectedToken: EXPECTED_TOKEN,
  });

  return res.sendStatus(403);
};