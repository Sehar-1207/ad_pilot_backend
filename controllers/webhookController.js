import Stripe from "stripe";
import { User } from "../models/User.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const getCustomerId = (customer) => {
  if (!customer) return null;

  return typeof customer === "string"
    ? customer
    : customer.id || null;
};

const getPriceId = (subscription) => {
  return subscription.items?.data?.[0]?.price?.id || null;
};

const getPlanEndsAt = (subscription) => {
  const currentPeriodEnd =
    subscription.current_period_end ??
    subscription.items?.data?.[0]?.current_period_end ??
    null;

  return currentPeriodEnd
    ? new Date(currentPeriodEnd * 1000)
    : null;
};

const findUserForSubscription = async (subscription) => {
  const userId = subscription.metadata?.userId;

  // First try metadata
  if (userId) {
    const user = await User.findById(userId);

    if (user) {
      return user;
    }
  }

  // Fallback to Stripe customer ID
  const customerId = getCustomerId(subscription.customer);

  if (!customerId) {
    return null;
  }

  return await User.findOne({
    stripeCustomerId: customerId,
  });
};

const syncUserSubscription = async (subscription) => {
  try {
    const user = await findUserForSubscription(subscription);

    if (!user) {
      console.error(
        ` User not found for subscription ${subscription.id}`
      );
      return null;
    }

    const customerId = getCustomerId(subscription.customer);
    const priceId = getPriceId(subscription);
    const planEndsAt = getPlanEndsAt(subscription);

    user.stripeCustomerId = customerId;
    user.stripeSubscriptionId = subscription.id;
    user.stripePriceId = priceId;

    if (
      subscription.status === "active" ||
      subscription.status === "trialing"
    ) {
      user.plan = "PRO";
      user.planEndsAt = planEndsAt;

      await user.save();

      console.log(
        `Subscription synced: ${user._id} → PRO`
      );

      return user;
    }

    if (
      subscription.status === "canceled" ||
      subscription.status === "unpaid" ||
      subscription.status === "incomplete_expired"
    ) {
      user.plan = "FREE";
      user.planEndsAt = null;
      user.stripeSubscriptionId = null;
      user.stripePriceId = null;

      await user.save();

      console.log(
        ` Subscription ended: ${user._id} → FREE`
      );

      return user;
    }

    await user.save();

    console.log(
      ` Subscription synced: ${user._id} (${subscription.status})`
    );

    return user;
  } catch (error) {
    console.error(
      ` Subscription sync failed: ${error.message}`
    );

    throw error;
  }
};
export const handleStripeWebhook = async (req, res) => {
  const signature = req.headers["stripe-signature"];

  if (!signature) {
    console.error(" Stripe signature missing");

    return res.status(400).json({
      success: false,
      error: "Stripe signature missing",
    });
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error(" Stripe webhook secret missing");

    return res.status(500).json({
      success: false,
      error: "Stripe webhook secret is not configured",
    });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (error) {
    console.error(
      ` Webhook signature verification failed: ${error.message}`
    );

    return res.status(400).json({
      success: false,
      error: `Webhook Error: ${error.message}`,
    });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;

        // Only handle subscription checkout
        if (session.mode !== "subscription") {
          return res.status(200).json({
            received: true,
          });
        }

        const userId = session.metadata?.userId;
        const subscriptionId = session.subscription;

        if (!userId || !subscriptionId) {
          console.error(
            " Checkout session missing userId or subscriptionId"
          );

          return res.status(200).json({
            received: true,
          });
        }

        const user = await User.findById(userId);

        if (!user) {
          console.error(
            ` User not found: ${userId}`
          );

          return res.status(200).json({
            received: true,
          });
        }

        const subscription =
          await stripe.subscriptions.retrieve(
            subscriptionId
          );

        const customerId =
          getCustomerId(subscription.customer);

        const priceId =
          getPriceId(subscription);

        const planEndsAt =
          getPlanEndsAt(subscription);

        user.stripeCustomerId = customerId;
        user.stripeSubscriptionId =
          subscription.id;
        user.stripePriceId = priceId;

        if (
          subscription.status === "active" ||
          subscription.status === "trialing"
        ) {
          user.plan = "PRO";
          user.planEndsAt = planEndsAt;

          await user.save();

          console.log(
            ` Payment successful: ${user._id} → PRO`
          );
        } else {
          await user.save();

          console.error(
            ` Subscription not active: ${subscription.status}`
          );
        }

        return res.status(200).json({
          received: true,
          success: true,
        });
      }

      case "customer.subscription.created": {
        const subscription = event.data.object;

        await syncUserSubscription(subscription);

        return res.status(200).json({
          received: true,
          success: true,
        });
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object;

        await syncUserSubscription(subscription);

        return res.status(200).json({
          received: true,
          success: true,
        });
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object;

        const user =
          await findUserForSubscription(subscription);

        if (!user) {
          console.error(
            ` User not found for deleted subscription: ${subscription.id}`
          );

          return res.status(200).json({
            received: true,
          });
        }

        user.plan = "FREE";
        user.planEndsAt = null;
        user.stripeSubscriptionId = null;
        user.stripePriceId = null;

        await user.save();

        console.log(
          ` Subscription ended: ${user._id} → FREE`
        );

        return res.status(200).json({
          received: true,
          success: true,
        });
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object;

        if (!invoice.subscription) {
          return res.status(200).json({
            received: true,
          });
        }

        const subscription =
          await stripe.subscriptions.retrieve(
            invoice.subscription
          );

        await syncUserSubscription(subscription);

        return res.status(200).json({
          received: true,
          success: true,
        });
      }

  
      case "invoice.payment_failed": {
        const invoice = event.data.object;

        console.error(
          ` Invoice payment failed: ${invoice.id}`
        );

        return res.status(200).json({
          received: true,
          success: true,
        });
      }

      default:
        return res.status(200).json({
          received: true,
        });
    }
  } catch (error) {
    console.error(
      `Webhook processing failed: ${error.message}`
    );

    return res.status(500).json({
      success: false,
      error: "Webhook processing failed",
    });
  }
};