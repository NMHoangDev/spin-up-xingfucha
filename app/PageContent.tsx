"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import confetti from "canvas-confetti";
import {
  CheckCircle2,
  ChevronRight,
  Gift,
  Lock,
  Phone,
  Sparkles,
  Target,
  User,
  X,
} from "lucide-react";

import VersionWatcher from "@/components/VersionWatcher";
import logoWebp from "@/assets/logo.webp";
import RevealAnimation, {
  REVEAL_ANIMATION_RESULT_DELAY_MS,
} from "@/components/spin/RevealAnimation";
import type {
  PageTheme,
  PageThemeElement,
  RevealAnimation as RevealAnimationType,
} from "@/lib/db/types";
import {
  themeElementBoxStyle,
  computePointerBoxStyle,
  pointerReadingAngleDeg,
} from "@/lib/theme/geometry";

type UserInfo = { name: string; phone: string };
type ActiveTab = "spin" | "rewards";
type SpinReward = {
  id: string;
  label: string;
  code?: string | null;
  type: "voucher" | "item";
  voucherDelayMinutes?: number;
  voucherUsableFrom?: string | null;
  voucherExpiresAt?: string | null;
};
type WalletItem = SpinReward & {
  quantity: number;
  redeemableSpinId: string;
};
type SavedProfile = { name: string; phone: string };
type WheelSlice = {
  slotIndex: number;
  startAngle: number;
  endAngle: number;
  prizeId: string | null;
};
type WheelData = {
  ready: boolean;
  campaignOpen: boolean;
  walletEnabled: boolean;
  minInvoiceAmount?: number | null;
  wheelFace?: { imagePath: string; sliceCount: number };
  slices?: WheelSlice[];
};

const ACTIVE_TAB_KEY = "xfc-active-tab-v1";
const PROFILE_KEY = "xfc-profile-v1";

const rewardVisuals: Record<
  number,
  { emoji: string; accent: string; soft: string; shortLabel: string }
> = {
  0: { emoji: "🧋", accent: "#b45309", soft: "#fef3c7", shortLabel: "Topping" },
  1: {
    emoji: "🥤",
    accent: "#b91c1c",
    soft: "#fee2e2",
    shortLabel: "Trà sữa(M)",
  },
  2: {
    emoji: "🥥",
    accent: "#9a3412",
    soft: "#ffedd5",
    shortLabel: "Nước dừa(L)",
  },
  3: {
    emoji: "🍋",
    accent: "#4d7c0f",
    soft: "#ecfccb",
    shortLabel: "Trà Trái cây(L)",
  },
};



function formatTime(value?: string | null) {
  if (!value) return null;
  try {
    // Dùng fixed format thay vì toLocaleString để tránh hydration mismatch
    const d = new Date(value);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  } catch {
    return value;
  }
}

function isVoucherExpired(expiresAt?: string | null) {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() < Date.now();
}

function isVoucherNotUsableYet(usableFrom?: string | null) {
  if (!usableFrom) return false;
  return Date.now() < new Date(usableFrom).getTime();
}

function getRewardConditionNote(reward?: { id: number } | null) {
  if (!reward) return null;
  if (reward.id === 0) return "Không áp dụng cho topping 10k";
  if (reward.id === 2)
    return "Không áp dụng cho nước dừa  full topping thủ công.";
  if (reward.id === 1) return `Chỉ áp dụng cho mục "Trà sữa chí cốt"`;
  if (reward.id === 3) return `Áp dụng toàn bộ trong nhóm thanh xuân`;

  return null;
}

function getRewardCodeDescription(code?: string | null) {
  if (!code) return null;
  switch (code) {
    case "TRA-TRAI-CAY-L":
      return "Áp dụng cho toàn bộ nhóm thanh xuân";
    case "TRA-SUA-M":
      return `Không áp dụng cho trà sữa fulltopping`;
    case "TOPPING":
      return "Không áp dụng cho topping 10k";
    case "NUOCDUA-L":
      return "Không áp dụng cho nước dừa full topping thủ công";
    default:
      return code;
  }
}

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function RewardIcon({
  rewardId,
  size = "md",
}: {
  rewardId: number;
  size?: "sm" | "md" | "lg";
}) {
  const visual = rewardVisuals[rewardId] ?? rewardVisuals[0];
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
      {visual.emoji}
    </div>
  );
}

