import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { hashPassword, comparePassword } from '../utils/security.js';

const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

// Helper for formatting public user payload
const formatUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  plan: user.plan,
  isMetaConnected: user.isMetaConnected,
});

// Register New User
export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists.' });
    }

    // Check if registering email matches system admin email
    const isAdminEmail = process.env.ADMIN_EMAIL && 
      email.toLowerCase() === process.env.ADMIN_EMAIL.toLowerCase();

    const role = isAdminEmail ? 'ADMIN' : 'USER';

    const passwordHash = await hashPassword(password);
    const user = await User.create({ name, email, passwordHash, role });

    const token = generateToken(user._id, user.role);

    return res.status(201).json({
      success: true,
      token,
      user: formatUser(user),
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// Login User
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user || !(await comparePassword(password, user.passwordHash))) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    user.lastLoginAt = new Date();
    await user.save();

    // Dynamically uses role stored in DB ('ADMIN' or 'USER')
    const token = generateToken(user._id, user.role);

    return res.json({
      success: true,
      token,
      user: formatUser(user),
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// Get Logged-In User Profile
export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-passwordHash -metaAccessToken');
    if (!user) return res.status(404).json({ error: 'User not found.' });

    return res.json({ success: true, user });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};