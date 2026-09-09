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

    const stripePriceId = process.env.STRIPE_PRO_PLAN_PRICE_ID;

    if (!stripePriceId) {
      return res.status(500).json({
        success: false,
        error: 'Stripe Pro Price ID is not configured.',
      });
    }

    if (!stripePriceId.startsWith('price_')) {
      return res.status(500).json({
        success: false,
        error: 'Invalid Stripe Pro Price ID configuration.',
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
          price: stripePriceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.CLIENT_URL}/dashboard`,
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
export const cancelMySubscription = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found.",
      });
    }

    if (!user.stripeSubscriptionId) {
      return res.status(400).json({
        success: false,
        error: "You do not have an active subscription.",
      });
    }

    const subscription = await stripe.subscriptions.retrieve(
      user.stripeSubscriptionId
    );

    if (subscription.cancel_at_period_end) {
      return res.status(400).json({
        success: false,
        error: "Your subscription is already scheduled for cancellation.",
      });
    }

    const updatedSubscription = await stripe.subscriptions.update(
      user.stripeSubscriptionId,
      {
        cancel_at_period_end: true,
      }
    );

    return res.status(200).json({
      success: true,
      message:
        "Your subscription will be canceled at the end of the current billing period.",
      data: {
        cancelAtPeriodEnd: updatedSubscription.cancel_at_period_end,
        currentPeriodEnd: updatedSubscription.current_period_end
          ? new Date(updatedSubscription.current_period_end * 1000)
          : null,
      },
    });
  } catch (error) {
    console.error("Cancel Subscription Error:", error);

    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

export const retryMySubscriptionPayment = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found.",
      });
    }

    if (!user.stripeSubscriptionId) {
      return res.status(400).json({
        success: false,
        error: "You do not have a Stripe subscription.",
      });
    }

    const subscription = await stripe.subscriptions.retrieve(
      user.stripeSubscriptionId
    );

    const latestInvoiceId = subscription.latest_invoice;

    if (!latestInvoiceId) {
      return res.status(400).json({
        success: false,
        error: "No payment invoice found for this subscription.",
      });
    }

    const invoice = await stripe.invoices.retrieve(latestInvoiceId);

    if (invoice.status === "paid") {
      return res.status(400).json({
        success: false,
        error: "The latest invoice has already been paid.",
      });
    }

    if (invoice.status !== "open") {
      return res.status(400).json({
        success: false,
        error: `Invoice cannot be paid because its status is ${invoice.status}.`,
      });
    }

    const paidInvoice = await stripe.invoices.pay(invoice.id);

    return res.status(200).json({
      success: true,
      message: "Payment retry initiated successfully.",
      data: {
        invoiceId: paidInvoice.id,
        status: paidInvoice.status,
      },
    });
  } catch (error) {
    console.error("Retry Subscription Payment Error:", error);

    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

export const getMySubscription = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select(
      "plan planEndsAt stripeCustomerId stripeSubscriptionId stripePriceId"
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found.",
      });
    }

    // No Stripe subscription
    if (!user.stripeSubscriptionId) {
      return res.status(200).json({
        success: true,
        data: {
          plan: user.plan,
          status: "free",
          planEndsAt: user.planEndsAt,
          subscriptionId: null,
          cancelAtPeriodEnd: false,
        },
      });
    }

    const subscription = await stripe.subscriptions.retrieve(
      user.stripeSubscriptionId
    );

    return res.status(200).json({
      success: true,
      data: {
        plan: user.plan,
        status: subscription.status,
        planEndsAt: user.planEndsAt,
        subscriptionId: subscription.id,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        currentPeriodEnd: subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000)
          : null,
        priceId: user.stripePriceId,
      },
    });
  } catch (error) {
    console.error("Get My Subscription Error:", error);

    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};