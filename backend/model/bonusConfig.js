import mongoose from "mongoose";

const bonusTierSchema = new mongoose.Schema({
  maxCalls: { type: Number, required: true }, // Win within this many calls to get bonus
  amount: { type: Number, required: true },    // Bonus amount in Birr
});

const bonusConfigSchema = new mongoose.Schema(
  {
    cashierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    bonuses: [bonusTierSchema],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Get bonus config for a cashier
bonusConfigSchema.statics.getForCashier = async function (cashierId) {
  return this.findOne({ cashierId });
};

// Calculate bonus amount based on number of calls
bonusConfigSchema.statics.calculateBonus = async function (cashierId, callCount) {
  const config = await this.findOne({ cashierId, isActive: true });
  if (!config || !config.bonuses || config.bonuses.length === 0) {
    return 0;
  }
  
  // Sort bonuses by maxCalls ascending to find the best matching tier
  const sortedBonuses = [...config.bonuses].sort((a, b) => a.maxCalls - b.maxCalls);
  
  // Find the first tier where callCount <= maxCalls
  for (const tier of sortedBonuses) {
    if (callCount <= tier.maxCalls) {
      return tier.amount;
    }
  }
  
  return 0; // No matching tier
};

const BonusConfig = mongoose.model("BonusConfig", bonusConfigSchema);
export default BonusConfig;
