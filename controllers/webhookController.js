import Stripe from "stripe";
import { User } from "../models/User.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const getCustomerId = (customer) => {
  if (!customer) return null;

  return typeof customer === "string"
    ? customer
    : customer.id || null;
};

const findUserForSubscription = async (subscription) => {
  const userId = subscription.metadata?.userId;

  if (userId) {
    const user = await User.findById(userId);

    if (user) {
      return user;
    }
  }

  const customerId = getCustomerId(subscription.customer);

  if (!customerId) {
    return null;
  }

  return User.findOne({
    stripeCustomerId: customerId,
  });
};

const syncUserSubscription = async (subscription) => {
  const user = await findUserForSubscription(subscription);

  if (!user) {
    console.error(
      `No user found for Stripe subscription: ${subscription.id}`
    );
    return null;
  }

  const customerId = getCustomerId(subscription.customer);

  const priceId =
    subscription.items?.data?.[0]?.price?.id || null;

  const planEndsAt = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000)
    : null;

  user.stripeCustomerId = customerId;
  user.stripeSubscriptionId = subscription.id;
  user.stripePriceId = priceId;

  if (
    subscription.status === "active" ||
    subscription.status === "trialing"
  ) {
    user.plan = "PRO";
    user.planEndsAt = planEndsAt;

    console.log(
      `User ${user._id} upgraded to PRO`
    );
  } else if (
    subscription.status === "canceled" ||
    subscription.status === "unpaid" ||
    subscription.status === "incomplete_expired"
  ) {
    user.plan = "FREE";
    user.planEndsAt = null;

    console.log(
      `User ${user._id} downgraded to FREE`
    );
  } else {
    console.log(
      `User ${user._id} subscription status: ${subscription.status}`
    );
  }

  await user.save();

  return user;
};

export const handleStripeWebhook = async (req, res) => {
  const signature = req.headers["stripe-signature"];

  if (!signature) {
    console.error("Stripe webhook signature missing");

    return res.status(400).json({
      success: false,
      error: "Stripe signature missing.",
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
      "Stripe webhook signature verification failed:",
      error.message
    );

    return res.status(400).json({
      success: false,
      error: `Webhook Error: ${error.message}`,
    });
  }

  console.log(`Stripe event received: ${event.type}`);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;

        if (session.mode !== "subscription") {
          return res.status(200).json({
            received: true,
          });
        }

        const userId = session.metadata?.userId;
        const subscriptionId = session.subscription;

        console.log(
          `Checkout completed. userId: ${userId}, subscriptionId: ${subscriptionId}`
        );

        if (!userId) {
          console.error(
            "checkout.session.completed: userId missing from metadata"
          );

          return res.status(200).json({
            received: true,
          });
        }

        if (!subscriptionId) {
          console.error(
            "checkout.session.completed: subscription ID missing"
          );

          return res.status(200).json({
            received: true,
          });
        }

        const subscription =
          await stripe.subscriptions.retrieve(
            subscriptionId
          );

        if (!subscription.metadata?.userId) {
          subscription.metadata = {
            ...subscription.metadata,
            userId,
          };
        }

        const user = await User.findById(userId);

        if (!user) {
          console.error(
            `checkout.session.completed: User not found: ${userId}`
          );

          return res.status(200).json({
            received: true,
          });
        }

        const customerId =
          getCustomerId(subscription.customer);

        const priceId =
          subscription.items?.data?.[0]?.price?.id || null;

        const planEndsAt =
          subscription.current_period_end
            ? new Date(
                subscription.current_period_end * 1000
              )
            : null;

        user.stripeCustomerId = customerId;
        user.stripeSubscriptionId = subscription.id;
        user.stripePriceId = priceId;

        if (
          subscription.status === "active" ||
          subscription.status === "trialing"
        ) {
          user.plan = "PRO";
          user.planEndsAt = planEndsAt;

          console.log(
            `User ${user._id} upgraded to PRO`
          );
        } else {
          console.log(
            `Subscription created but status is ${subscription.status}`
          );
        }

        await user.save();

        return res.status(200).json({
          received: true,
        });
      }

      case "customer.subscription.created": {
        const subscription = event.data.object;

        console.log(
          `Subscription created: ${subscription.id}`
        );

        await syncUserSubscription(subscription);

        return res.status(200).json({
          received: true,
        });
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object;

        console.log(
          `Subscription updated: ${subscription.id}`
        );

        await syncUserSubscription(subscription);

        return res.status(200).json({
          received: true,
        });
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object;

        const user =
          await findUserForSubscription(subscription);

        if (!user) {
          console.error(
            `Subscription deleted: User not found for ${subscription.id}`
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
          `User ${user._id} downgraded to FREE because subscription was deleted`
        );

        return res.status(200).json({
          received: true,
        });
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;

        const customerId =
          getCustomerId(invoice.customer);

        if (!customerId) {
          return res.status(200).json({
            received: true,
          });
        }

        const user = await User.findOne({
          stripeCustomerId: customerId,
        });

        if (!user) {
          console.error(
            `Payment failed: User not found for customer ${customerId}`
          );

          return res.status(200).json({
            received: true,
          });
        }

        console.log(
          `Payment failed for user ${user._id}`
        );

        return res.status(200).json({
          received: true,
        });
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object;

        const customerId =
          getCustomerId(invoice.customer);

        if (!customerId) {
          return res.status(200).json({
            received: true,
          });
        }

        const user = await User.findOne({
          stripeCustomerId: customerId,
        });

        if (!user) {
          console.error(
            `Payment succeeded: User not found for customer ${customerId}`
          );

          return res.status(200).json({
            received: true,
          });
        }

        console.log(
          `Payment succeeded for user ${user._id}`
        );

        return res.status(200).json({
          received: true,
        });
      }

      default: {
        console.log(
          `Unhandled Stripe event: ${event.type}`
        );

        return res.status(200).json({
          received: true,
        });
      }
    }
  } catch (error) {
    console.error(
      "Stripe webhook processing error:",
      error
    );

    return res.status(500).json({
      success: false,
      error: "Webhook processing failed.",
    });
  }
};