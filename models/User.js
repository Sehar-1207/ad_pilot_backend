import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    // Profile Credentials
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    avatarUrl: { type: String, default: null },
    role: { type: String, enum: ['USER', 'ADMIN'], default: 'USER' },

    // Subscription & Pricing Tier
    plan: { type: String, enum: ['FREE', 'PRO'], default: 'FREE' },
    stripeCustomerId: { type: String, default: null },
    stripeSubscriptionId: { type: String, default: null },
    stripePriceId: { type: String, default: null },
    planEndsAt: { type: Date, default: null },

    // Meta Ads Integration
    metaUserId: { type: String, default: null },
    metaAccessToken: { type: String, default: null }, 
    metaAdAccountId: { type: String, default: null }, 
    metaAdAccountName: { type: String, default: null },
    metaTokenExpiresAt: { type: Date, default: null },
    isMetaConnected: { type: Boolean, default: false },

    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true }
);

userSchema.index({ plan: 1, role: 1 });

export const User = mongoose.model('User', userSchema);