export const verifyInstagramWebhook = (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (
    mode === "subscribe" &&
    token === process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN
  ) {
    console.log("Instagram webhook verified successfully");

    return res.status(200).send(challenge);
  }

  console.error("Instagram webhook verification failed");

  return res.sendStatus(403);
};

export const handleInstagramWebhook = (req, res) => {
  console.log(
    "Instagram webhook event:",
    JSON.stringify(req.body, null, 2)
  );

  return res.sendStatus(200);
};