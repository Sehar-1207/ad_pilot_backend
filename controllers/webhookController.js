import Stripe from 'stripe';
import { User } from '../models/User.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const handleStripeWebhook = async (req, res) => {
  const signature = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    console.error('Stripe webhook signature verification failed:', error.message);

    return res.status(400).json({ success: false, error: `Webhook Error: ${error.message}`, });
  }

  console.log(`Stripe event received: ${event.type}`);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        if (session.mode !== 'subscription') {
          break;
        }

        const userId = session.metadata?.userId;

        if (!userId) {
          console.error('No userId found in checkout session metadata.');
          break;
        }

        if (!session.subscription) {
          console.error('No subscription ID found in checkout session.');
          break;
        }
        const subscription = await stripe.subscriptions.retrieve(session.subscription);
        const user = await User.findById(userId);

        if (!user) {
          console.error(`User not found: ${userId}`);
          break;
        }

        const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
        const priceId = subscription.items.data[0]?.price?.id || null;
        const planEndsAt = subscription.current_period_end ? new Date(subscription.current_period_end * 1000) : null;

        user.plan = 'PRO';
        user.stripeCustomerId = customerId;
        user.stripeSubscriptionId = subscription.id;
        user.stripePriceId = priceId;
        user.planEndsAt = planEndsAt;
        await user.save();
        console.log(`User ${user._id} upgraded to PRO`);

        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        let user = null;
        const userId = subscription.metadata?.userId;

        if (userId) {
          user = await User.findById(userId);
        }

        if (!user) {
          const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
          user = await User.findOne({ stripeCustomerId: customerId, });
        }

        if (!user) {
          console.error(`User not found for subscription ${subscription.id}`);
          break;
        }

        const priceId = subscription.items.data[0]?.price?.id || null;
        const planEndsAt = subscription.current_period_end ? new Date(subscription.current_period_end * 1000) : null;

        if (subscription.status === 'active' || subscription.status === 'trialing') {
          user.plan = 'PRO';
          user.planEndsAt = planEndsAt;
        }

        if (subscription.status === 'canceled' || subscription.status === 'unpaid' || subscription.status === 'incomplete_expired') {
          user.plan = 'FREE';
          user.planEndsAt = null;
        }

        user.stripeSubscriptionId = subscription.id;
        user.stripePriceId = priceId;
        await user.save();
        console.log(`Subscription updated for user ${user._id}`);

        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        let user = null;
        const userId = subscription.metadata?.userId;

        if (userId) {
          user = await User.findById(userId);
        }

        if (!user) {
          const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
          user = await User.findOne({ stripeCustomerId: customerId, });
        }

        if (!user) {
          console.error(`User not found for deleted subscription ${subscription.id}`);
          break;
        }
        user.plan = 'FREE';
        user.planEndsAt = null;
        user.stripeSubscriptionId = null;
        user.stripePriceId = null;
        await user.save();
        console.log(`User ${user._id} downgraded to FREE`);

        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
        if (!customerId) { break; }
        const user = await User.findOne({ stripeCustomerId: customerId, });

        if (!user) {
          console.error(`User not found for failed payment. Customer: ${customerId}`);
          break;
        }
        console.log(`Payment failed for user ${user._id}`);
        break;
      }
      default:
        console.log(`Unhandled Stripe event: ${event.type}`);
    }
    return res.status(200).json({ received: true, });

  } catch (error) {
    console.error('Stripe webhook processing error:', error);
    return res.status(500).json({ success: false, error: 'Webhook processing failed.', });
  }
};