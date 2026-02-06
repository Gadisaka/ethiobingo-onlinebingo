import mongoose from "mongoose";

const cashierSubscriptionSchema = new mongoose.Schema(
  {
    // The player who subscribed
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // The cashier being subscribed to
    cashierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Status of subscription
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Compound unique index to prevent duplicate subscriptions
cashierSubscriptionSchema.index({ userId: 1, cashierId: 1 }, { unique: true });

const CashierSubscription = mongoose.model("CashierSubscription", cashierSubscriptionSchema);
export default CashierSubscription;

