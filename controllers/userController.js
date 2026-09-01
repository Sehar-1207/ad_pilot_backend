import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
import { hashPassword, comparePassword, } from "../utils/security.js";


const generateToken = (id, role) => {
  return jwt.sign({ id, role, }, process.env.JWT_SECRET, { expiresIn: "7d", });
};


const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

const formatUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  plan: user.plan,
  isMetaConnected: user.isMetaConnected,
});


export const register = async (req, res) => {
  try {
    const { name, email, password, } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: "Name, email and password are required.", });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await User.findOne({ email: normalizedEmail, });

    if (existingUser) {
      return res.status(400).json({ success: false, error: "User with this email already exists.", });
    }
    const isAdminEmail = process.env.ADMIN_EMAIL && normalizedEmail === process.env.ADMIN_EMAIL.trim().toLowerCase();

    const role = isAdminEmail ? "ADMIN" : "USER";

    const passwordHash = await hashPassword(password);

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      role,
    });

    const token = generateToken(user._id, user.role);
    res.cookie("token", token, cookieOptions);
    return res.status(201).json({ success: true, user: formatUser(user), });

  } catch (error) {
    console.error("Register Error:", error);
    return res.status(500).json({ success: false, error: error.message || "Registration failed.", });
  }
};


export const login = async (req, res) => {
  try {
    const { email, password, } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: "Email and password are required.", });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail, });

    if (!user) {
      return res.status(401).json({ success: false, error: "Invalid email or password.", });
    }

    const passwordMatch = await comparePassword(password, user.passwordHash);

    if (!passwordMatch) {
      return res.status(401).json({ success: false, error: "Invalid email or password.", });
    }

    user.lastLoginAt = new Date();
    await user.save();
    const token = generateToken(user._id, user.role);
    res.cookie("token", token, cookieOptions);
    return res.json({ success: true, user: formatUser(user), });

  } catch (error) {
    console.error("Login Error:", error);
    return res.status(500).json({ success: false, error: error.message || "Login failed.", });
  }
};

export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-passwordHash -metaAccessToken");

    if (!user) {
      return res.status(404).json({ success: false, error: "User not found.", });
    }
    return res.json({ success: true, user: formatUser(user), });

  } catch (error) {
    console.error("Get Me Error:", error);
    return res.status(500).json({ success: false, error: error.message || "Failed to get user.", });
  }
};

export const logout = async (req, res) => {
  try {
    res.clearCookie("token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    });

    return res.json({ success: true, message: "Logged out successfully.", });

  } catch (error) {
    console.error("Logout Error:", error);
    return res.status(500).json({ success: false, error: error.message || "Logout failed.", });
  }
};