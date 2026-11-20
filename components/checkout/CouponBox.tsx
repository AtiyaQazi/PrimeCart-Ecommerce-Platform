
"use client";

import { useEffect, useState } from "react";

export interface AppliedCoupon {
  code: string;
  name: string;
  type: "percentage" | "fixed" | "fixed_amount";
  value: number;
  minOrderValue: number;
}

interface Promotion {
  id?: string;
  name?: string;
  title?: string;
  code?: string;
  couponCode?: string;
  type?: string;
  discountType?: string;
  value?: number;
  discountValue?: number;
  discount?: number;
  amount?: number;
  minOrderValue?: number;
  minOrder?: number;
  minimumOrderValue?: number;
  minimumOrder?: number;
  minimumOrderAmount?: number;
  minimumPurchase?: number;
  minPurchase?: number;
  active?: boolean;
  isActive?: boolean;
  status?: string;
  startDate?: string;
  endDate?: string;
  [key: string]: unknown;
}

interface CouponBoxProps {
  subtotal: number;
  appliedCoupon: AppliedCoupon | null;
  onApply: (coupon: AppliedCoupon) => void;
  onRemove: () => void;
}

const STORAGE_KEY = "primecart-promotions";

function getMinimumOrder(promotion: Promotion): number {
  const value =
    promotion.minOrderValue ??
    promotion.minOrder ??
    promotion.minimumOrderValue ??
    promotion.minimumOrder ??
    promotion.minimumOrderAmount ??
    promotion.minimumPurchase ??
    promotion.minPurchase ??
    0;

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function getPromotionCode(promotion: Promotion): string {
  return String(promotion.code ?? promotion.couponCode ?? "")
    .trim()
    .toUpperCase();
}

function getPromotionValue(promotion: Promotion): number {
  const value =
    promotion.value ??
    promotion.discountValue ??
    promotion.discount ??
    promotion.amount ??
    0;

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function getPromotionType(
  promotion: Promotion
): "percentage" | "fixed" {
  const type = String(
    promotion.type ?? promotion.discountType ?? ""
  ).toLowerCase();

  return type.includes("percent") ? "percentage" : "fixed";
}

function isPromotionActive(promotion: Promotion): boolean {
  const active =
    promotion.active === true ||
    promotion.isActive === true ||
    String(promotion.status ?? "").toLowerCase() === "active";

  if (!active) return false;

  const now = new Date();

  if (promotion.startDate) {
    const startDate = new Date(promotion.startDate);

    if (!Number.isNaN(startDate.getTime()) && now < startDate) {
      return false;
    }
  }

  if (promotion.endDate) {
    const endDate = new Date(promotion.endDate);

    if (!Number.isNaN(endDate.getTime())) {
      endDate.setHours(23, 59, 59, 999);

      if (now > endDate) return false;
    }
  }

  return true;
}

export default function CouponBox({
  subtotal,
  appliedCoupon,
  onApply,
  onRemove,
}: CouponBoxProps) {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [couponCode, setCouponCode] = useState(
    appliedCoupon?.code ?? ""
  );
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<
    "success" | "error" | "info" | ""
  >("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);

      if (!saved) {
        setPromotions([]);
        return;
      }

      const parsed = JSON.parse(saved);

      const promotionList: Promotion[] = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.promotions)
          ? parsed.promotions
          : [];

      setPromotions(promotionList);
    } catch (error) {
      console.error("Error loading promotions:", error);
      setPromotions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const activeAppliedPromotion = appliedCoupon
    ? promotions.find(
        (promotion) =>
          getPromotionCode(promotion) ===
          appliedCoupon.code.trim().toUpperCase()
      )
    : undefined;

  // Remove a coupon if it becomes inactive, expires,
  // or the order subtotal falls below its minimum.
  useEffect(() => {
    if (!appliedCoupon || loading) return;

    const promotion = activeAppliedPromotion;

    if (!promotion || !isPromotionActive(promotion)) {
      onRemove();
      setCouponCode("");
      setMessage("This coupon is no longer available.");
      setMessageType("error");
      return;
    }

    const minimumOrder = getMinimumOrder(promotion);

    if (subtotal < minimumOrder) {
      const remaining = minimumOrder - subtotal;

      onRemove();
      setCouponCode("");
      setMessage(
        `Not applicable. Add Rs. ${remaining.toLocaleString()} more to use this voucher. Minimum order: Rs. ${minimumOrder.toLocaleString()}.`
      );
      setMessageType("error");
    }
  }, [
    subtotal,
    appliedCoupon,
    activeAppliedPromotion,
    loading,
    onRemove,
  ]);

  const applyCoupon = (rawCode: string) => {
    const enteredCode = rawCode.trim().toUpperCase();

    if (!enteredCode) return;

    const promotion = promotions.find(
      (item) => getPromotionCode(item) === enteredCode
    );

    if (!promotion || !isPromotionActive(promotion)) {
      setMessage("Invalid or expired coupon code.");
      setMessageType("error");
      return;
    }

    const minimumOrder = getMinimumOrder(promotion);

    if (subtotal < minimumOrder) {
      const remaining = minimumOrder - subtotal;

      setMessage(
        `Not applicable. Add Rs. ${remaining.toLocaleString()} more to use this voucher. Minimum order: Rs. ${minimumOrder.toLocaleString()}.`
      );
      setMessageType("error");
      return;
    }

    const value = getPromotionValue(promotion);

    if (value <= 0) {
      setMessage("This coupon has an invalid discount.");
      setMessageType("error");
      return;
    }

    const type = getPromotionType(promotion);

    if (type === "percentage" && value > 100) {
      setMessage("This coupon has an invalid discount percentage.");
      setMessageType("error");
      return;
    }

    const coupon: AppliedCoupon = {
      code: enteredCode,
      name: String(
        promotion.name ?? promotion.title ?? enteredCode
      ),
      type,
      value,
      minOrderValue: minimumOrder,
    };

    onApply(coupon);

    setCouponCode(enteredCode);
    setMessage("Coupon applied successfully!");
    setMessageType("success");
  };

  const handleCodeChange = (value: string) => {
    const normalizedCode = value.toUpperCase();

    setCouponCode(normalizedCode);
    setMessage("");
    setMessageType("");

    // If the customer changes an already applied coupon,
    // remove the previous discount first.
    if (
      appliedCoupon &&
      normalizedCode.trim() !== appliedCoupon.code.toUpperCase()
    ) {
      onRemove();
    }

    const enteredCode = normalizedCode.trim();

    if (!enteredCode) return;

    // Apply automatically only when the complete code matches.
    const matchingPromotion = promotions.find(
      (promotion) => getPromotionCode(promotion) === enteredCode
    );

    if (matchingPromotion) {
      applyCoupon(enteredCode);
    }
  };

  const handleRemove = () => {
    onRemove();
    setCouponCode("");
    setMessage("");
    setMessageType("");
  };

  return (
    <div className="w-full space-y-3">
      <label
        htmlFor="coupon-code"
        className="block text-sm font-semibold text-gray-800"
      >
        Coupon Code
      </label>

      <div className="flex w-full items-center gap-2">
        <input
          id="coupon-code"
          type="text"
          value={couponCode}
          onChange={(event) =>
            handleCodeChange(event.target.value)
          }
          onBlur={() => {
            const enteredCode = couponCode.trim().toUpperCase();

            if (!enteredCode || appliedCoupon) return;

            const matchingPromotion = promotions.find(
              (promotion) =>
                getPromotionCode(promotion) === enteredCode
            );

            if (!matchingPromotion) {
              setMessage("Invalid coupon code.");
              setMessageType("error");
            }
          }}
          placeholder="Enter coupon code"
          autoComplete="off"
          disabled={loading}
          className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm uppercase text-gray-800 outline-none transition placeholder:normal-case placeholder:text-gray-400 focus:border-[#2F7D72] focus:ring-2 focus:ring-[#2F7D72]/20 disabled:cursor-not-allowed disabled:bg-gray-100"
        />

        {appliedCoupon && (
          <button
            type="button"
            onClick={handleRemove}
            className="shrink-0 rounded-lg border border-red-200 px-4 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-50"
          >
            Remove
          </button>
        )}
      </div>

      {message && (
        <p
          className={`text-sm ${
            messageType === "success"
              ? "text-green-600"
              : messageType === "error"
                ? "text-red-600"
                : "text-gray-600"
          }`}
          role="status"
        >
          {message}
        </p>
      )}

      {appliedCoupon && messageType === "success" && (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2">
          <span className="text-sm font-medium text-green-700">
            {appliedCoupon.code} applied
          </span>
          <span className="text-xs text-green-600">
            Discount added to your order.
          </span>
        </div>
      )}
    </div>
  );
}