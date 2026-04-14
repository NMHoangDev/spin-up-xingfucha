"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import FingerprintJS from "@fingerprintjs/fingerprintjs";
import { AnimatePresence, motion } from "motion/react";
import confetti from "canvas-confetti";
import {
  ChevronRight,
  Gift,
  Lock,
  Phone,
  ShieldCheck,
  Sparkles,
  User,
  X,
} from "lucide-react";

import logoJpg from "@/assets/logo.jpg";
import { REWARDS, type Reward } from "@/lib/rewards/rewards";

type UserInfo = { name: string; phone: string };
type ActiveTab = "spin" | "rewards";
type SpinReward = Reward & {
  voucherDelayMinutes?: number;
  voucherUsableFrom?: string | null;
  voucherExpiresAt?: string | null;
};
type WalletItem = SpinReward & {
  quantity: number;
  lastWonAt: string;
  firstWonAt: string;
};
type WalletStore = {
  items: WalletItem[];
  updatedAt: string;
};

type SavedProfile = {
  name: string;
  phone: string;
};
type DailyQuotaStore = {
  day: string;
  spinsUsedToday: number;
  maxSpinsToday: number;
  globalClosed: boolean;
};

const WALLET_KEY = "xfc-wallet-v2";
const DAILY_QUOTA_KEY = "xfc-daily-quota-v2";
const ACTIVE_TAB_KEY = "xfc-active-tab-v1";
const PROFILE_KEY = "xfc-profile-v1";
const DAILY_USAGE_KEY = "xfc-daily-usage-v1";
const CHANNEL_KEY = "xfc-spin-sync-v2";
const WALLET_COOKIE = "xfc_wallet_summary";

const rewardVisuals: Record<
  number,
  { icon: string; accent: string; soft: string }
> = {
  0: { icon: "🧋", accent: "#b45309", soft: "#fef3c7" },
  1: { icon: "🥤", accent: "#b91c1c", soft: "#fee2e2" },
  2: { icon: "🥥", accent: "#9a3412", soft: "#ffedd5" },
  3: { icon: "🍋", accent: "#4d7c0f", soft: "#ecfccb" },
};

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function formatTime(value?: string | null) {
  if (!value) return null;
  try {
    return new Date(value).toLocaleString("vi-VN");
  } catch {
    return value;
  }
}

function readJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function readQuota(): DailyQuotaStore | null {
  const stored = readJson<DailyQuotaStore>(DAILY_QUOTA_KEY);
  if (!stored) return null;
  return stored.day === todayKey() ? stored : null;
}

function readUsedRewardToday() {
  const stored = readJson<{ day: string; used: boolean }>(DAILY_USAGE_KEY);
  return stored?.day === todayKey() ? Boolean(stored.used) : false;
}

function writeWalletCookie(items: WalletItem[]) {
  if (typeof document === "undefined") return;
  const summary = items.map((item) => `${item.id}:${item.quantity}`).join(",");
  document.cookie = `${WALLET_COOKIE}=${encodeURIComponent(summary)}; path=/; max-age=${60 * 60 * 24 * 7}; samesite=lax`;
}

function RewardIcon({
  rewardId,
  size = "md",
}: {
  rewardId: number;
  size?: "sm" | "md" | "lg";
}) {
  const visual = rewardVisuals[rewardId] ?? rewardVisuals[0]!;
  const classes =
    size === "sm"
      ? "h-10 w-10 text-lg"
      : size === "lg"
        ? "h-16 w-16 text-3xl"
        : "h-12 w-12 text-2xl";

  return (
    <div
      className={`flex items-center justify-center rounded-2xl border border-white/80 shadow-sm ${classes}`}
      style={{ backgroundColor: visual.soft, color: visual.accent }}
    >
      {visual.icon}
    </div>
  );
}

