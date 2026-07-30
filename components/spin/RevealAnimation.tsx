"use client";

import { useEffect } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import confetti from "canvas-confetti";

export type RevealAnimationVariant = "box_open" | "fireworks" | "curtain";

/** How long after `playing` becomes true the caller should reveal the prize
 * result (kept per-variant since each animation has its own pacing). The
 * `box_open` value (1500ms) matches the app's original hardcoded timing —
 * intentionally not "when the box visually finishes" (~5.8s), to avoid
 * changing existing live behavior. */
export const REVEAL_ANIMATION_RESULT_DELAY_MS: Record<
  RevealAnimationVariant,
  number
> = {
  box_open: 1500,
  fireworks: 1800,
  curtain: 1600,
};

export const REVEAL_ANIMATION_OPTIONS: {
  value: RevealAnimationVariant;
  label: string;
}[] = [
  { value: "box_open", label: "Mở hộp quà" },
  { value: "fireworks", label: "Pháo hoa rực rỡ" },
  { value: "curtain", label: "Rèm sân khấu" },
];

export default function RevealAnimation({
  variant,
  playing,
}: {
  variant: RevealAnimationVariant;
  playing: boolean;
}) {
  if (variant === "fireworks") return <FireworksReveal playing={playing} />;
  if (variant === "curtain") return <CurtainReveal playing={playing} />;
  return <BoxOpenReveal playing={playing} />;
}

