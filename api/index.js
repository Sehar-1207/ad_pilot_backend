import app from "../app.js";
import connectDB from "../config/db.js";

const handler = async (req, res) => {
  try {
    await connectDB();

    return app(req, res);
  } catch (error) {
    console.error("Database connection failed:", error);

    return res.status(500).json({
      success: false,
      error: "Database connection failed",
      message:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Unable to connect to database",
    });
  }
};

export default handler;