import Stripe from 'stripe';

import { User } from '../models/User.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const createCheckoutSession = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found.',
      });
    }

    if (user.plan === 'PRO') {
      return res.status(400).json({
        success: false,
        error: 'You are already subscribed to the Pro plan.',
      });
    }
    let customerId = user.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        name: user.name,
        email: user.email,
        metadata: {
          userId: user._id.toString(),
        },
      });

      customerId = customer.id;

      user.stripeCustomerId = customerId;
      await user.save();
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',

      customer: customerId,

      line_items: [
        {
          price: process.env.STRIPE_PRO_PRICE_ID,
          quantity: 1,
        },
      ],

      success_url: `${process.env.CLIENT_URL}/pricing?success=true`,
      cancel_url: `${process.env.CLIENT_URL}/pricing?canceled=true`,

      metadata: {
        userId: user._id.toString(),
      },

      subscription_data: {
        metadata: {
          userId: user._id.toString(),
        },
      },
    });

    return res.status(200).json({
      success: true,
      checkoutUrl: session.url,
      sessionId: session.id,
    });
  } catch (error) {
    console.error('Stripe Checkout Error:', error);

    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};