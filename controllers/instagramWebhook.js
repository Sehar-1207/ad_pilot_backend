export const verifyInstagramWebhook = (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  const expectedToken = process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN;

  if (!expectedToken) {
    console.error("INSTAGRAM_WEBHOOK_VERIFY_TOKEN is not set in this environment");
    return res.sendStatus(500);
  }

  if (mode === "subscribe" && token === expectedToken) {
    return res.status(200).send(challenge);
  }

  console.error("Instagram webhook verification failed", {
    mode,
    receivedToken: token,
    expectedTokenSet: Boolean(expectedToken),
  });

  return res.sendStatus(403);
};

export const handleInstagramWebhook = (req, res) => {
  console.log("Instagram webhook event:", JSON.stringify(req.body, null, 2));
  return res.sendStatus(200);
};