function Modal({
  open,
  title,
  children,
  onClose,
  closeOnBackdrop = true,
}: {
  open: boolean;
  title?: string;
  children: React.ReactNode;
  onClose?: () => void;
  closeOnBackdrop?: boolean;
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
            onClick={closeOnBackdrop ? onClose : undefined}
          />
          <motion.div
            className="relative z-10 w-full max-w-sm rounded-[28px] p-6 shadow-2xl"
            style={{
              backgroundImage: "url('/images/background.webp')",
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.96 }}
          >
            {onClose && (
              <button
                type="button"
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

/** Renders one admin-placed decorative `image`/`text` element (never
 * `wheel_disk`/`pointer`, those are rendered specially so they can stay in
 * sync with the live spin animation/rotation math). */
function ThemeDecorElement({ element }: { element: PageThemeElement }) {
  if (element.kind === "text") {
    return (
      <div
        className="pointer-events-none flex items-center justify-center text-center font-black"
        style={{
          ...themeElementBoxStyle(element),
          color: element.textColor ?? "#8f111a",
          fontSize: element.fontSize ? `${element.fontSize}px` : undefined,
        }}
      >
        {element.textContent}
      </div>
    );
  }
  return (
    <div className="pointer-events-none" style={themeElementBoxStyle(element)}>
      <Image
        src={element.imagePath ?? ""}
        alt=""
        fill
        sizes="200px"
        unoptimized={element.imagePath?.startsWith("http")}
        className="object-contain"
      />
    </div>
  );
}

export default function PageContent() {
  const searchParams = useSearchParams();
  const storeCode = (searchParams.get("store") ?? "").trim();
  const [activeTab, setActiveTab] = useState<ActiveTab>("spin");
  const [userInfo, setUserInfo] = useState<UserInfo>({ name: "", phone: "" });
  const [invoiceAmountInput, setInvoiceAmountInput] = useState("");
  const [walletItems, setWalletItems] = useState<WalletItem[]>([]);
  const [wheelData, setWheelData] = useState<WheelData>({
    ready: false,
    campaignOpen: false,
    walletEnabled: false,
  });
  const [theme, setTheme] = useState<PageTheme | null>(null);
  const [themeElements, setThemeElements] = useState<PageThemeElement[]>([]);
  const [dailyLimitReached, setDailyLimitReached] = useState(false);
  const [dailyUsageLimitReached, setDailyUsageLimitReached] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [duration, setDuration] = useState(5200);
  const [formError, setFormError] = useState("");
  const [resultOpen, setResultOpen] = useState(false);
  const [preSpinOpen, setPreSpinOpen] = useState(false);
  const [rewardResult, setRewardResult] = useState<SpinReward | null>(null);
  const [showUnboxAnimation, setShowUnboxAnimation] = useState(false);
  const [rulesPopupOpen, setRulesPopupOpen] = useState(false);
  const [usedVoucherOpen, setUsedVoucherOpen] = useState(false);
  const [usedVoucherInfo, setUsedVoucherInfo] = useState<WalletItem | null>(
    null,
  );
  const [useRewardLoading, setUseRewardLoading] = useState(false);
  const [localDataReady, setLocalDataReady] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<{
    spinId: string;
    phone: string;
  } | null>(null);
  const [confirmUseLoading, setConfirmUseLoading] = useState(false);
  const [confirmError, setConfirmError] = useState("");
  const spinSectionRef = useRef<HTMLDivElement | null>(null);
  const buttonSectionRef = useRef<HTMLDivElement | null>(null);
  const phoneRegex = /^(0|84)(3|5|7|8|9)([0-9]{8})$/;

  const loadWalletItems = async (phone: string) => {
    if (!phone) {
      setWalletItems([]);
      return;
    }
    try {
      const res = await fetch(
        `/api/wallet?phone=${encodeURIComponent(phone)}`,
      );
      const json = await res.json();
      const items: WalletItem[] = (json.items ?? []).map((it: any) => ({
        id: it.prizeId,
        label: it.label,
        code: it.code,
        type: "voucher" as const,
        quantity: it.quantity,
        redeemableSpinId: it.redeemableSpinId,
        voucherUsableFrom: it.nextUsableFrom,
        voucherExpiresAt: it.nextExpiresAt,
      }));
      setWalletItems(items);
    } catch {
      /* best-effort refresh; keep previously loaded items on failure */
    }
  };

  const pointerElement = useMemo(
    () => themeElements.find((e) => e.kind === "pointer"),
    [themeElements],
  );
  const wheelDiskElement = useMemo(
    () => themeElements.find((e) => e.kind === "wheel_disk"),
    [themeElements],
  );
  const headerDecorElements = useMemo(
    () =>
      themeElements.filter(
        (e) => e.canvas === "header" && (e.kind === "image" || e.kind === "text"),
      ),
    [themeElements],
  );
  const wheelDecorElements = useMemo(
    () =>
      themeElements.filter(
        (e) => e.canvas === "wheel" && (e.kind === "image" || e.kind === "text"),
      ),
    [themeElements],
  );
  /** Where the arrow actually points on screen — not just its angle around
   * the wheel, which says nothing once it's parked on the hub. The spin has
   * to stop the winning slice here or the wheel and the result modal disagree. */
  const pointerAngleDeg = useMemo(
    () => (pointerElement ? pointerReadingAngleDeg(wheelDiskElement, pointerElement) : 0),
    [pointerElement, wheelDiskElement],
  );
  const revealAnimation: RevealAnimationType = theme?.revealAnimation ?? "box_open";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/wheel/active");
        const json = (await res.json()) as WheelData;
        if (!cancelled) setWheelData(json);
      } catch {
        if (!cancelled)
          setWheelData({ ready: false, campaignOpen: false, walletEnabled: false });
      }
      try {
        const res = await fetch("/api/theme/active");
        const json = await res.json();
        if (!cancelled) {
          setTheme(json.theme ?? null);
          setThemeElements(json.elements ?? []);
        }
      } catch {
        /* fall back to the built-in defaults rendered when theme is null */
      }
      const savedProfile = readJson<SavedProfile>(PROFILE_KEY);
      if (savedProfile && !cancelled) {
        setUserInfo(savedProfile);
        void loadWalletItems(savedProfile.phone);
      }
      const savedTab = window.sessionStorage.getItem(ACTIVE_TAB_KEY);
      if ((savedTab === "spin" || savedTab === "rewards") && !cancelled) {
        setActiveTab(savedTab);
      }
      if (!cancelled) setLocalDataReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Tab khác ghi localStorage → đồng bộ state (bổ sung cho BroadcastChannel). */

  useEffect(() => {
    window.sessionStorage.setItem(ACTIVE_TAB_KEY, activeTab);
  }, [activeTab]);

  useEffect(() => {
    const hasShownRulesPopup = window.sessionStorage.getItem(
      "xfc-rules-shown-this-session",
    );
    if (!hasShownRulesPopup) {
      setRulesPopupOpen(true);
      window.sessionStorage.setItem("xfc-rules-shown-this-session", "true");
    }
  }, []);

  // Auto-scroll to button section on page load
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (buttonSectionRef.current) {
        buttonSectionRef.current.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    }, 800);
    return () => window.clearTimeout(timer);
  }, []);

  // Khi spin kết thúc → bắt đầu animation unbox
  useEffect(() => {
    if (!isSpinning) return;
    const timer = window.setTimeout(() => {
      setIsSpinning(false);
      setShowUnboxAnimation(true);
      confetti({
        particleCount: 140,
        spread: 72,
        origin: { y: 0.58 },
        colors: ["#d81b21", "#ffd700", "#fff8dc"],
      });
    }, duration + 60);
    return () => window.clearTimeout(timer);
  }, [duration, isSpinning]);

  // Mỗi hiệu ứng mở quà có nhịp riêng — độ trễ trước khi mở popup kết quả
  // tương ứng theo REVEAL_ANIMATION_RESULT_DELAY_MS.
  useEffect(() => {
    if (!showUnboxAnimation) return;
    const timer = window.setTimeout(() => {
      setResultOpen(true);
    }, REVEAL_ANIMATION_RESULT_DELAY_MS[revealAnimation]);
    return () => window.clearTimeout(timer);
  }, [showUnboxAnimation, revealAnimation]);

  const groupedWallet = useMemo(
    () => [...walletItems].sort((a, b) => b.quantity - a.quantity),
    [walletItems],
  );

  const persistProfile = (profile: SavedProfile) => {
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  };


  const readProfileFromState = () => ({
    name: userInfo.name.trim(),
    phone: userInfo.phone.trim(),
  });

  const isProfileValid = (profile: { name: string; phone: string }) =>
    Boolean(profile.name && profile.phone && phoneRegex.test(profile.phone));

  async function submitSpin(
    name: string,
    phone: string,
    invoiceAmount?: number | null,
  ) {
    setFormError("");
    setLoading(true);
    try {
      const res = await fetch("/api/spin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeCode, name, phone, invoiceAmount }),
      });
      const json = await res.json();

      if (!res.ok) {
        if (json.error === "daily_limit_reached") setDailyLimitReached(true);
        setFormError(json.message ?? "Có lỗi xảy ra khi quay vòng quay.");
        return;
      }

      const sliceStart = json.slice.startAngle as number;
      const sliceEnd = json.slice.endAngle as number;
      const sliceCenter = (sliceStart + sliceEnd) / 2;
      const sliceWidth = sliceEnd - sliceStart;
      const extraSpins = 6 + Math.floor(Math.random() * 3);
      const offset = (Math.random() - 0.5) * (sliceWidth * 0.42);
      const target =
        extraSpins * 360 +
        ((pointerAngleDeg - sliceCenter + 360) % 360) +
        offset;
      const duration = 3000 + Math.floor(Math.random() * 800);

      const spinReward: SpinReward = {
        id: json.prize.id,
        label: json.prize.label,
        code: json.prize.code,
        type: json.wallet?.enabled ? "voucher" : "item",
        voucherDelayMinutes: 0,
        voucherUsableFrom: json.wallet?.usableFrom ?? null,
        voucherExpiresAt: json.wallet?.expiresAt ?? null,
      };

      persistProfile({ name, phone });
      setDuration(duration);
      setRotation((prev) => prev + target - (prev % 360));
      setRewardResult(spinReward);
      setPendingConfirm({ spinId: json.spinId, phone });
      setConfirmError("");
      setPreSpinOpen(false);
      setInvoiceAmountInput("");
      setIsSpinning(true);
      void loadWalletItems(phone);
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Có lỗi xảy ra khi quay vòng quay.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSpinSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!wheelData.campaignOpen) {
      return setFormError("Chương trình quay thưởng đã kết thúc.");
    }
    const profile = readProfileFromState();
    if (!profile.name || !profile.phone)
      return setFormError("Vui lòng nhập đầy đủ họ tên và số điện thoại.");
    if (!phoneRegex.test(profile.phone))
      return setFormError("Vui lòng nhập số điện thoại Việt Nam hợp lệ.");
    const minInvoiceAmount = wheelData.minInvoiceAmount;
    let invoiceAmount: number | null = null;
    if (minInvoiceAmount != null) {
      invoiceAmount = Number(invoiceAmountInput.replace(/[^\d]/g, ""));
      if (!invoiceAmountInput || !Number.isFinite(invoiceAmount) || invoiceAmount <= 0)
        return setFormError("Vui lòng nhập số tiền hoá đơn.");
      if (invoiceAmount < minInvoiceAmount)
        return setFormError(
          `Hoá đơn phải từ ${minInvoiceAmount.toLocaleString("vi-VN")}đ trở lên mới được quay.`,
        );
    }
    await submitSpin(profile.name, profile.phone, invoiceAmount);
  }

  async function handleSpinStart() {
    if (isSpinning || dailyLimitReached || !storeCode || !wheelData.campaignOpen)
      return;
    const profile = readProfileFromState();
    if (isProfileValid(profile) && wheelData.minInvoiceAmount == null) {
      await submitSpin(profile.name, profile.phone);
      return;
    }
    setFormError("");
    setPreSpinOpen(true);
  }

  /** The result popup only closes via this — no backdrop/X close — so the
   * spin is explicitly acknowledged (and, for wallet-mode spins that are
   * immediately usable, marked redeemed) before dismissing. */
  async function handleConfirmUsed() {
    setConfirmError("");
    const confirm = pendingConfirm;
    const notYetUsable =
      rewardResult?.type === "voucher" &&
      rewardResult.voucherUsableFrom != null &&
      new Date(rewardResult.voucherUsableFrom).getTime() > Date.now();

    if (!confirm || rewardResult?.type !== "voucher" || notYetUsable) {
      setPendingConfirm(null);
      handleCloseResult();
      return;
    }

    setConfirmUseLoading(true);
    try {
      const res = await fetch("/api/voucher/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spinId: confirm.spinId, phone: confirm.phone }),
      });
      const json = await res.json();
      if (!res.ok && json.error !== "already_used") {
        setConfirmError(json.message ?? "Không thể xác nhận sử dụng lúc này.");
        return;
      }
      void loadWalletItems(confirm.phone);
    } catch {
      setConfirmError("Không thể xác nhận sử dụng lúc này.");
      return;
    } finally {
      setConfirmUseLoading(false);
    }
    setPendingConfirm(null);
    handleCloseResult();
  }

  async function handleUseReward(prizeId: string) {
    const savedProfile = readJson<SavedProfile>(PROFILE_KEY);
    if (!savedProfile?.phone)
      return setFormError(
        "Chưa tìm thấy thông tin người chơi để sử dụng voucher.",
      );
    const target = walletItems.find((item) => item.id === prizeId);
    if (!target) return;
    setUseRewardLoading(true);
    try {
      const res = await fetch("/api/voucher/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spinId: target.redeemableSpinId,
          phone: savedProfile.phone,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (json.error === "daily_usage_limit_reached")
          setDailyUsageLimitReached(true);
        throw new Error(json.message ?? "Không thể sử dụng voucher lúc này.");
      }

      setFormError("");
      setUsedVoucherInfo(target);
      setUsedVoucherOpen(true);
      void loadWalletItems(savedProfile.phone);
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Không thể sử dụng voucher lúc này.",
      );
    } finally {
      setUseRewardLoading(false);
    }
  }

  function handleCloseResult() {
    setResultOpen(false);
    setShowUnboxAnimation(false);
    if (wheelData.walletEnabled) setActiveTab("rewards");
  }

  if (!localDataReady) {
    return (
      <main className="relative min-h-screen overflow-hidden bg-[#f7ead1] text-[#571017]">
        <Modal open={true} title="Đang tải" closeOnBackdrop={false}>
          <div className="space-y-3 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#d81b21]/10 text-[#d81b21]">
              <Lock size={24} />
            </div>
            <p className="text-sm font-semibold text-[#6c1a1f]">
              Đang đọc dữ liệu đã lưu trên máy của bạn…
            </p>
          </div>
        </Modal>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f7ead1] text-[#571017]">
      <VersionWatcher />
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: theme?.backgroundColor ?? "#f7ead1",
        }}
      >
        <Image
          src={theme?.backgroundImagePath ?? "/images/background.webp"}
          alt="Background XingFuCha"
          fill
          priority
          sizes="100vw"
          unoptimized={theme?.backgroundImagePath?.startsWith("http")}
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,248,220,0.5)_0%,rgba(253,245,230,0.68)_36%,rgba(249,228,191,0.82)_100%)]" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-[440px] flex-col px-4 pb-8 pt-4">
        <header
          className="rounded-[30px] border border-white/70 p-4 shadow-[0_20px_40px_rgba(120,24,30,0.08)] backdrop-blur"
          style={{
            backgroundImage: "url('/images/background.webp')",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="relative h-14 w-14 overflow-hidden rounded-full border-2 border-white bg-transparent ">
                <Image
                  src={logoWebp}
                  alt="Logo XingFuCha"
                  fill
                  sizes="64px"
                  className="object-contain"
                />
              </div>
              <div className="flex flex-col items-start align-left">
                <p className="mt-1 text-xs font-semibold text-[#6c1a1f]">
                  Vòng Xing May Mắn
                </p>
                <div className="mt-0.5 h-5 w-20 flex items-center -ml-1">
                  <Image
                    src="/images/logo_text.webp"
                    alt="XingFuCha"
                    width={80}
                    height={20}
                    className="object-contain"
                  />
                </div>
              </div>
            </div>
            {wheelData.walletEnabled && (
              <div className="rounded-full bg-[#d81b21]/10 px-3 py-1 text-[11px] font-bold text-[#b71721]">
                Kho quà nhà Xing
              </div>
            )}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-2 rounded-2xl bg-white p-3 text-sm text-[#6c1a1f]">
            <p>
              <span className="font-bold">Khách hàng:</span>{" "}
              {userInfo.name.trim() || "Chưa cập nhật"}
            </p>
            <p>
              <span className="font-bold">SĐT:</span>{" "}
              {userInfo.phone.trim() || "Chưa cập nhật"}
            </p>
            
          </div>

          {wheelData.walletEnabled && (
            <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-white p-1.5">
              {(["spin", "rewards"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`rounded-2xl px-4 py-3 text-sm font-extrabold transition ${activeTab === tab ? "bg-[#d81b21] text-white shadow-[0_10px_20px_rgba(216,27,33,0.22)]" : "text-[#8f111a]"}`}
                >
                  {tab === "spin" ? "Vòng Xing May Mắn" : "Phần thưởng của bạn"}
                </button>
              ))}
            </div>
          )}
        </header>

        {activeTab === "spin" || !wheelData.walletEnabled ? (
          <>
            <section
              ref={spinSectionRef}
              className="relative mt-6 rounded-[34px] px-3 sm:px-4 pb-6 pt-7 shadow-[0_24px_48px_rgba(120,24,30,0.12)]"
              style={{
                backgroundColor: theme?.sectionBackgroundColor ?? undefined,
                backgroundImage: `url('${theme?.sectionBackgroundImagePath ?? "/images/nenchosectionvongquay.webp"}')`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              <div className="relative mx-auto h-[112px] max-w-[320px]">
                {headerDecorElements.map((element) => (
                  <ThemeDecorElement key={element.id} element={element} />
                ))}
              </div>

              {/* Wrapper relative để các icon absolute tràn ra ngoài */}
              <div className="relative mx-auto mt-2 w-full max-w-[420px] sm:max-w-[460px] h-[420px] sm:h-[460px]">
                {themeElements
                  .filter((element) => element.canvas === "wheel")
                  .map((element) => {
                    if (element.kind === "wheel_disk") {
                      return (
                        <motion.div
                          key={element.id}
                          animate={{ rotate: rotation }}
                          transition={{
                            duration: duration / 1000,
                            ease: [0.12, 0, 0.2, 1],
                          }}
                          className="rounded-full cursor-pointer"
                          style={themeElementBoxStyle(element)}
                          onClick={handleSpinStart}
                          role="button"
                          aria-label="Quay ngay"
                        >
                          <Image
                            src={wheelData.wheelFace?.imagePath ?? "/images/vongtron.webp"}
                            alt="Mặt vòng quay"
                            unoptimized={wheelData.wheelFace?.imagePath?.startsWith("http")}
                            fill
                            sizes="(max-width: 640px) 290px, 310px"
                            className="object-contain"
                          />
                        </motion.div>
                      );
                    }
                    if (element.kind === "pointer") {
                      return (
                        <div
                          key={element.id}
                          className="pointer-events-none"
                          style={computePointerBoxStyle(wheelDiskElement, element)}
                        >
                          <Image
                            src={element.imagePath ?? "/images/muiten.webp"}
                            alt="Mũi tên vòng quay"
                            fill
                            sizes="180px"
                            className="object-contain drop-shadow-[0_8px_16px_rgba(120,24,30,0.22)]"
                          />
                        </div>
                      );
                    }
                    return <ThemeDecorElement key={element.id} element={element} />;
                  })}
              </div>
            </section>

            <section
              className="mt-5 flex flex-col gap-4"
              ref={buttonSectionRef}
            >
              <button
                type="button"
                onClick={handleSpinStart}
                disabled={
                  isSpinning ||
                  dailyLimitReached ||
                  !storeCode ||
                  !wheelData.campaignOpen
                }
                className="w-full mt-6 rounded-[24px] border-2 border-white px-8 py-4 text-2xl font-black shadow-[0_8px_0_rgb(139,25,32)] transition active:translate-y-1 active:shadow-none disabled:opacity-70"
                style={{
                  backgroundColor: theme?.spinButtonColor ?? "#d81b21",
                  color: theme?.spinButtonTextColor ?? "#f2f6dd",
                }}
              >
                {isSpinning
                  ? "Đang quay..."
                  : !wheelData.campaignOpen
                    ? "Quá hạn thời gian quay"
                    : dailyLimitReached
                      ? "Đã hết lượt quay hôm nay"
                      : (theme?.spinButtonText ?? "Quay ngay")}
              </button>

              {formError && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm font-semibold text-red-700">
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
                <Modal
                  open={rulesPopupOpen}
                  title="Thể Lệ Vòng Quay"
                  closeOnBackdrop={false}
                >
                  <div className="space-y-3 text-sm font-semibold leading-6 text-[#6c1a1f] bg-white p-2 rounded-xl">
                    <p>
                      Voucher có thể dùng ngay sau khi trúng, hết hạn sau 1
                      tháng và mỗi ngày dùng tối đa 3 voucher.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRulesPopupOpen(false)}
                    className="mt-5 w-full rounded-2xl bg-[#d81b21] px-4 py-3 text-sm font-bold text-white"
                  >
                    Đã hiểu
                  </button>
                </Modal>
                <p className="text-sm font-bold uppercase tracking-[0.22em] text-[#b71721]/75">
                  Kho quà nhà Xing
                </p>
                <h2 className="text-2xl font-black text-[#8f111a] ">
                  Phần thưởng của bạn
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
                    <div className="flex items-center gap-3">
                      <div className="relative h-26 w-26 flex-shrink-0">
                        <Image
                          src="/images/logo.webp"
                          alt="Logo XingFuCha"
                          fill
                          sizes="64px"
                          className="object-contain"
                        />
                      </div>
                      <div className="min-w-0">
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
                      <div
                        className="mt-3  inline-flex rounded-xl border border-[#f3cf8c] bg-[#fff8dc] px-3 py-2 font-mono text-sm font-bold tracking-tighter text-[#8f111a] "
                        style={{ wordSpacing: "-2px" }}
                      >
                        {getRewardCodeDescription(item.code)}
                      </div>
                    )}
                    <div className="mt-3 space-y-1.5 text-sm leading-6 text-[#6c1a1f]">
                      {item.type === "voucher" && (
                        <p>
                          Hạn sử dụng:{" "}
                          <span className="font-bold">
                            {formatTime(item.voucherUsableFrom) ??
                              `Sau ${item.voucherDelayMinutes ?? 0} phút`}
                          </span>{" "}
                          -{" "}
                          <span className="font-bold">
                            {formatTime(item.voucherExpiresAt) ?? "-"}
                          </span>
                        </p>
                      )}
                      {item.type === "voucher" && (
                        <p className="rounded-2xl bg-[#fff8dc] px-3 py-2 text-xs font-semibold leading-5 text-[#8f111a]">
                          Điều kiện: Voucher được áp dụng cho hóa đơn 40K
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        void handleUseReward(item.id);
                      }}
                      disabled={
                        dailyUsageLimitReached ||
                        item.quantity <= 0 ||
                        useRewardLoading ||
                        isVoucherNotUsableYet(item.voucherUsableFrom) ||
                        isVoucherExpired(item.voucherExpiresAt)
                      }
                      className="mt-3 w-full rounded-2xl bg-[#d81b21] px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {useRewardLoading
                        ? "Đang xử lý..."
                        : isVoucherNotUsableYet(item.voucherUsableFrom)
                          ? "Chưa tới hạn sử dụng"
                          : isVoucherExpired(item.voucherExpiresAt)
                            ? "Voucher đã hết hạn"
                            : dailyUsageLimitReached
                              ? "Hôm nay đã dùng đủ 3 voucher"
                              : "Sử dụng voucher này"}
                    </button>
                  </div>
                ))}
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
                  Hãy quay ở tab “Vòng Xing May Mắn”, quà trúng sẽ tự cộng dồn
                  vào kho quà của bạn.
                </p>
              </div>
            )}
          </section>
        )}
      </div>

      <RevealAnimation variant={revealAnimation} playing={showUnboxAnimation} />

      {/* ─── MODAL THÔNG TIN NGƯỜI CHƠI ─── */}
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
                placeholder="0901234567"
                className="w-full rounded-2xl border-2 border-gray-100 bg-gray-50 py-3 pl-12 pr-4 outline-none transition focus:border-[#d81b21]"
                value={userInfo.phone}
                onChange={(e) =>
                  setUserInfo((prev) => ({ ...prev, phone: e.target.value }))
                }
              />
            </div>
          </div>
          {wheelData.minInvoiceAmount != null && (
            <div className="space-y-1">
              <label className="ml-1 text-sm font-bold text-gray-700">
                Số tiền hoá đơn (đ)
              </label>
              <div className="relative">
                <input
                  type="tel"
                  inputMode="numeric"
                  placeholder={`Từ ${wheelData.minInvoiceAmount.toLocaleString("vi-VN")}đ trở lên`}
                  className="w-full rounded-2xl border-2 border-gray-100 bg-gray-50 py-3 pl-4 pr-4 outline-none transition focus:border-[#d81b21]"
                  value={invoiceAmountInput}
                  onChange={(e) =>
                    setInvoiceAmountInput(e.target.value.replace(/[^\d]/g, ""))
                  }
                />
              </div>
              <p className="ml-1 text-xs font-medium text-gray-500">
                Vui lòng nhập đúng số tiền trên hoá đơn để đủ điều kiện quay.
              </p>
            </div>
          )}
          {formError && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm font-semibold text-red-700">
              {formError}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#d81b21] py-4 font-bold text-white shadow-lg disabled:opacity-60"
          >
            {loading ? "Đang xử lý..." : "Bắt đầu quay"}
            {!loading && <ChevronRight size={18} />}
          </button>
        </form>
      </Modal>

      {/* ─── MODAL KẾT QUẢ VOUCHER ─── */}
      {/* Chỉ hiện sau khi animation unbox kết thúc (4000ms). Chỉ đóng được
          bằng nút "Xác nhận đã dùng" — không có nút X, không tắt khi bấm ra
          ngoài — để đảm bảo khách/nhân viên đã xác nhận trước khi tắt. */}
      <Modal open={resultOpen} closeOnBackdrop={false}>
        <motion.div
          className="text-center"
          initial={{ opacity: 0, scale: 0.88 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        >
          <motion.div
            className="mx-auto -mb-8 flex justify-center"
            initial={{ y: -16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.4 }}
          >
            {rewardResult ? (
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 0.6, repeat: 3, ease: "easeInOut" }}
              >
                <div className="relative h-40 w-40 -mt-12">
                  <Image
                    src="/images/logo.webp"
                    alt="Logo XingFuCha"
                    fill
                    sizes="120px"
                    className="object-contain"
                  />
                </div>
              </motion.div>
            ) : (
              <motion.div
                className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#fff8dc] text-3xl"
                animate={{ scale: [1, 1.15, 1], rotate: [0, 5, -5, 0] }}
                transition={{ duration: 0.6, repeat: 3, ease: "easeInOut" }}
              >
                🎉
              </motion.div>
            )}
          </motion.div>
          <div className="bg-white rounded-xl p-2 mb-6">
            <motion.h2
              className="text-3xl font-black text-[#8f111a]"
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.15, duration: 0.4 }}
            >
              Chúc mừng!
            </motion.h2>
            <motion.p
              className="mt-2 text-sm font-medium text-gray-600"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.25, duration: 0.3 }}
            >
              {rewardResult?.type === "voucher"
                ? "Quà vừa trúng đã được cộng dồn vào kho quà của bạn."
                : "Vui lòng đưa màn hình này cho nhân viên để nhận quà ngay."}
            </motion.p>
          </div>
          <motion.div
            className="mt-6 rounded-[28px] border-2 border-dashed border-[#f3cf8c] bg-[#fff8dc] p-6"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.4 }}
          >
            <p className="text-2xl font-black tracking-tight text-[#d81b21]">
              {rewardResult?.label}
            </p>

            {rewardResult?.type === "voucher" && (
              <div className="mt-2 space-y-2 text-xs font-medium leading-6 text-gray-600 text-left ml-2">
                <p>
                  Voucher dùng từ{" "}
                  {formatTime(rewardResult.voucherUsableFrom) ??
                    "ngay sau khi quay"}
                  .
                </p>
                <p className="-mt-2">
                  Voucher hết hạn vào{" "}
                  {formatTime(rewardResult.voucherExpiresAt) ?? "-"}.
                </p>
              </div>
            )}
          </motion.div>

          {confirmError && (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm font-semibold text-red-700">
              {confirmError}
            </div>
          )}
          <button
            type="button"
            onClick={() => void handleConfirmUsed()}
            disabled={confirmUseLoading}
            className="mt-6 w-full rounded-2xl bg-[#d81b21] px-4 py-3 text-sm font-bold text-white shadow-lg disabled:opacity-60"
          >
            {confirmUseLoading ? "Đang xác nhận..." : "Xác nhận đã dùng"}
          </button>
        </motion.div>
      </Modal>

      <Modal
        open={usedVoucherOpen}
        title="Đã sử dụng voucher"
        closeOnBackdrop={false}
      >
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 ring-4 ring-emerald-50">
            <CheckCircle2 size={34} className="text-emerald-600" />
          </div>

          {usedVoucherInfo && (
            <div className="rounded-2xl border border-[#f3cf8c] bg-[#fff8dc] p-4">
              <div className="-mb-4 -mt-8 flex justify-center">
                <div className="relative h-32 w-32">
                  <Image
                    src="/images/logo.webp"
                    alt="Logo XingFuCha"
                    fill
                    sizes="150px"
                    className="object-contain"
                  />
                </div>
              </div>
              <p className="text-lg font-black text-[#d81b21]">
                {usedVoucherInfo.label}
              </p>

              <div className="mt-3 space-y-2">
                {usedVoucherInfo.code && (
                  <div className="inline-flex rounded-xl border border-[#f3cf8c] bg-white px-3 py-2 font-mono text-xs font-bold tracking-wider text-[#8f111a]">
                    {getRewardCodeDescription(usedVoucherInfo.code)}
                  </div>
                )}
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              setUsedVoucherOpen(false);
              setUsedVoucherInfo(null);
            }}
            className="w-full rounded-2xl bg-[#d81b21] px-4 py-3 text-sm font-bold text-white"
          >
            Đóng
          </button>
        </div>
      </Modal>
    </main>
  );
}
