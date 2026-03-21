"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import Image from "next/image";
import {
  Gift,
  Phone,
  User,
  X,
  Share2,
  Ticket,
  Star,
  ChevronRight,
} from "lucide-react";
import confetti from "canvas-confetti";
import { REWARDS, type Reward } from "@/lib/rewards/rewards";
import logoJpg from "@/assets/logo.jpg";

// --- Types ---

interface UserInfo {
  name: string;
  phone: string;
}

// Reward type imported from shared source of truth in lib/rewards.

// --- Components ---

const Logo = ({ className = "w-10 h-10" }: { className?: string }) => (
  <motion.div
    animate={{ rotate: [0, 2, -2, 0] }}
    transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
    className={`relative ${className} rounded-full overflow-hidden bg-white shadow-lg ring-2 ring-white`}
  >
    <Image
      src={logoJpg}
      alt="XingFuCha logo"
      fill
      sizes="128px"
      priority
      className="object-cover"
    />
  </motion.div>
);

const Modal = ({
  isOpen,
  onClose,
  children,
  title,
}: {
  isOpen: boolean;
  onClose?: () => void;
  children: React.ReactNode;
  title?: string;
}) => (
  <AnimatePresence>
    {isOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
        >
          {onClose && (
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={24} />
            </button>
          )}
          <div className="p-8">
            {title && (
              <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">
                {title}
              </h3>
            )}
            {children}
          </div>
        </motion.div>
      </div>
    )}
  </AnimatePresence>
);

