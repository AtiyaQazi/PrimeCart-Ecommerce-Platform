
"use client";

import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  X,
  CalendarDays,
  CheckCircle2,
  Clock,
  Ban,
  Gift,
  TicketPercent,
  Tag,
  AlertCircle,
} from "lucide-react";

type DiscountType = "percentage" | "fixed";

type Promotion = {
  id: string;
  name: string;
  code: string;
  type: DiscountType;
  value: number;
  startDate: string;
  expiryDate: string;

  // Canonical minimum order field used by checkout
  minOrderValue: number;

  // Backward compatibility with existing promotions
  minOrder?: number;
  minimumOrderValue?: number;

  active: boolean;
};

type PromotionForm = {
  name: string;
  code: string;
  type: DiscountType;
  value: number;
  startDate: string;
  expiryDate: string;
  minOrder: number;
  active: boolean;
};

const STORAGE_KEY = "primecart-promotions";

const initialPromotions: Promotion[] = [
  {
    id: "1",
    name: "Welcome Discount",
    code: "WELCOME10",
    type: "percentage",
    value: 10,
    startDate: "2026-01-01",
    expiryDate: "2027-12-31",
    minOrderValue: 1000,
    minOrder: 1000,
    active: true,
  },
  {
    id: "2",
    name: "Summer Sale",
    code: "SUMMER20",
    type: "percentage",
    value: 20,
    startDate: "2026-06-01",
    expiryDate: "2027-12-31",
    minOrderValue: 2000,
    minOrder: 2000,
    active: true,
  },
  {
    id: "3",
    name: "Flat Discount",
    code: "FLAT500",
    type: "fixed",
    value: 500,
    startDate: "2026-01-01",
    expiryDate: "2027-12-31",
    minOrderValue: 3000,
    minOrder: 3000,
    active: true,
  },
];

const emptyForm: PromotionForm = {
  name: "",
  code: "",
  type: "percentage",
  value: 10,
  startDate: "",
  expiryDate: "",
  minOrder: 1000,
  active: true,
};

function money(value: number) {
  return `Rs. ${Math.max(0, value).toLocaleString("en-PK")}`;
}

function normalizePromotion(item: Record<string, unknown>): Promotion {
  const minimum = Math.max(
    0,
    Number(
      item.minOrderValue ??
        item.minOrder ??
        item.minimumOrderValue ??
        item.minimumPurchase ??
        item.minPurchase ??
        0
    ) || 0
  );

  const rawType = String(
    item.type ?? item.discountType ?? "percentage"
  ).toLowerCase();

  const type: DiscountType =
    rawType === "fixed" ||
    rawType === "fixed_amount" ||
    rawType === "fixed amount"
      ? "fixed"
      : "percentage";

  const rawActive = item.active;

  return {
    id: String(item.id ?? Date.now()),
    name: String(item.name ?? item.title ?? ""),
    code: String(
      item.code ?? item.couponCode ?? ""
    ).trim().toUpperCase(),
    type,
    value: Number(
      item.value ?? item.discountValue ?? item.discount ?? 0
    ) || 0,
    startDate: String(
      item.startDate ?? item.startDateTime ?? ""
    ),
    expiryDate: String(
      item.expiryDate ??
        item.endDate ??
        item.endDateTime ??
        ""
    ),
    minOrderValue: minimum,
    minOrder: minimum,
    minimumOrderValue: minimum,
    active:
      rawActive === true ||
      item.status === "Active" ||
      item.status === "active",
  };
}

function getPromotionsFromStorage(): Promotion[] {
  if (typeof window === "undefined") return [];

  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (!saved) {
      return initialPromotions;
    }

    const parsed = JSON.parse(saved);

    const rows = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.promotions)
        ? parsed.promotions
        : [];

    return rows.map((item: Record<string, unknown>) =>
      normalizePromotion(item)
    );
  } catch (error) {
    console.error("Error loading promotions:", error);
    return initialPromotions;
  }
}

function getStatus(promo: Promotion) {
  if (!promo.active) return "Inactive";

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (!promo.startDate || !promo.expiryDate) {
    return "Inactive";
  }

  const start = new Date(`${promo.startDate}T00:00:00`);
  const expiry = new Date(`${promo.expiryDate}T23:59:59`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(expiry.getTime())) {
    return "Inactive";
  }

  if (today < start) return "Scheduled";
  if (today > expiry) return "Expired";

  return "Active";
}

