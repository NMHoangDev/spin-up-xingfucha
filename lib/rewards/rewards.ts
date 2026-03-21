export type RewardType = "voucher" | "item";

export type Reward = {
  id: number;
  label: string;
  type: RewardType;
  code?: string;
  /** Relative probability weight. Rewards with weight <= 0 are excluded. */
  weight: number;
};

/**
 * Single source of truth for rewards used by both the UI wheel and the backend.
 * Adjust weights to match your intended distribution.
 */
export const REWARDS: Reward[] = [
  { id: 0, label: "Voucher 5%", type: "voucher", code: "XFC5OFF", weight: 30 },
  { id: 1, label: "Xing Fan", type: "item", weight: 8 },
  {
    id: 2,
    label: "Voucher 10%",
    type: "voucher",
    code: "XFC10OFF",
    weight: 20,
  },
  { id: 3, label: "Water Bottle", type: "item", weight: 6 },
  {
    id: 4,
    label: "Voucher 20%",
    type: "voucher",
    code: "XFC20OFF",
    weight: 10,
  },
  { id: 5, label: "Cooling Fan", type: "item", weight: 4 },
  { id: 6, label: "Free Upgrade", type: "item", weight: 12 },
  {
    id: 7,
    label: "Voucher 10%",
    type: "voucher",
    code: "XFC10OFF",
    weight: 10,
  },
];
