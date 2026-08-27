import express from 'express';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';

const router = express.Router();

router.get('/facebook', (req, res) => {
  const metaAuthUrl = `https://www.facebook.com/v22.0/dialog/oauth?` +
    `client_id=${process.env.META_APP_ID}` +
    `&redirect_uri=${encodeURIComponent(process.env.META_REDIRECT_URI)}` +
    `&scope=email,public_profile` +
    `&response_type=code`;

  res.redirect(metaAuthUrl);
});

router.get('/facebook/callback', async (req, res) => {
  const { code, error } = req.query;

  if (error || !code) {
    return res.redirect(`${process.env.CLIENT_URL}/login?error=facebook_access_denied`);
  }

  try {
    const tokenResponse = await axios.get('https://graph.facebook.com/v22.0/oauth/access_token', {
      params: {
        client_id: process.env.META_APP_ID,
        client_secret: process.env.META_APP_SECRET,
        redirect_uri: process.env.META_REDIRECT_URI,
        code,
      },
    });

    const { access_token } = tokenResponse.data;

    const profileResponse = await axios.get('https://graph.facebook.com/v22.0/me', {
      params: {
        fields: 'id,name,email',
        access_token,
      },
    });

    const profile = profileResponse.data;

    if (!profile.id) {
      return res.redirect(`${process.env.CLIENT_URL}/login?error=profile_fetch_failed`);
    }

    const email = profile.email || `${profile.id}@facebook.user`;

    let user = await User.findOne({ $or: [{ email }, { metaUserId: profile.id }] });

    if (!user) {
      const isAdminEmail =
        process.env.ADMIN_EMAIL &&
        email.toLowerCase() === process.env.ADMIN_EMAIL.toLowerCase();

      user = await User.create({
        name: profile.name,
        email,
        passwordHash: 'OAUTH_USER_NO_PASSWORD',
        role: isAdminEmail ? 'ADMIN' : 'USER',
        metaUserId: profile.id,
        isMetaConnected: true,
      });
    } else if (!user.metaUserId) {
      user.metaUserId = profile.id;
      user.isMetaConnected = true;
    }

    user.lastLoginAt = new Date();
    await user.save();

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    return res.redirect(`${process.env.CLIENT_URL}/auth/callback?token=${token}`);
  } catch (err) {
    console.error('Facebook Auth Error:', err.response?.data || err.message);
    return res.redirect(`${process.env.CLIENT_URL}/login?error=server_error`);
  }
});

export default router;