const SpinWheel = ({
  onSpinComplete,
  isSpinning,
  rotation,
}: {
  onSpinComplete: () => void;
  isSpinning: boolean;
  rotation: number;
}) => {
  const wheelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isSpinning) {
      const timer = setTimeout(() => {
        onSpinComplete();
      }, 5000); // Match transition duration

      return () => clearTimeout(timer);
    }
  }, [isSpinning, onSpinComplete]);

  return (
    <div className="relative w-80 h-80 md:w-96 md:h-96 mx-auto">
      {/* Pointer */}
      <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-40 text-red-600 drop-shadow-lg">
        <div
          className="w-8 h-10 bg-red-600 shadow-xl"
          style={{ clipPath: "polygon(50% 100%, 0 0, 100% 0)" }}
        />
      </div>

      {/* Wheel */}
      <motion.div
        ref={wheelRef}
        animate={{ rotate: rotation }}
        transition={{ duration: 5, ease: [0.15, 0, 0.15, 1] }}
        className="w-full h-full rounded-full border-8 border-white shadow-2xl relative overflow-hidden bg-white z-10"
        style={{ transformOrigin: "center" }}
      >
        {/* Background Segments */}
        {REWARDS.map((reward, i) => {
          const angle = 360 / REWARDS.length;
          const rotate = i * angle;
          const skew = 90 - angle;
          return (
            <div
              key={`bg-${reward.id}`}
              className="absolute top-0 right-0 w-1/2 h-1/2 origin-bottom-left"
              style={{
                transform: `rotate(${rotate}deg) skewY(-${skew}deg)`,
                backgroundColor: i % 2 === 0 ? "#fee2e2" : "#fef9c3",
                borderLeft: "1px solid rgba(239, 68, 68, 0.1)",
              }}
            />
          );
        })}

        {/* Labels and Icons Layer */}
        {REWARDS.map((reward, i) => {
          const angle = 360 / REWARDS.length;
          const rotate = i * angle + angle / 2;
          return (
            <div
              key={`label-${reward.id}`}
              className="absolute top-0 left-0 w-full h-full pointer-events-none"
              style={{ transform: `rotate(${rotate}deg)` }}
            >
              <div className="absolute top-0 left-1/2 -translate-x-1/2 pt-8 md:pt-12 flex flex-col items-center gap-1">
                <span className="text-[10px] md:text-xs font-black text-red-800 uppercase tracking-tighter text-center leading-none max-w-[60px]">
                  {reward.label}
                </span>
                {reward.type === "voucher" ? (
                  <Ticket size={14} className="text-red-500/50" />
                ) : (
                  <Gift size={14} className="text-red-500/50" />
                )}
              </div>
            </div>
          );
        })}

        {/* Center Button Decor */}
        <div className="absolute inset-0 flex items-center justify-center z-20">
          <div className="w-20 h-20 rounded-full bg-white shadow-xl flex items-center justify-center border-4 border-red-50">
            <Logo className="w-14 h-14" />
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default function XingFuChaLanding() {
  const [isPreSpinOpen, setIsPreSpinOpen] = useState(false);
  const [isResultOpen, setIsResultOpen] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const [userInfo, setUserInfo] = useState<UserInfo>({ name: "", phone: "" });
  const [rewardResult, setRewardResult] = useState<Reward | null>(null);
  const [rotation, setRotation] = useState(0);
  const [hasSpun, setHasSpun] = useState(false);
  const [loading, setLoading] = useState(false);

  const handlePreSpinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInfo.name || !userInfo.phone) return;

    // Basic Vietnamese phone validation
    const phoneRegex = /^(0|84)(3|5|7|8|9)([0-9]{8})$/;
    if (!phoneRegex.test(userInfo.phone)) {
      alert("Vui lòng nhập số điện thoại Việt Nam hợp lệ");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/spin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userInfo),
      });
      const data = await res.json();

      if (data.success) {
        const targetIdx = data.rewardIndex;
        const segmentAngle = 360 / REWARDS.length;
        const extraSpins = 5 * 360;
        const targetAngle = extraSpins + (360 - targetIdx * segmentAngle);

        setRotation((prev) => prev + targetAngle - (prev % 360));
        setRewardResult(data.reward);
        setIsPreSpinOpen(false);
        setIsSpinning(true);
      }
    } catch (error) {
      console.error("Spin error:", error);
    } finally {
      setLoading(false);
    }
  };

  const onSpinComplete = () => {
    setIsSpinning(false);
    setIsResultOpen(true);
    setHasSpun(true);
    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 },
      colors: ["#ef4444", "#f59e0b", "#10b981"],
    });
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-red-50 via-yellow-50 to-emerald-50 font-sans overflow-x-hidden">
      {/* Hero Section */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-4 py-20">
        {/* Background Accents */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <motion.div
            animate={{ y: [0, -20, 0], rotate: [0, 5, 0] }}
            transition={{ duration: 5, repeat: Infinity }}
            className="absolute top-20 left-10 w-32 h-32 bg-red-200/30 rounded-full blur-3xl"
          />
          <motion.div
            animate={{ y: [0, 20, 0], rotate: [0, -5, 0] }}
            transition={{ duration: 6, repeat: Infinity }}
            className="absolute bottom-20 right-10 w-48 h-48 bg-emerald-200/30 rounded-full blur-3xl"
          />
        </div>

        {/* Logo */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="mb-8"
        >
          <div className="bg-white px-6 py-3 rounded-full shadow-xl border border-red-50 flex items-center gap-3">
            <Logo className="w-12 h-12 md:w-14 md:h-14" />
            <div className="flex flex-col leading-none">
              <span className="font-black text-2xl tracking-tighter text-gray-900">
                XingFuCha
              </span>
              <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest">
                Happiness in every sip
              </span>
            </div>
          </div>
        </motion.div>

        {/* Headline */}
        <div className="text-center max-w-2xl mb-12">
          <motion.h1
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-5xl md:text-7xl font-black text-gray-900 mb-6 leading-tight"
          >
            Quay liền tay <br />
            <span className="text-red-600">Nhận quà ngay!</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-lg text-gray-600 font-medium"
          >
            Hàng ngàn phần quà hấp dẫn đang chờ đón bạn.{" "}
            <br className="hidden md:block" />
            Thử vận may của bạn cùng XingFuCha ngay hôm nay!
          </motion.p>
        </div>

        {/* Spin Wheel Area */}
        <div className="relative mb-12">
          <SpinWheel
            isSpinning={isSpinning}
            rotation={rotation}
            onSpinComplete={onSpinComplete}
          />

          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => !hasSpun && !isSpinning && setIsPreSpinOpen(true)}
              disabled={isSpinning || hasSpun}
              className={`
                w-24 h-24 md:w-28 md:h-28 rounded-full font-black text-sm md:text-base shadow-2xl flex items-center justify-center text-center leading-tight transition-all
                ${
                  hasSpun
                    ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                    : "bg-red-600 text-white hover:bg-red-700 active:bg-red-800"
                }
              `}
            >
              {isSpinning ? "..." : hasSpun ? "ĐÃ QUAY" : "QUAY\nNGAY"}
            </motion.button>
          </div>
        </div>

        {/* Scroll Indicator */}
        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="mt-auto text-gray-400 flex flex-col items-center gap-2"
        >
          <span className="text-xs font-bold uppercase tracking-widest">
            Khám phá thêm
          </span>
          <div className="w-px h-12 bg-gradient-to-b from-gray-300 to-transparent" />
        </motion.div>
      </section>

      {/* Pre-Spin Modal */}
      <Modal
        isOpen={isPreSpinOpen}
        onClose={() => !loading && setIsPreSpinOpen(false)}
        title="Thông tin người chơi"
      >
        <form onSubmit={handlePreSpinSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-bold text-gray-700 ml-1">
              Họ và tên
            </label>
            <div className="relative">
              <User
                className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                size={18}
              />
              <input
                type="text"
                required
                placeholder="Nguyễn Văn A"
                className="w-full pl-12 pr-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-red-500 focus:ring-0 transition-all outline-none"
                value={userInfo.name}
                onChange={(e) =>
                  setUserInfo({ ...userInfo, name: e.target.value })
                }
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-bold text-gray-700 ml-1">
              Số điện thoại
            </label>
            <div className="relative">
              <Phone
                className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                size={18}
              />
              <input
                type="tel"
                required
                placeholder="0901234567"
                className="w-full pl-12 pr-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-red-500 focus:ring-0 transition-all outline-none"
                value={userInfo.phone}
                onChange={(e) =>
                  setUserInfo({ ...userInfo, phone: e.target.value })
                }
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-red-600 text-white font-bold py-4 rounded-2xl shadow-lg hover:bg-red-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? "Đang xử lý..." : "Bắt đầu quay"}
            {!loading && <ChevronRight size={20} />}
          </button>
          <p className="text-[10px] text-center text-gray-400 mt-4">
            Bằng cách nhấn bắt đầu, bạn đồng ý với các điều khoản của XingFuCha.
          </p>
        </form>
      </Modal>

      {/* Result Modal */}
      <Modal isOpen={isResultOpen} onClose={() => setIsResultOpen(false)}>
        <div className="text-center">
          <div className="relative inline-flex items-center justify-center mb-6">
            <div className="absolute inset-0 bg-yellow-400 blur-2xl opacity-20 animate-pulse" />
            <Logo className="w-24 h-24" />
          </div>
          <h2 className="text-3xl font-black text-gray-900 mb-2 uppercase italic">
            Chúc mừng!
          </h2>
          <p className="text-gray-600 mb-8">
            Bạn đã trúng giải thưởng tuyệt vời từ XingFuCha
          </p>

          <div className="bg-red-50 border-2 border-dashed border-red-200 rounded-3xl p-8 mb-8 relative overflow-hidden">
            <div className="absolute -top-4 -left-4 w-12 h-12 bg-white rounded-full" />
            <div className="absolute -top-4 -right-4 w-12 h-12 bg-white rounded-full" />
            <div className="absolute -bottom-4 -left-4 w-12 h-12 bg-white rounded-full" />
            <div className="absolute -bottom-4 -right-4 w-12 h-12 bg-white rounded-full" />

            <div className="flex flex-col items-center gap-3">
              {rewardResult?.type === "voucher" ? (
                <Ticket className="text-red-500" size={48} />
              ) : (
                <Gift className="text-red-500" size={48} />
              )}
              <span className="text-2xl font-black text-red-600 uppercase tracking-tight">
                {rewardResult?.label}
              </span>
              {rewardResult?.code && (
                <div className="mt-4 px-4 py-2 bg-white rounded-xl border border-red-100 font-mono font-bold text-red-800 tracking-widest">
                  {rewardResult.code}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setIsResultOpen(false)}
              className="bg-red-600 text-white font-bold py-4 rounded-2xl shadow-lg hover:bg-red-700 transition-all"
            >
              Dùng ngay
            </button>
            <button className="bg-white text-gray-700 border-2 border-gray-100 font-bold py-4 rounded-2xl hover:bg-gray-50 transition-all flex items-center justify-center gap-2">
              <Share2 size={18} />
              Chia sẻ
            </button>
          </div>
        </div>
      </Modal>

      {/* Footer */}
      <footer className="py-10 text-center text-gray-400 text-sm border-t border-gray-100">
        <p>© 2026 XingFuCha Vietnam. All rights reserved.</p>
      </footer>
    </main>
  );
}