function Modal({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title?: string;
  children: React.ReactNode;
  onClose?: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            className="absolute inset-0 bg-black/55 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="relative z-10 w-full max-w-sm rounded-[28px] bg-white p-6 shadow-2xl"
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.96 }}
          >
            {onClose && (
              <button
                onClick={onClose}
                className="absolute right-4 top-4 rounded-full bg-gray-100 p-2 text-gray-500"
              >
                <X size={18} />
              </button>
            )}
            {title && (
              <h3 className="mb-5 text-center text-2xl font-extrabold text-[#8f111a]">
                {title}
              </h3>
            )}
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export default function Page() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("spin");
  const [userInfo, setUserInfo] = useState<UserInfo>({ name: "", phone: "" });
  const [wallet, setWallet] = useState<WalletStore>({
    items: [],
    updatedAt: "",
  });
  const [quota, setQuota] = useState<DailyQuotaStore | null>(null);
  const [usedRewardToday, setUsedRewardToday] = useState(false);
  const [fingerprint, setFingerprint] = useState<string | null>(null);
  const [fingerprintReady, setFingerprintReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [duration, setDuration] = useState(5200);
  const [formError, setFormError] = useState("");
  const [resultOpen, setResultOpen] = useState(false);
  const [preSpinOpen, setPreSpinOpen] = useState(false);
  const [rewardResult, setRewardResult] = useState<SpinReward | null>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    setWallet(
      readJson<WalletStore>(WALLET_KEY) ?? { items: [], updatedAt: "" },
    );
    setQuota(readQuota());
    setUsedRewardToday(readUsedRewardToday());
    const savedProfile = readJson<SavedProfile>(PROFILE_KEY);
    if (savedProfile) setUserInfo(savedProfile);
    if (typeof window !== "undefined") {
      const savedTab = window.sessionStorage.getItem(ACTIVE_TAB_KEY);
      if (savedTab === "spin" || savedTab === "rewards") {
        setActiveTab(savedTab);
      }
    }
    if (typeof window === "undefined" || !("BroadcastChannel" in window))
      return;
    const channel = new BroadcastChannel(CHANNEL_KEY);
    channelRef.current = channel;
    channel.onmessage = (event) => {
      if (event.data?.type === "wallet")
        setWallet(event.data.payload as WalletStore);
      if (event.data?.type === "quota")
        setQuota(event.data.payload as DailyQuotaStore | null);
      if (event.data?.type === "used-today")
        setUsedRewardToday(Boolean(event.data.payload));
    };
    return () => channel.close();
  }, []);

  useEffect(() => {
    let mounted = true;
    async function loadFingerprint() {
      try {
        const fp = await FingerprintJS.load();
        const result = await fp.get();
        if (mounted) setFingerprint(result.visitorId);
      } catch {
        if (mounted)
          setFormError(
            "Không thể xác minh thiết bị lúc này. Vui lòng tải lại trang.",
          );
      } finally {
        if (mounted) setFingerprintReady(true);
      }
    }
    void loadFingerprint();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(ACTIVE_TAB_KEY, activeTab);
    }
  }, [activeTab]);

  useEffect(() => {
    if (!isSpinning) return;
    const timer = window.setTimeout(() => {
      setIsSpinning(false);
      setResultOpen(true);
      setActiveTab("rewards");
      confetti({
        particleCount: 150,
        spread: 72,
        origin: { y: 0.58 },
        colors: ["#d81b21", "#ffd700", "#fff8dc"],
      });
    }, duration + 60);
    return () => window.clearTimeout(timer);
  }, [isSpinning, duration]);

  const groupedWallet = useMemo(
    () =>
      [...wallet.items].sort((a, b) => {
        if (b.quantity !== a.quantity) return b.quantity - a.quantity;
        return (
          new Date(b.lastWonAt).getTime() - new Date(a.lastWonAt).getTime()
        );
      }),
    [wallet],
  );

  const persistWallet = (nextWallet: WalletStore) => {
    setWallet(nextWallet);
    window.localStorage.setItem(WALLET_KEY, JSON.stringify(nextWallet));
    writeWalletCookie(nextWallet.items);
    channelRef.current?.postMessage({ type: "wallet", payload: nextWallet });
  };

  const persistQuota = (nextQuota: DailyQuotaStore | null) => {
    setQuota(nextQuota);
    if (nextQuota) {
      window.localStorage.setItem(DAILY_QUOTA_KEY, JSON.stringify(nextQuota));
    } else {
      window.localStorage.removeItem(DAILY_QUOTA_KEY);
    }
    channelRef.current?.postMessage({ type: "quota", payload: nextQuota });
  };

  const persistProfile = (profile: SavedProfile) => {
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  };

  const persistUsedRewardToday = (used: boolean) => {
    setUsedRewardToday(used);
    window.localStorage.setItem(
      DAILY_USAGE_KEY,
      JSON.stringify({ day: todayKey(), used }),
    );
    channelRef.current?.postMessage({ type: "used-today", payload: used });
  };

  const addRewardToWallet = (reward: SpinReward, receivedAt: string) => {
    const current = readJson<WalletStore>(WALLET_KEY) ?? {
      items: [],
      updatedAt: "",
    };
    const existing = current.items.find((item) => item.id === reward.id);
    const items = existing
      ? current.items.map((item) =>
          item.id === reward.id
            ? {
                ...item,
                quantity: item.quantity + 1,
                lastWonAt: receivedAt,
                voucherUsableFrom:
                  reward.voucherUsableFrom ?? item.voucherUsableFrom ?? null,
                voucherExpiresAt:
                  reward.voucherExpiresAt ?? item.voucherExpiresAt ?? null,
              }
            : item,
        )
      : [
          ...current.items,
          {
            ...reward,
            quantity: 1,
            firstWonAt: receivedAt,
            lastWonAt: receivedAt,
          },
        ];

    persistWallet({ items, updatedAt: receivedAt });
  };

  const localSpinBlocked =
    quota?.day === todayKey() &&
    (quota.globalClosed || quota.spinsUsedToday >= quota.maxSpinsToday);

  const handleSpinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!fingerprint || !fingerprintReady) {
      setFormError("Đang xác minh thiết bị, vui lòng thử lại sau ít giây.");
      return;
    }

    if (localSpinBlocked) {
      setFormError(
        quota?.globalClosed
          ? "Đã tới giới hạn lượt quay hôm nay."
          : `Thiết bị này đã dùng hết ${quota?.maxSpinsToday ?? 0} lượt quay hôm nay.`,
      );
      return;
    }

    const name = userInfo.name.trim();
    const phone = userInfo.phone.trim();
    if (!name || !phone) return setFormError("Vui lòng nhập đầy đủ thông tin.");
    if (!/^(0|84)(3|5|7|8|9)([0-9]{8})$/.test(phone)) {
      return setFormError("Vui lòng nhập số điện thoại Việt Nam hợp lệ.");
    }

    setLoading(true);
    try {
      const res = await fetch("/api/spin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, deviceFingerprint: fingerprint }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (
          res.status === 409 &&
          data?.code === "DAILY_DEVICE_POOL_LIMIT_REACHED"
        ) {
          persistQuota({
            day: todayKey(),
            spinsUsedToday: quota?.spinsUsedToday ?? 0,
            maxSpinsToday: quota?.maxSpinsToday ?? 0,
            globalClosed: true,
          });
          return setFormError("Đã tới giới hạn lượt quay hôm nay.");
        }

        if (res.status === 409 && data?.code === "DEVICE_TIER_LIMIT_REACHED") {
          persistQuota({
            day: todayKey(),
            spinsUsedToday: Number(data?.maxSpinsToday ?? 0),
            maxSpinsToday: Number(data?.maxSpinsToday ?? 0),
            globalClosed: false,
          });
          return setFormError(
            data?.error ??
              `Thiết bị này đã dùng hết ${Number(data?.maxSpinsToday ?? 0)} lượt quay hôm nay.`,
          );
        }

        throw new Error(data?.error ?? "Không thể quay thưởng lúc này.");
      }

      const index = Number(data.rewardIndex ?? 0);
      const angle = 360 / REWARDS.length;
      const spins = 4 + Math.floor(Math.random() * 3);
      const offset = (Math.random() - 0.5) * (angle * 0.42);
      const target = spins * 360 + (360 - (index * angle + angle / 2)) + offset;
      const receivedAt = new Date().toISOString();

      setDuration(4700 + Math.floor(Math.random() * 1100));
      setRotation((prev) => prev + target - (prev % 360));
      setRewardResult(data.reward);
      persistProfile({ name, phone });
      addRewardToWallet(data.reward, receivedAt);
      persistQuota({
        day: todayKey(),
        spinsUsedToday: Number(data?.limits?.spinsUsedToday ?? 1),
        maxSpinsToday: Number(data?.limits?.maxSpinsToday ?? 1),
        globalClosed: false,
      });
      setPreSpinOpen(false);
      setIsSpinning(true);
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Có lỗi xảy ra khi quay vòng quay.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleUseReward = async (rewardId: number) => {
    const savedProfile = readJson<SavedProfile>(PROFILE_KEY);
    if (!savedProfile?.phone) {
      setFormError("Chưa tìm thấy thông tin người chơi để sử dụng voucher.");
      return;
    }

    if (usedRewardToday) {
      setFormError("Bạn đã dùng 1 voucher trong hôm nay, chưa thể dùng thêm.");
      return;
    }

    try {
      const res = await fetch("/api/spins", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "consume-one",
          phone: savedProfile.phone,
          rewardId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? "Không thể sử dụng voucher lúc này.");
      }

      const current = readJson<WalletStore>(WALLET_KEY) ?? {
        items: [],
        updatedAt: "",
      };
      const nextItems = current.items
        .map((item) =>
          item.id === rewardId
            ? { ...item, quantity: item.quantity - 1 }
            : item,
        )
        .filter((item) => item.quantity > 0);

      persistWallet({
        items: nextItems,
        updatedAt: new Date().toISOString(),
      });
      persistUsedRewardToday(true);
      setFormError("");
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Không thể sử dụng voucher lúc này.",
      );
    }
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#fff8dc_0%,#fdf5e6_46%,#f9e4bf_100%)] text-[#571017]">
      <div className="mx-auto flex min-h-screen w-full max-w-[440px] flex-col px-4 pb-8 pt-4">
        <header className="rounded-[30px] border border-white/70 bg-white/65 p-4 shadow-[0_20px_40px_rgba(120,24,30,0.08)] backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="relative h-10 w-10 overflow-hidden rounded-full border-2 border-white bg-white shadow-lg">
                <Image
                  src={logoJpg}
                  alt="Logo XingFuCha"
                  fill
                  sizes="80px"
                  priority
                  className="object-cover"
                />
              </div>
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#b71721]">
                  XingFuCha
                </p>
                <p className="mt-1 text-sm font-semibold text-[#6c1a1f]">
                  Vòng quay may mắn
                </p>
              </div>
            </div>
            <div className="rounded-full bg-[#d81b21]/10 px-3 py-1 text-[11px] font-bold text-[#b71721]">
              Ví quà tích lũy
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-[#f8e6c8] p-1.5">
            {(["spin", "rewards"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`rounded-2xl px-4 py-3 text-sm font-extrabold transition ${activeTab === tab ? "bg-[#d81b21] text-white shadow-[0_10px_20px_rgba(216,27,33,0.22)]" : "text-[#8f111a]"}`}
              >
                {tab === "spin" ? "Quay thưởng" : "Phần thưởng của tôi"}
              </button>
            ))}
          </div>
        </header>

        <div className="mt-4 rounded-[28px] border border-[#d81b21]/10 bg-white/60 p-4 shadow-[0_14px_35px_rgba(120,24,30,0.08)] backdrop-blur">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 text-[#b71721]" size={18} />
            <div className="text-xs font-semibold leading-5 text-[#6c1a1f]">
              <p>
                Giới hạn mỗi ngày: 300 lượt khách đầu quay 3 lượt, 200 lượt
                khách tiếp quay 2 lượt, 100 lượt khách cuối quay 1 lượt.
              </p>
              <p>
                Sau mốc 600 lượt khách, hệ thống sẽ báo đã tới giới hạn lượt
                quay hôm nay.
              </p>
              <p>
                Quà trúng sẽ được cộng dồn số lượng trong ví trên trình
                duyệt.(sau khi quay dùng được 1 voucher duy nhất, sau ngày sẽ tự
                động mở lại và sử dụng voucher tiếp theo )
              </p>
            </div>
          </div>
        </div>

        {activeTab === "spin" ? (
          <>
            <section className="relative mt-6 overflow-hidden rounded-[34px] bg-[linear-gradient(180deg,#fff7e7_0%,#ffe4b5_100%)] px-4 pb-6 pt-7 shadow-[0_24px_48px_rgba(120,24,30,0.12)]">
              <div className="text-center">
                <p className="text-sm font-bold uppercase tracking-[0.35em] text-[#b71721]/80">
                  Vòng Xing may mắn
                </p>
                <h1 className="mt-2 text-2xl font-black leading-none text-[#d81b21]">
                  Quay Xing, nhận quà Xịng
                </h1>
              </div>
              <motion.div
                animate={{ rotate: rotation }}
                transition={{
                  duration: duration / 1000,
                  ease: [0.12, 0, 0.2, 1],
                }}
                className="relative mx-auto mt-6 h-[280px] w-[280px] rounded-full border-[10px] border-[#d81b21] bg-[conic-gradient(#fff_0deg_90deg,#fff4d6_90deg_180deg,#fff_180deg_270deg,#fff4d6_270deg_360deg)] shadow-[0_0_20px_rgba(216,27,33,0.28),inset_0_0_12px_rgba(0,0,0,0.14)]"
              >
                {REWARDS.map((reward, index) => (
                  <div
                    key={reward.id}
                    className="absolute inset-0"
                    style={{ transform: `rotate(${index * 90 + 45}deg)` }}
                  >
                    <div className="absolute left-1/2 top-5 flex w-20 -translate-x-1/2 flex-col items-center gap-1.5 text-center">
                      <RewardIcon rewardId={reward.id} size="sm" />
                      <span className="text-[9px] font-extrabold leading-tight text-[#b71721]">
                        {reward.label}
                      </span>
                    </div>
                  </div>
                ))}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="relative flex h-20 w-20 items-center justify-center rounded-full border-4 border-[#d81b21] bg-white shadow-[0_0_15px_rgba(0,0,0,0.12)]">
                    <Image
                      src={logoJpg}
                      alt="Logo XingFuCha"
                      fill
                      sizes="56px"
                      className="rounded-full object-cover p-3"
                    />
                  </div>
                </div>
              </motion.div>
              <div className="absolute left-1/2 top-[84px] h-11 w-9 -translate-x-1/2 bg-[#d81b21] [clip-path:polygon(50%_100%,0_0,100%_0)]" />
            </section>

            <section className="mt-5">
              {quota && (
                <div className="mb-4 rounded-[24px] border border-white/80 bg-white/80 p-4 text-sm shadow-sm">
                  <p className="font-extrabold text-[#8f111a]">
                    Lượt quay hôm nay
                  </p>
                  <p className="mt-2 text-[#6c1a1f]">
                    Đã dùng{" "}
                    <span className="font-bold">{quota.spinsUsedToday}</span> /{" "}
                    <span className="font-bold">{quota.maxSpinsToday}</span>{" "}
                    lượt trên thiết bị này.
                  </p>
                </div>
              )}

              {localSpinBlocked ? (
                <div className="rounded-[28px] border border-[#d81b21]/15 bg-white/85 p-5 text-center shadow-sm">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#d81b21]/10 text-[#d81b21]">
                    <Lock size={22} />
                  </div>
                  <p className="text-base font-extrabold text-[#8f111a]">
                    Thiết bị này đã hết lượt quay hôm nay
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[#6c1a1f]">
                    {quota?.globalClosed
                      ? "Đã tới giới hạn lượt quay hôm nay."
                      : `Bạn đã dùng hết ${quota?.maxSpinsToday ?? 0} lượt quay trong ngày.`}
                  </p>
                </div>
              ) : (
                <button
                  onClick={() => !isSpinning && setPreSpinOpen(true)}
                  disabled={isSpinning || !fingerprintReady || !fingerprint}
                  className="w-full rounded-[24px] border-2 border-white bg-gradient-to-b from-[#ffd700] to-[#d8a40c] px-8 py-4 text-2xl font-black text-[#b71721] shadow-[0_8px_0_rgb(180,130,0)] transition active:translate-y-1 active:shadow-none disabled:opacity-70"
                >
                  {isSpinning
                    ? "Đang quay..."
                    : !fingerprintReady || !fingerprint
                      ? "Đang xác minh thiết bị..."
                      : "Quay ngay"}
                </button>
              )}

              {formError && (
                <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm font-semibold text-red-700">
                  {formError}
                </div>
              )}
            </section>
          </>
        ) : (
          <section className="mt-6 rounded-[34px] bg-[linear-gradient(180deg,#fff7e7_0%,#fff0d0_100%)] p-5 shadow-[0_24px_48px_rgba(120,24,30,0.12)]">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#d81b21]/10 text-[#d81b21]">
                <Gift size={22} />
              </div>
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.22em] text-[#b71721]/75">
                  Kho quà cá nhân
                </p>
                <h2 className="text-2xl font-black text-[#8f111a]">
                  Phần thưởng của tôi
                </h2>
              </div>
            </div>

            {groupedWallet.length ? (
              <div className="mt-5 grid gap-4">
                {groupedWallet.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-[24px] border border-[#f3cf8c] bg-white/90 p-4 shadow-sm"
                  >
                    <div className="flex items-start gap-3">
                      <RewardIcon rewardId={item.id} size="lg" />
                      <div>
                        <p className="text-lg font-black leading-tight text-[#d81b21]">
                          {item.label}
                        </p>
                        <p className="mt-1 text-sm font-medium text-[#6c1a1f]">
                          Số lượng hiện có:{" "}
                          <span className="rounded-full bg-[#d81b21]/10 px-3 py-1 font-extrabold text-[#b71721]">
                            {item.quantity}
                          </span>
                        </p>
                      </div>
                    </div>
                    {item.code && (
                      <div className="mt-3 inline-flex rounded-xl border border-[#f3cf8c] bg-[#fff8dc] px-3 py-2 font-mono text-xs font-bold tracking-wider text-[#8f111a]">
                        {item.code}
                      </div>
                    )}
                    <div className="mt-3 space-y-1.5 text-sm leading-6 text-[#6c1a1f]">
                      <p>
                        Nhận lần đầu:{" "}
                        <span className="font-bold">
                          {formatTime(item.firstWonAt) ?? "-"}
                        </span>
                      </p>
                      <p>
                        Nhận gần nhất:{" "}
                        <span className="font-bold">
                          {formatTime(item.lastWonAt) ?? "-"}
                        </span>
                      </p>
                      {item.type === "voucher" && (
                        <p>
                          Dùng từ:{" "}
                          <span className="font-bold">
                            {formatTime(item.voucherUsableFrom) ??
                              `Sau ${item.voucherDelayMinutes ?? 0} phút`}
                          </span>
                        </p>
                      )}
                      {item.type === "voucher" && (
                        <p>
                          Hết hạn lượt mới nhất:{" "}
                          <span className="font-bold">
                            {formatTime(item.voucherExpiresAt) ?? "-"}
                          </span>
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleUseReward(item.id)}
                      disabled={usedRewardToday || item.quantity <= 0}
                      className="mt-3 w-full rounded-2xl bg-[#d81b21] px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {usedRewardToday
                        ? "Hôm nay đã dùng 1 voucher"
                        : "Sử dụng voucher này"}
                    </button>
                  </div>
                ))}
                <div className="rounded-[24px] border border-dashed border-[#d81b21]/20 bg-white/70 p-4 text-sm leading-6 text-[#6c1a1f]">
                  Ví quà đang được lưu bằng{" "}
                  <span className="font-bold">
                    localStorage + cookie summary + session tab
                  </span>{" "}
                  để giảm tải server. Backend vẫn là nơi quyết định lúc xác nhận
                  dùng thưởng: mỗi ngày chỉ dùng được 1 phần thưởng.
                </div>
              </div>
            ) : (
              <div className="mt-5 rounded-[28px] border border-dashed border-[#d81b21]/25 bg-white/75 p-6 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#d81b21]/10 text-[#d81b21]">
                  <Sparkles size={24} />
                </div>
                <p className="mt-4 text-lg font-extrabold text-[#8f111a]">
                  Bạn chưa có phần thưởng nào
                </p>
                <p className="mt-2 text-sm leading-6 text-[#6c1a1f]">
                  Hãy quay ở tab “Quay thưởng”, quà trúng sẽ tự cộng dồn vào ví
                  của bạn.
                </p>
              </div>
            )}
          </section>
        )}
      </div>

      <Modal
        open={preSpinOpen}
        title="Thông tin người chơi"
        onClose={() => !loading && setPreSpinOpen(false)}
      >
        <form onSubmit={handleSpinSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="ml-1 text-sm font-bold text-gray-700">
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
                className="w-full rounded-2xl border-2 border-gray-100 bg-gray-50 py-3 pl-12 pr-4 outline-none transition focus:border-[#d81b21]"
                value={userInfo.name}
                onChange={(e) =>
                  setUserInfo((prev) => ({ ...prev, name: e.target.value }))
                }
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="ml-1 text-sm font-bold text-gray-700">
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
                className="w-full rounded-2xl border-2 border-gray-100 bg-gray-50 py-3 pl-12 pr-4 outline-none transition focus:border-[#d81b21]"
                value={userInfo.phone}
                onChange={(e) =>
                  setUserInfo((prev) => ({ ...prev, phone: e.target.value }))
                }
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading || !fingerprintReady || !fingerprint}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#d81b21] py-4 font-bold text-white shadow-lg disabled:opacity-60"
          >
            {loading ? "Đang xử lý..." : "Bắt đầu quay"}
            {!loading && <ChevronRight size={18} />}
          </button>
        </form>
      </Modal>

      <Modal open={resultOpen} onClose={() => setResultOpen(false)}>
        <div className="text-center">
          <div className="mx-auto mb-5">
            {rewardResult ? (
              <RewardIcon rewardId={rewardResult.id} size="lg" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#fff8dc] text-3xl">
                🎉
              </div>
            )}
          </div>
          <h2 className="text-3xl font-black text-[#8f111a]">Chúc mừng!</h2>
          <p className="mt-2 text-sm font-medium text-gray-600">
            Quà vừa trúng đã được cộng dồn vào ví của bạn
          </p>
          <div className="mt-6 rounded-[28px] border-2 border-dashed border-[#f3cf8c] bg-[#fff8dc] p-6">
            <p className="text-2xl font-black tracking-tight text-[#d81b21]">
              {rewardResult?.label}
            </p>
            {rewardResult?.code && (
              <div className="mt-4 inline-flex rounded-xl border border-[#f3cf8c] bg-white px-4 py-2 font-mono text-sm font-bold tracking-wider text-[#8f111a]">
                {rewardResult.code}
              </div>
            )}
            {rewardResult?.type === "voucher" && (
              <div className="mt-4 space-y-2 text-sm font-medium leading-6 text-gray-600">
                <p>
                  {formatTime(rewardResult.voucherUsableFrom)
                    ? `Voucher có thể sử dụng từ ${formatTime(rewardResult.voucherUsableFrom)}.`
                    : `Voucher sẽ được kích hoạt sau ${rewardResult.voucherDelayMinutes ?? 0} phút.`}
                </p>
                <p>
                  {formatTime(rewardResult.voucherExpiresAt)
                    ? `Voucher hết hạn vào ${formatTime(rewardResult.voucherExpiresAt)}.`
                    : "Voucher có hiệu lực trong 1 ngày kể từ thời điểm bắt đầu sử dụng."}
                </p>
              </div>
            )}
          </div>
        </div>
      </Modal>
    </main>
  );
}