function BoxOpenReveal({ playing }: { playing: boolean }) {
  return (
    <AnimatePresence>
      {playing && (
        <motion.div
          className="fixed inset-0 z-40 flex items-center justify-center"
          style={{ backgroundColor: "rgba(0,0,0,0.72)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
        >
          <div className="relative h-[900px] w-[900px]">
            <motion.div
              className="absolute h-[680px] w-[680px]"
              style={{ left: "50%", top: "50%", x: "-50%", y: "-50%" }}
              initial={{ opacity: 1, scale: 1, rotate: 0 }}
              animate={{
                rotate: [0, -6, 6, -6, 6, -4, 4, -4, 4, 0],
                opacity: [1, 1, 1, 0],
                scale: [1, 1, 1, 0.85],
              }}
              transition={{
                rotate: { duration: 1, delay: 0, ease: "easeInOut" },
                opacity: { duration: 0.8, delay: 1, ease: "easeInOut" },
                scale: { duration: 0.8, delay: 1, ease: "easeInOut" },
              }}
            >
              <Image
                src="/images/hopquafull.webp"
                alt="Hộp quà đóng"
                fill
                sizes="680px"
                className="object-contain"
              />
            </motion.div>

            <motion.div
              className="absolute h-[560px] w-[560px]"
              style={{ left: "50%", top: "50%", x: "-50%", y: "-50%" }}
              initial={{ opacity: 0, x: "-50%", y: "-50%" }}
              animate={{
                opacity: 1,
                x: "calc(-50% - 280px)",
                y: "calc(-50% + 280px)",
                rotate: -15,
              }}
              transition={{ duration: 3, delay: 1, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              <Image
                src="/images/hopquakhongnap.webp"
                alt="Hộp quà không nắp"
                fill
                sizes="560px"
                className="object-contain"
              />
            </motion.div>

            <motion.div
              className="absolute h-[500px] w-[500px]"
              style={{ left: "50%", top: "50%", x: "-50%", y: "-50%" }}
              initial={{ opacity: 0, x: "-50%", y: "-50%" }}
              animate={{
                opacity: 1,
                x: "calc(-50% + 360px)",
                y: "calc(-50% - 360px)",
                rotate: 28,
              }}
              transition={{ duration: 3, delay: 1, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              <Image
                src="/images/napqua.webp"
                alt="Nắp quà"
                fill
                sizes="500px"
                className="object-contain"
              />
            </motion.div>

            <motion.div
              className="absolute left-1/2 top-8 -translate-x-1/2 text-7xl"
              initial={{ opacity: 0, y: 30, scale: 0.4 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.5, delay: 5.3, ease: [0.34, 1.56, 0.64, 1] }}
            >
              🎉
            </motion.div>

            <motion.p
              className="absolute bottom-16 left-1/2 -translate-x-1/2 whitespace-nowrap text-2xl font-black text-white"
              style={{ textShadow: "0 2px 12px rgba(0,0,0,0.5)" }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 5.4 }}
            >
              Chúc mừng bạn đã trúng thưởng! 🎊
            </motion.p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const FIREWORK_EMOJI = ["🎉", "✨", "🎊", "🧧", "⭐"];

function FireworksReveal({ playing }: { playing: boolean }) {
  useEffect(() => {
    if (!playing) return;
    const origins = [
      { x: 0.2, y: 0.6 },
      { x: 0.8, y: 0.6 },
      { x: 0.5, y: 0.4 },
    ];
    const timers = origins.map((origin, i) =>
      window.setTimeout(() => {
        confetti({
          particleCount: 90,
          spread: 80,
          startVelocity: 45,
          origin,
          colors: ["#d81b21", "#ffd700", "#fff8dc", "#ff8a00"],
        });
      }, i * 220),
    );
    return () => timers.forEach(window.clearTimeout);
  }, [playing]);

  return (
    <AnimatePresence>
      {playing && (
        <motion.div
          className="fixed inset-0 z-40 flex items-center justify-center overflow-hidden"
          style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="relative h-[500px] w-[500px]">
            {FIREWORK_EMOJI.map((emoji, i) => {
              const angle = (i / FIREWORK_EMOJI.length) * Math.PI * 2;
              const distance = 150;
              return (
                <motion.div
                  key={i}
                  className="absolute left-1/2 top-1/2 text-6xl"
                  initial={{ opacity: 0, x: "-50%", y: "-50%", scale: 0.2 }}
                  animate={{
                    opacity: [0, 1, 1, 0],
                    x: `calc(-50% + ${Math.cos(angle) * distance}px)`,
                    y: `calc(-50% + ${Math.sin(angle) * distance}px)`,
                    scale: [0.2, 1.2, 1, 0.9],
                    rotate: [0, 20, -10, 0],
                  }}
                  transition={{ duration: 1.3, delay: i * 0.08, ease: "easeOut" }}
                >
                  {emoji}
                </motion.div>
              );
            })}

            <motion.div
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center"
              initial={{ opacity: 0, scale: 0.3 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4, duration: 0.5, type: "spring", bounce: 0.5 }}
            >
              <p
                className="whitespace-nowrap text-3xl font-black text-white"
                style={{ textShadow: "0 2px 12px rgba(0,0,0,0.6)" }}
              >
                Chúc mừng bạn đã trúng thưởng! 🎊
              </p>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function CurtainReveal({ playing }: { playing: boolean }) {
  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => {
      confetti({
        particleCount: 140,
        spread: 90,
        origin: { y: 0.5 },
        colors: ["#d81b21", "#ffd700", "#fff8dc"],
      });
    }, 900);
    return () => window.clearTimeout(timer);
  }, [playing]);

  return (
    <AnimatePresence>
      {playing && (
        <motion.div
          className="fixed inset-0 z-40 overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <motion.div
            className="absolute inset-y-0 left-0 w-1/2"
            style={{
              background: "linear-gradient(90deg, #8f111a 0%, #d81b21 100%)",
            }}
            initial={{ x: 0 }}
            animate={{ x: "-100%" }}
            transition={{ duration: 0.7, delay: 0.7, ease: [0.65, 0, 0.35, 1] }}
          />
          <motion.div
            className="absolute inset-y-0 right-0 w-1/2"
            style={{
              background: "linear-gradient(270deg, #8f111a 0%, #d81b21 100%)",
            }}
            initial={{ x: 0 }}
            animate={{ x: "100%" }}
            transition={{ duration: 0.7, delay: 0.7, ease: [0.65, 0, 0.35, 1] }}
          />
          <motion.div
            className="absolute inset-0 flex items-center justify-center"
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.01, delay: 0.7 }}
          >
            <p className="text-2xl font-black text-white">🎁</p>
          </motion.div>
          <motion.div
            className="absolute inset-0 flex items-center justify-center"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.9, duration: 0.5, type: "spring", bounce: 0.4 }}
          >
            <p
              className="px-6 text-center text-3xl font-black text-[#8f111a]"
              style={{ textShadow: "0 2px 10px rgba(255,255,255,0.6)" }}
            >
              Chúc mừng bạn đã trúng thưởng! 🎊
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
