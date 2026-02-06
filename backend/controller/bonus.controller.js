import BonusConfig from "../model/bonusConfig.js";

// Get bonus config for a cashier
export const getBonusConfig = async (req, res) => {
  try {
    const { cashierId } = req.params;
    
    if (!cashierId) {
      return res.status(400).json({ message: "Cashier ID is required" });
    }
    
    const config = await BonusConfig.getForCashier(cashierId);
    
    if (!config) {
      return res.json({ 
        cashierId,
        bonuses: [],
        isActive: true 
      });
    }
    
    res.json(config);
  } catch (error) {
    console.error("Error fetching bonus config:", error);
    res.status(500).json({ message: "Failed to fetch bonus config" });
  }
};

// Update or create bonus config for a cashier
export const updateBonusConfig = async (req, res) => {
  try {
    const { cashierId } = req.params;
    const { bonuses, isActive } = req.body;
    
    if (!cashierId) {
      return res.status(400).json({ message: "Cashier ID is required" });
    }
    
    // Validate bonuses array
    if (bonuses && !Array.isArray(bonuses)) {
      return res.status(400).json({ message: "Bonuses must be an array" });
    }
    
    // Validate each bonus tier
    if (bonuses) {
      for (const tier of bonuses) {
        if (typeof tier.maxCalls !== "number" || tier.maxCalls < 1) {
          return res.status(400).json({ message: "Each tier must have a valid maxCalls (positive number)" });
        }
        if (typeof tier.amount !== "number" || tier.amount < 0) {
          return res.status(400).json({ message: "Each tier must have a valid amount (non-negative number)" });
        }
      }
    }
    
    const config = await BonusConfig.findOneAndUpdate(
      { cashierId },
      { 
        cashierId,
        bonuses: bonuses || [],
        isActive: isActive !== undefined ? isActive : true
      },
      { upsert: true, new: true }
    );
    
    res.json(config);
  } catch (error) {
    console.error("Error updating bonus config:", error);
    res.status(500).json({ message: "Failed to update bonus config" });
  }
};
