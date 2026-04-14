import { REWARDS, type Reward } from "./rewards";
import { createSeededRng, createDefaultRng, type Rng } from "./reward.service";

type SelectionOptions = {
  maxSpinsToday: number;
  spinNumberToday: number;
  seed?: string | number;
  rng?: Rng;
};

const TOPPING_REWARD = REWARDS[0]!;
const NON_TOPPING_REWARDS = REWARDS.slice(1);

function selectRandomNonTopping(rng: Rng): Reward {
  const index = Math.floor(rng() * NON_TOPPING_REWARDS.length);
  return NON_TOPPING_REWARDS[Math.max(0, Math.min(index, NON_TOPPING_REWARDS.length - 1))]!;
}

export function selectRewardForSpinFlow(options: SelectionOptions): {
  reward: Reward;
  index: number;
} {
  const rng =
    options.rng ??
    (options.seed != null ? createSeededRng(options.seed) : createDefaultRng());

  if (options.maxSpinsToday >= 3) {
    if (options.spinNumberToday === 1) {
      return { reward: TOPPING_REWARD, index: TOPPING_REWARD.id };
    }

    const reward = selectRandomNonTopping(rng);
    return { reward, index: reward.id };
  }

  if (options.maxSpinsToday === 2) {
    const toppingAtFirstSpin = rng() < 0.5;
    const shouldGiveTopping =
      (toppingAtFirstSpin && options.spinNumberToday === 1) ||
      (!toppingAtFirstSpin && options.spinNumberToday === 2);

    if (shouldGiveTopping) {
      return { reward: TOPPING_REWARD, index: TOPPING_REWARD.id };
    }

    const reward = selectRandomNonTopping(rng);
    return { reward, index: reward.id };
  }

  const reward = selectRandomNonTopping(rng);
  return { reward, index: reward.id };
}