export default function PromotionsPage() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [ready, setReady] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PromotionForm>(emptyForm);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [error, setError] = useState("");

  // Load saved promotions and migrate old minimum-order fields.
  useEffect(() => {
    const loaded = getPromotionsFromStorage();

    setPromotions(loaded);
    setReady(true);
  }, []);

  // Save all promotions in a checkout-compatible format.
  useEffect(() => {
    if (!ready) return;

    try {
      const compatiblePromotions = promotions.map((promo) => {
        const minimum = Math.max(
          0,
          Number(
            promo.minOrderValue ??
              promo.minOrder ??
              promo.minimumOrderValue ??
              0
          ) || 0
        );

        return {
          ...promo,
          code: promo.code.trim().toUpperCase(),
          minOrderValue: minimum,
          minOrder: minimum,
          minimumOrderValue: minimum,
        };
      });

      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(compatiblePromotions)
      );
    } catch (storageError) {
      console.error("Unable to save promotions:", storageError);
      setError("Unable to save promotions in browser storage.");
    }
  }, [promotions, ready]);

  // Refresh if promotions are changed in another browser tab.
  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY || !event.newValue) return;

      try {
        const parsed = JSON.parse(event.newValue);

        const rows = Array.isArray(parsed)
          ? parsed
          : Array.isArray(parsed?.promotions)
            ? parsed.promotions
            : [];

        setPromotions(
          rows.map((item: Record<string, unknown>) =>
            normalizePromotion(item)
          )
        );
      } catch (storageError) {
        console.error("Unable to refresh promotions:", storageError);
      }
    };

    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const stats = useMemo(() => {
    return {
      total: promotions.length,
      active: promotions.filter(
        (p) => getStatus(p) === "Active"
      ).length,
      scheduled: promotions.filter(
        (p) => getStatus(p) === "Scheduled"
      ).length,
      inactive: promotions.filter(
        (p) =>
          getStatus(p) !== "Active" &&
          getStatus(p) !== "Scheduled"
      ).length,
    };
  }, [promotions]);

  const filteredPromotions = useMemo(() => {
    return promotions.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.code.toLowerCase().includes(search.toLowerCase());

      const matchesFilter =
        filter === "All" || getStatus(p) === filter;

      return matchesSearch && matchesFilter;
    });
  }, [promotions, search, filter]);

  const openCreate = () => {
    setEditingId(null);

    setForm({
      ...emptyForm,
      startDate: new Date().toISOString().slice(0, 10),
      expiryDate: new Date(
        Date.now() + 30 * 86400000
      )
        .toISOString()
        .slice(0, 10),
    });

    setError("");
    setShowForm(true);
  };

  const openEdit = (promo: Promotion) => {
    const minimum = Number(
      promo.minOrderValue ??
        promo.minOrder ??
        promo.minimumOrderValue ??
        0
    );

    setEditingId(promo.id);

    setForm({
      name: promo.name,
      code: promo.code,
      type: promo.type,
      value: promo.value,
      startDate: promo.startDate,
      expiryDate: promo.expiryDate,
      minOrder: minimum,
      active: promo.active,
    });

    setError("");
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
    setError("");
  };

  const savePromotion = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    const code = form.code.trim().toUpperCase();
    const name = form.name.trim();

    if (!name || !code) {
      setError("Please enter a promotion name and coupon code.");
      return;
    }

    if (!/^[A-Z0-9_-]+$/.test(code)) {
      setError(
        "Use only letters, numbers, hyphens or underscores in the coupon code."
      );
      return;
    }

    if (
      !Number.isFinite(form.value) ||
      form.value <= 0 ||
      (form.type === "percentage" && form.value > 100)
    ) {
      setError(
        form.type === "percentage"
          ? "Percentage must be between 1 and 100."
          : "Discount amount must be greater than zero."
      );
      return;
    }

    if (
      !form.startDate ||
      !form.expiryDate ||
      form.expiryDate < form.startDate
    ) {
      setError("Please enter valid promotion dates.");
      return;
    }

    if (
      !Number.isFinite(form.minOrder) ||
      form.minOrder < 0
    ) {
      setError("Minimum order value cannot be negative.");
      return;
    }

    const duplicate = promotions.some(
      (p) =>
        p.code.toUpperCase() === code &&
        p.id !== editingId
    );

    if (duplicate) {
      setError("This coupon code already exists.");
      return;
    }

    const minimum = Number(form.minOrder);

    const promotion: Promotion = {
      id: editingId || Date.now().toString(),
      name,
      code,
      type: form.type,
      value: Number(form.value),
      startDate: form.startDate,
      expiryDate: form.expiryDate,

      // Both fields are saved for compatibility.
      minOrderValue: minimum,
      minOrder: minimum,
      minimumOrderValue: minimum,

      active: form.active,
    };

    if (editingId) {
      setPromotions((prev) =>
        prev.map((p) =>
          p.id === editingId ? promotion : p
        )
      );
    } else {
      setPromotions((prev) => [promotion, ...prev]);
    }

    closeForm();
  };

  const toggleStatus = (id: string) => {
    setPromotions((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, active: !p.active }
          : p
      )
    );
  };

  const deletePromotion = (id: string) => {
    if (!window.confirm("Delete this promotion?")) return;

    setPromotions((prev) =>
      prev.filter((p) => p.id !== id)
    );
  };

  const statusStyle = (status: string) => {
    switch (status) {
      case "Active":
        return "bg-green-100 text-green-700";
      case "Scheduled":
        return "bg-blue-100 text-blue-700";
      case "Expired":
        return "bg-orange-100 text-orange-700";
      default:
        return "bg-gray-100 text-gray-600";
    }
  };

  const previewMinimum = Math.max(0, Number(form.minOrder) || 0);

  const previewDiscount =
    form.type === "percentage"
      ? (1000 * Number(form.value || 0)) / 100
      : Number(form.value || 0);

  if (!ready) {
    return (
      <DashboardLayout>
        <div className="p-8 text-[#173F35]">
          Loading promotions...
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-[#F4EBDD] p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-7xl">
          {/* Header */}
          <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h1 className="text-2xl font-bold text-[#173F35] sm:text-3xl">
                Promotions & Discounts
              </h1>

              <p className="mt-2 text-sm text-gray-500">
                Create and manage store promotions, discount offers and coupon codes.
              </p>
            </div>

            <button
              onClick={openCreate}
              className="flex items-center justify-center gap-2 rounded-xl bg-[#173F35] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#245746]"
            >
              <Plus size={18} />
              Create Promotion
            </button>
          </div>

          {/* Statistics */}
          <div className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: "Total Promotions",
                value: stats.total,
                icon: Gift,
              },
              {
                label: "Active Promotions",
                value: stats.active,
                icon: CheckCircle2,
              },
              {
                label: "Scheduled",
                value: stats.scheduled,
                icon: Clock,
              },
              {
                label: "Inactive / Expired",
                value: stats.inactive,
                icon: Ban,
              },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-[#DED7CB] bg-white p-5 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500">
                    {item.label}
                  </p>

                  <item.icon
                    className="text-[#4D806F]"
                    size={21}
                  />
                </div>

                <p className="mt-3 text-3xl font-bold text-[#173F35]">
                  {item.value}
                </p>
              </div>
            ))}
          </div>

          {/* Promotions Table */}
          <section className="overflow-hidden rounded-2xl border border-[#DED7CB] bg-white shadow-sm">
            <div className="flex flex-col gap-4 border-b border-gray-100 p-5 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="font-bold text-[#173F35]">
                  All Promotions
                </h2>

                <p className="mt-1 text-xs text-gray-500">
                  Manage your coupon codes, discounts and minimum order requirements.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative">
                  <Search
                    size={17}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />

                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search promotions..."
                    className="w-full rounded-xl border border-gray-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[#4D806F] sm:w-56"
                  />
                </div>

                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#4D806F]"
                >
                  <option>All</option>
                  <option>Active</option>
                  <option>Scheduled</option>
                  <option>Expired</option>
                  <option>Inactive</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px] text-left text-sm">
                <thead className="bg-[#F8F5EF] text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-5 py-4">Promotion</th>
                    <th className="px-5 py-4">Coupon Code</th>
                    <th className="px-5 py-4">Discount</th>
                    <th className="px-5 py-4">Minimum Order</th>
                    <th className="px-5 py-4">Validity</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {filteredPromotions.map((promo) => {
                    const status = getStatus(promo);

                    const minimum = Number(
                      promo.minOrderValue ??
                        promo.minOrder ??
                        promo.minimumOrderValue ??
                        0
                    );

                    return (
                      <tr
                        key={promo.id}
                        className="hover:bg-[#FAF8F3]"
                      >
                        <td className="px-5 py-4 font-semibold text-[#173F35]">
                          {promo.name}
                        </td>

                        <td className="px-5 py-4">
                          <span className="rounded-lg bg-[#E7EFEA] px-3 py-1.5 font-mono font-bold text-[#245746]">
                            {promo.code}
                          </span>
                        </td>

                        <td className="px-5 py-4 font-semibold text-gray-700">
                          {promo.type === "percentage"
                            ? `${promo.value}% off`
                            : `${money(promo.value)} off`}
                        </td>

                        <td className="px-5 py-4">
                          <span className="font-semibold text-[#173F35]">
                            {money(minimum)}
                          </span>

                          {minimum === 0 && (
                            <p className="mt-1 text-xs text-gray-400">
                              No minimum
                            </p>
                          )}
                        </td>

                        <td className="px-5 py-4 text-gray-600">
                          <div className="flex items-center gap-2">
                            <CalendarDays size={15} />

                            <span>
                              {promo.startDate} – {promo.expiryDate}
                            </span>
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyle(
                              status
                            )}`}
                          >
                            {status}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => openEdit(promo)}
                              title="Edit"
                              className="rounded-lg p-2 text-blue-600 hover:bg-blue-50"
                            >
                              <Pencil size={17} />
                            </button>

                            <button
                              onClick={() => toggleStatus(promo.id)}
                              title={
                                promo.active
                                  ? "Deactivate"
                                  : "Activate"
                              }
                              className="rounded-lg px-2 py-1 text-xs font-semibold text-[#2F7D72] hover:bg-[#E7EFEA]"
                            >
                              {promo.active
                                ? "Deactivate"
                                : "Activate"}
                            </button>

                            <button
                              onClick={() => deletePromotion(promo.id)}
                              title="Delete"
                              className="rounded-lg p-2 text-red-500 hover:bg-red-50"
                            >
                              <Trash2 size={17} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredPromotions.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="p-10 text-center text-gray-500"
                      >
                        No promotions found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="border-t border-gray-100 px-5 py-4 text-xs text-gray-500">
              Showing {filteredPromotions.length} of{" "}
              {promotions.length} promotions
            </div>
          </section>

          {/* Create / Edit Modal */}
          {showForm && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/50 p-4">
              <div className="my-6 w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b p-5">
                  <div>
                    <h2 className="text-xl font-bold text-[#173F35]">
                      {editingId
                        ? "Edit Promotion"
                        : "Create Promotion"}
                    </h2>

                    <p className="mt-1 text-xs text-gray-500">
                      Configure discount, coupon code and minimum purchase requirement.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={closeForm}
                    className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
                  >
                    <X size={20} />
                  </button>
                </div>

                <form
                  onSubmit={savePromotion}
                  className="space-y-5 p-5"
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    {/* Promotion Name */}
                    <div className="sm:col-span-2">
                      <label className="mb-2 block text-sm font-semibold text-gray-700">
                        Promotion Name
                      </label>

                      <input
                        required
                        value={form.name}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            name: e.target.value,
                          })
                        }
                        placeholder="e.g. Welcome Discount"
                        className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#2F7D72]"
                      />
                    </div>

                    {/* Coupon Code */}
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-gray-700">
                        Coupon Code
                      </label>

                      <input
                        required
                        value={form.code}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            code: e.target.value.toUpperCase(),
                          })
                        }
                        placeholder="WELCOME10"
                        className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm uppercase outline-none focus:border-[#2F7D72]"
                      />

                      <p className="mt-1 text-xs text-gray-400">
                        Letters, numbers, hyphens and s only.
                      </p>
                    </div>

                    {/* Discount Type */}
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-gray-700">
                        Discount Type
                      </label>

                      <select
                        value={form.type}
                        onChange={(e) => {
                          const type = e.target.value as DiscountType;

                          setForm({
                            ...form,
                            type,
                            value: type === "percentage" ? 10 : 500,
                          });
                        }}
                        className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none"
                      >
                        <option value="percentage">
                          Percentage (%)
                        </option>
                        <option value="fixed">
                          Fixed Amount (Rs.)
                        </option>
                      </select>
                    </div>

                    {/* Discount Value */}
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-gray-700">
                        Discount Value
                      </label>

                      <input
                        required
                        type="number"
                        min="1"
                        max={
                          form.type === "percentage"
                            ? 100
                            : undefined
                        }
                        step="1"
                        value={form.value}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            value: Number(e.target.value),
                          })
                        }
                        className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#2F7D72]"
                      />

                      <p className="mt-1 text-xs text-gray-400">
                        {form.type === "percentage"
                          ? "Enter a percentage between 1 and 100."
                          : "Enter the fixed discount amount in rupees."}
                      </p>
                    </div>

                    {/* Minimum Order Value */}
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-gray-700">
                        Minimum Order Value (Rs.)
                      </label>

                      <input
                        required
                        type="number"
                        min="0"
                        step="1"
                        value={form.minOrder}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            minOrder: Number(e.target.value),
                          })
                        }
                        placeholder="e.g. 2000"
                        className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#2F7D72]"
                      />

                      <p className="mt-1 text-xs text-gray-400">
                        Customer must reach this order amount to use the voucher. Enter 0 for no minimum.
                      </p>
                    </div>

                    {/* Start Date */}
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-gray-700">
                        Start Date
                      </label>

                      <input
                        required
                        type="date"
                        value={form.startDate}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            startDate: e.target.value,
                          })
                        }
                        className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none"
                      />
                    </div>

                    {/* Expiry Date */}
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-gray-700">
                        Expiry Date
                      </label>

                      <input
                        required
                        type="date"
                        min={form.startDate}
                        value={form.expiryDate}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            expiryDate: e.target.value,
                          })
                        }
                        className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none"
                      />
                    </div>
                  </div>

                  {/* Minimum Order Preview */}
                  <div className="rounded-xl border border-[#D6E4D8] bg-[#F0F6F0] p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <TicketPercent
                        size={18}
                        className="text-[#315C43]"
                      />

                      <h3 className="text-sm font-bold text-[#173F35]">
                        Customer Voucher Preview
                      </h3>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-gray-600">
                          Coupon Code
                        </span>

                        <strong className="font-mono text-[#245746]">
                          {form.code.trim().toUpperCase() || "YOURCODE"}
                        </strong>
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <span className="text-gray-600">
                          Discount
                        </span>

                        <strong className="text-[#173F35]">
                          {form.type === "percentage"
                            ? `${form.value || 0}% off`
                            : `${money(form.value || 0)} off`}
                        </strong>
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <span className="text-gray-600">
                          Minimum Order Required
                        </span>

                        <strong className="text-[#173F35]">
                          {money(previewMinimum)}
                        </strong>
                      </div>

                      <div className="my-2 border-t border-[#D6E4D8]" />

                      <p className="text-xs leading-5 text-[#315C43]">
                        {previewMinimum > 0
                          ? `Customers must place an order of at least ${money(
                              previewMinimum
                            )} to apply this voucher. If their order is below this amount, checkout will show how much more they need to add.`
                          : "This voucher can be used without a minimum order requirement."}
                      </p>

                      <p className="text-xs text-gray-500">
                        Example discount on Rs. 1,000:{" "}
                        <strong>{money(previewDiscount)}</strong>
                      </p>
                    </div>
                  </div>

                  {/* Active Status */}
                  <label className="flex items-center gap-3 rounded-xl bg-[#F8F5EF] p-4 text-sm font-medium text-gray-700">
                    <input
                      type="checkbox"
                      checked={form.active}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          active: e.target.checked,
                        })
                      }
                      className="h-4 w-4 accent-[#2F7D72]"
                    />

                    Activate this promotion
                  </label>

                  {/* Error */}
                  {error && (
                    <p
                      role="alert"
                      className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600"
                    >
                      <AlertCircle
                        size={17}
                        className="mt-0.5 shrink-0"
                      />
                      {error}
                    </p>
                  )}

                  {/* Buttons */}
                  <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      onClick={closeForm}
                      className="rounded-xl border border-gray-200 px-5 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50"
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      className="rounded-xl bg-[#173F35] px-6 py-3 text-sm font-semibold text-white hover:bg-[#245746]"
                    >
                      {editingId
                        ? "Save Changes"
                        : "Create Promotion"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
