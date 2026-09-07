export const requirePro = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      code: "AUTH_REQUIRED",
      message: "Authentication required.",
    });
  }

  if (req.user.plan !== "PRO") {
    return res.status(403).json({
      success: false,
      code: "PRO_REQUIRED",
      message: "This feature is available on the Pro plan.",
    });
  }

  next();
};