
"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import CouponBox, {
  type AppliedCoupon,
} from "@/components/checkout/CouponBox";

import {
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  MapPin,
  Package,
  Phone,
  ShoppingBag,
} from "lucide-react";

type CartItem = {
  id?: string | number;
  name?: string;
  price?: number;
  quantity?: number;
  image?: string;
};

type PaymentMethod = "cod" | "online";

const LOCAL_PRODUCT_IMAGES: Record<string, string> = {
  "artificial plant": "/products/artificial-plant.jpeg",
  "classic sunglasses": "/products/classic-sunglasses.jpeg",
  "portable mini fan": "/products/portable-mini-fan.jpg",
  "simple lace shawl": "/products/simple-lace-shawl.jpeg",
};

function normalizeName(name?: string) {
  return (name || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function getProductImage(name?: string, image?: string) {
  if (image?.trim()) {
    return image.trim();
  }

  return LOCAL_PRODUCT_IMAGES[normalizeName(name)] || "";
}

function formatPrice(price: number) {
  return `Rs. ${Number(price || 0).toLocaleString("en-PK")}`;
}

export default function CheckoutPage() {
  const router = useRouter();

  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [placingOrder, setPlacingOrder] = useState(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");

  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>("cod");

  const [payerName, setPayerName] = useState("");
  const [paymentNumber, setPaymentNumber] = useState("");
  const [transactionId, setTransactionId] = useState("");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState(false);

  const [appliedCoupon, setAppliedCoupon] =
    useState<AppliedCoupon | null>(null);

  // LOAD CART
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      // Read the Store cart first, then fallback to old cart key.
      const storedCart =
        localStorage.getItem("med-store-cart") ||
        localStorage.getItem("cart");

      if (storedCart) {
        const parsed = JSON.parse(storedCart);

        if (Array.isArray(parsed)) {
          setCartItems(parsed);
        } else {
          setCartItems([]);
        }
      } else {
        setCartItems([]);
      }
    } catch (error) {
      console.error("Unable to load cart:", error);
      setCartItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // SUBTOTAL
  const subtotal = cartItems.reduce((total, item) => {
    const price = Number(item.price || 0);
    const quantity = Number(item.quantity || 1);

    return total + price * quantity;
  }, 0);

  // COUPON DISCOUNT
  const discount = appliedCoupon
    ? Math.min(
        Math.max(0, Number(appliedCoupon.discount) || 0),
        subtotal
      )
    : 0;

  // FINAL TOTAL
  const orderTotal = Math.max(0, subtotal - discount);

  // FORM VALIDATION
  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!fullName.trim()) {
      newErrors.fullName = "Please enter your full name.";
    }

    if (!email.trim()) {
      newErrors.email = "Please enter your email.";
    } else if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    ) {
      newErrors.email = "Please enter a valid email address.";
    }

    if (!phone.trim()) {
      newErrors.phone = "Please enter your phone number.";
    } else if (
      !/^(03\d{9}|\+923\d{9})$/.test(
        phone.trim().replace(/[\s-]/g, "")
      )
    ) {
      newErrors.phone = "Please enter a valid Pakistani phone number.";
    }

    if (!city.trim()) {
      newErrors.city = "Please enter your city.";
    }

    if (!address.trim()) {
      newErrors.address = "Please enter your delivery address.";
    }

    if (paymentMethod === "online") {
      if (!payerName.trim()) {
        newErrors.payerName = "Please enter the payer name.";
      }

      if (!paymentNumber.trim()) {
        newErrors.paymentNumber =
          "Please enter your payment account or mobile number.";
      }

      if (!transactionId.trim()) {
        newErrors.transactionId =
          "Please enter your transaction/reference ID.";
      }
    }

    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;
  };

  // PLACE ORDER
  const handlePlaceOrder = async (event: FormEvent) => {
    event.preventDefault();

    if (!validateForm()) return;

    if (cartItems.length === 0) {
      alert("Your cart is empty.");
      return;
    }

    setPlacingOrder(true);

    try {
      const order = {
        customer: {
          fullName: fullName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          city: city.trim(),
          address: address.trim(),
        },

        items: cartItems.map((item) => ({
          id: item.id || "",
          name: item.name || "Unknown Product",
          price: Number(item.price || 0),
          quantity: Number(item.quantity || 1),
          image: getProductImage(item.name, item.image),
        })),

        subtotal,
        discount,
        couponCode: appliedCoupon?.code || "",
        couponName: appliedCoupon?.name || "",
        total: orderTotal,

        payment: {
          method: paymentMethod,
          status:
            paymentMethod === "online" ? "Paid" : "Pending",
          amount: orderTotal,
          payerName:
            paymentMethod === "online" ? payerName.trim() : "",
          paymentNumber:
            paymentMethod === "online"
              ? paymentNumber.trim()
              : "",
          transactionId:
            paymentMethod === "online"
              ? transactionId.trim()
              : "",
        },

        status: "Processing",
        createdAt: new Date().toISOString(),
      };

      const existingOrders = JSON.parse(
        localStorage.getItem("orders") || "[]"
      );

      const newOrder = {
        id: `ORD-${Date.now()}`,
        ...order,
      };

      localStorage.setItem(
        "orders",
        JSON.stringify([newOrder, ...existingOrders])
      );

      // Clear both cart keys after successful order placement.
      localStorage.removeItem("cart");
      localStorage.removeItem("med-store-cart");

      setSuccess(true);

      setTimeout(() => {
        router.push("/orders");
      }, 1500);
    } catch (error) {
      console.error("Order placement failed:", error);
      alert("Something went wrong while placing your order.");
    } finally {
      setPlacingOrder(false);
    }
  };

  const inputClass = (field: string) =>
    `w-full rounded-xl border px-4 py-3 text-sm outline-none transition ${
      errors[field]
        ? "border-red-500 focus:ring-2 focus:ring-red-100"
        : "border-gray-200 focus:border-[#2F7D72] focus:ring-2 focus:ring-[#2F7D72]/10"
    }`;

  // LOADING SCREEN
  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F2F8F6]">
        <div className="font-semibold text-[#2F7D72]">
          Loading checkout...
        </div>
      </main>
    );
  }

  // SUCCESS SCREEN
  if (success) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F2F8F6] px-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm">
          <CheckCircle2 className="mx-auto mb-4 h-16 w-16 text-[#2F7D72]" />

          <h1 className="text-2xl font-bold text-[#183B38]">
            Order Placed Successfully
          </h1>

          <p className="mt-2 text-gray-500">
            Your order has been placed successfully.
          </p>

          <div className="mt-5 rounded-xl bg-[#F2F8F6] p-4 text-left">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Subtotal</span>
              <span>{formatPrice(subtotal)}</span>
            </div>

            {discount > 0 && (
              <div className="mt-2 flex justify-between text-sm text-green-600">
                <span>Discount ({appliedCoupon?.code})</span>
                <span>- {formatPrice(discount)}</span>
              </div>
            )}

            <div className="mt-3 flex justify-between border-t border-gray-200 pt-3 font-bold text-[#183B38]">
              <span>Paid / Payable</span>
              <span>{formatPrice(orderTotal)}</span>
            </div>
          </div>

          <p className="mt-4 text-sm text-gray-400">
            Redirecting to your orders...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F2F8F6] px-4 py-8">
      <div className="mx-auto max-w-6xl">
        <button
          type="button"
          onClick={() => router.back()}
          className="mb-6 flex items-center gap-2 text-sm font-medium text-[#2F7D72] hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#183B38]">
            Checkout
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Complete your information to place your order.
          </p>
        </div>

        <form
          onSubmit={handlePlaceOrder}
          className="grid gap-6 lg:grid-cols-[1fr_380px]"
        >
          <div className="space-y-6">
            {/* DELIVERY INFORMATION */}
            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="mb-6 flex items-center gap-3">
                <div className="rounded-xl bg-[#2F7D72]/10 p-2">
                  <MapPin className="h-5 w-5 text-[#2F7D72]" />
                </div>

                <div>
                  <h2 className="text-lg font-bold text-[#183B38]">
                    Delivery Information
                  </h2>

                  <p className="text-sm text-gray-500">
                    Enter your delivery details.
                  </p>
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    Full Name
                  </label>

                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => {
                      setFullName(e.target.value);
                      setErrors((prev) => ({
                        ...prev,
                        fullName: "",
                      }));
                    }}
                    placeholder="Ayesha Khan"
                    className={inputClass("fullName")}
                  />

                  {errors.fullName && (
                    <p className="mt-1 text-xs text-red-500">
                      {errors.fullName}
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    Email
                  </label>

                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setErrors((prev) => ({
                        ...prev,
                        email: "",
                      }));
                    }}
                    placeholder="ayesha.khan@gmail.com"
                    className={inputClass("email")}
                  />

                  {errors.email && (
                    <p className="mt-1 text-xs text-red-500">
                      {errors.email}
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-2 flex items-center gap-1 text-sm font-semibold text-gray-700">
                    <Phone className="h-4 w-4" />
                    Phone
                  </label>

                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      setErrors((prev) => ({
                        ...prev,
                        phone: "",
                      }));
                    }}
                    placeholder="03001234567"
                    className={inputClass("phone")}
                  />

                  {errors.phone && (
                    <p className="mt-1 text-xs text-red-500">
                      {errors.phone}
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    City
                  </label>

                  <input
                    type="text"
                    value={city}
                    onChange={(e) => {
                      setCity(e.target.value);
                      setErrors((prev) => ({
                        ...prev,
                        city: "",
                      }));
                    }}
                    placeholder="Sukkur"
                    className={inputClass("city")}
                  />

                  {errors.city && (
                    <p className="mt-1 text-xs text-red-500">
                      {errors.city}
                    </p>
                  )}
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    Delivery Address
                  </label>

                  <textarea
                    value={address}
                    onChange={(e) => {
                      setAddress(e.target.value);
                      setErrors((prev) => ({
                        ...prev,
                        address: "",
                      }));
                    }}
                    placeholder="House 25, Street 4, Sukkur, Sindh, Pakistan"
                    rows={4}
                    className={inputClass("address")}
                  />

                  {errors.address && (
                    <p className="mt-1 text-xs text-red-500">
                      {errors.address}
                    </p>
                  )}
                </div>
              </div>
            </section>

            {/* PAYMENT METHOD */}
            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="mb-6 flex items-center gap-3">
                <div className="rounded-xl bg-[#2F7D72]/10 p-2">
                  <CreditCard className="h-5 w-5 text-[#2F7D72]" />
                </div>

                <div>
                  <h2 className="text-lg font-bold text-[#183B38]">
                    Payment Method
                  </h2>

                  <p className="text-sm text-gray-500">
                    Select your preferred payment method.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => {
                    setPaymentMethod("cod");
                    setErrors({});
                  }}
                  className={`rounded-xl border-2 p-5 text-left transition ${
                    paymentMethod === "cod"
                      ? "border-[#2F7D72] bg-[#2F7D72]/5"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-gray-800">
                        Cash on Delivery
                      </p>

                      <p className="mt-1 text-sm text-gray-500">
                        Pay when your order is delivered.
                      </p>
                    </div>

                    {paymentMethod === "cod" && (
                      <CheckCircle2 className="h-5 w-5 text-[#2F7D72]" />
                    )}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPaymentMethod("online");
                    setErrors({});
                  }}
                  className={`rounded-xl border-2 p-5 text-left transition ${
                    paymentMethod === "online"
                      ? "border-[#2F7D72] bg-[#2F7D72]/5"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-gray-800">
                        Online Payment
                      </p>

                      <p className="mt-1 text-sm text-gray-500">
                        Complete your payment details to place the order.
                      </p>
                    </div>

                    {paymentMethod === "online" && (
                      <CheckCircle2 className="h-5 w-5 text-[#2F7D72]" />
                    )}
                  </div>
                </button>
              </div>

              {paymentMethod === "online" && (
                <div className="mt-6 rounded-2xl border border-[#2F7D72]/20 bg-[#F2F8F6] p-5">
                  <div className="mb-5">
                    <h3 className="font-bold text-[#183B38]">
                      Online Payment
                    </h3>

                    <p className="mt-1 text-sm text-gray-500">
                      Enter your payment information below and confirm
                      the payment.
                    </p>
                  </div>

                  <div className="space-y-5">
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-gray-700">
                        Payer Name
                      </label>

                      <input
                        type="text"
                        value={payerName}
                        onChange={(e) => {
                          setPayerName(e.target.value);
                          setErrors((prev) => ({
                            ...prev,
                            payerName: "",
                          }));
                        }}
                        placeholder="Ayesha Khan"
                        className={inputClass("payerName")}
                      />

                      {errors.payerName && (
                        <p className="mt-1 text-xs text-red-500">
                          {errors.payerName}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-gray-700">
                        Payment Number
                      </label>

                      <input
                        type="tel"
                        inputMode="numeric"
                        value={paymentNumber}
                        onChange={(e) => {
                          setPaymentNumber(
                            e.target.value.replace(/[^0-9+]/g, "")
                          );

                          setErrors((prev) => ({
                            ...prev,
                            paymentNumber: "",
                          }));
                        }}
                        placeholder="03001234567"
                        className={inputClass("paymentNumber")}
                      />

                      {errors.paymentNumber && (
                        <p className="mt-1 text-xs text-red-500">
                          {errors.paymentNumber}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-gray-700">
                        Payment Amount
                      </label>

                      <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
                        <p className="text-lg font-bold text-[#2F7D72]">
                          {formatPrice(orderTotal)}
                        </p>
                      </div>

                      <p className="mt-1 text-xs text-gray-400">
                        The payment amount includes your applied discount.
                      </p>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-gray-700">
                        Transaction / Reference ID
                      </label>

                      <input
                        type="text"
                        value={transactionId}
                        onChange={(e) => {
                          setTransactionId(e.target.value);
                          setErrors((prev) => ({
                            ...prev,
                            transactionId: "",
                          }));
                        }}
                        placeholder="TXN-784521963"
                        className={inputClass("transactionId")}
                      />

                      {errors.transactionId && (
                        <p className="mt-1 text-xs text-red-500">
                          {errors.transactionId}
                        </p>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={placingOrder}
                      className="w-full rounded-xl bg-[#2F7D72] px-5 py-3.5 font-semibold text-white transition hover:bg-[#276B62] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {placingOrder
                        ? "Processing..."
                        : "Confirm Online Payment"}
                    </button>
                  </div>
                </div>
              )}
            </section>

            {paymentMethod === "cod" && (
              <button
                type="submit"
                disabled={placingOrder}
                className="w-full rounded-xl bg-[#2F7D72] px-5 py-4 font-semibold text-white transition hover:bg-[#276B62] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {placingOrder ? "Placing Order..." : "Place Order"}
              </button>
            )}
          </div>

          {/* ORDER SUMMARY */}
          <aside className="h-fit rounded-2xl bg-white p-6 shadow-sm lg:sticky lg:top-6">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-xl bg-[#2F7D72]/10 p-2">
                <ShoppingBag className="h-5 w-5 text-[#2F7D72]" />
              </div>

              <h2 className="text-lg font-bold text-[#183B38]">
                Order Summary
              </h2>
            </div>

            {cartItems.length === 0 ? (
              <div className="rounded-xl bg-gray-50 p-6 text-center">
                <Package className="mx-auto mb-2 h-8 w-8 text-gray-400" />

                <p className="text-sm text-gray-500">
                  Your cart is empty.
                </p>

                <button
                  type="button"
                  onClick={() => router.push("/store")}
                  className="mt-3 text-sm font-semibold text-[#2F7D72] hover:underline"
                >
                  Continue Shopping
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {cartItems.map((item, index) => {
                  const quantity = Number(item.quantity || 1);
                  const price = Number(item.price || 0);
                  const image = getProductImage(item.name, item.image);

                  return (
                    <div
                      key={`${item.id || item.name || "item"}-${index}`}
                      className="flex gap-3"
                    >
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gray-50">
                        {image ? (
                          <img
                            src={image}
                            alt={item.name || "Product"}
                            className="h-full w-full object-contain"
                            onError={(event) => {
                              event.currentTarget.style.display = "none";
                            }}
                          />
                        ) : (
                          <Package className="h-6 w-6 text-gray-400" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-gray-800">
                          {item.name || "Unknown Product"}
                        </p>

                        <p className="mt-1 text-xs text-gray-500">
                          {formatPrice(price)} × {quantity}
                        </p>
                      </div>

                      <p className="text-sm font-bold text-[#2F7D72]">
                        {formatPrice(price * quantity)}
                      </p>
                    </div>
                  );
                })}

                {/* VOUCHER / COUPON SECTION */}
                <div className="border-t border-gray-100 pt-4">
                  <CouponBox
                    subtotal={subtotal}
                    appliedCoupon={appliedCoupon}
                    onApply={setAppliedCoupon}
                    onRemove={() => setAppliedCoupon(null)}
                  />
                </div>

                {/* PRICE BREAKDOWN */}
                <div className="space-y-3 border-t border-gray-100 pt-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">
                      Subtotal
                    </span>

                    <span className="font-semibold text-gray-800">
                      {formatPrice(subtotal)}
                    </span>
                  </div>

                  {discount > 0 && (
                    <>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-green-600">
                          Discount ({appliedCoupon?.code})
                        </span>

                        <span className="font-semibold text-green-600">
                          - {formatPrice(discount)}
                        </span>
                      </div>

                      <div className="rounded-lg bg-green-50 px-3 py-2">
                        <p className="text-xs font-medium text-green-700">
                          You saved {formatPrice(discount)} on this order!
                        </p>
                      </div>
                    </>
                  )}

                  <div className="flex items-center justify-between border-t border-gray-100 pt-3">
                    <span className="font-semibold text-gray-600">
                      Total
                    </span>

                    <span className="text-xl font-bold text-[#183B38]">
                      {formatPrice(orderTotal)}
                    </span>
                  </div>
                </div>

                <div className="rounded-xl bg-[#F2F8F6] p-4">
                  <p className="text-xs text-gray-500">
                    Payment Method
                  </p>

                  <p className="mt-1 font-semibold text-[#2F7D72]">
                    {paymentMethod === "online"
                      ? "Online Payment"
                      : "Cash on Delivery"}
                  </p>
                </div>
              </div>
            )}
          </aside>
        </form>
      </div>
    </main>
  );
}
