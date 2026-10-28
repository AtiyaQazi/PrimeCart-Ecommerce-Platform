
"use client";

import { useEffect, useMemo, useState } from "react";

import {
  ArrowDownRight,
  ArrowUpRight,
  ShoppingBag,
  ShoppingCart,
  Users,
  Package,
  MoreHorizontal,
} from "lucide-react";

import {
  collection,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";

import { db } from "../../lib/firestore";

/* ============================================
   TYPES
============================================ */

interface OrderItem {
  productId?: string;
  id?: string;
  name?: string;
  product?: string | {
    id?: string;
    name?: string;
    productName?: string;
    title?: string;
  };
  productName?: string;
  title?: string;
  quantity?: number;
  selectedColor?: string;
  color?: string;
  selectedSize?: string;
  [key: string]: any;
}

interface Order {
  id: string;
  customerName: string;
  customerEmail: string;
  product: string;
  productName?: string;
  name?: string;
  title?: string;
  items: OrderItem[];
  products: OrderItem[];
  total: number;
  status: string;
  paymentMethod?: string;
  paymentStatus?: string;
  payment?: {
    method?: string;
    status?: string;
  } | null;
  createdAt?: {
    seconds?: number;
  } | null;
}

interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  description: string;
  createdAt?: {
    seconds?: number;
  } | null;
}

interface Customer {
  id: string;
  name: string;
  email: string;
  status: string;
  createdAt?: {
    seconds?: number;
  } | null;
}

interface SalesMonth {
  month: string;
  value: number;
}

/* ============================================
   HELPERS
============================================ */

function getPaymentMethod(order: Order): string {
  return String(
    order.paymentMethod ||
      order.payment?.method ||
      ""
  )
    .trim()
    .toLowerCase();
}

function getPaymentStatus(order: Order): string {
  return String(
    order.paymentStatus ||
      order.payment?.status ||
      ""
  )
    .trim()
    .toLowerCase();
}

function getOrderStatus(order: Order): string {
  return String(order.status || "")
    .trim()
    .toLowerCase();
}

function isSaleOrder(order: Order): boolean {
  const orderStatus = getOrderStatus(order);
  const paymentStatus = getPaymentStatus(order);
  const paymentMethod = getPaymentMethod(order);

  if (
    orderStatus === "cancelled" ||
    orderStatus === "canceled" ||
    paymentStatus === "cancelled" ||
    paymentStatus === "canceled" ||
    paymentStatus === "failed"
  ) {
    return false;
  }

  if (paymentStatus !== "paid") {
    return false;
  }

  if (
    orderStatus !== "processing" &&
    orderStatus !== "completed"
  ) {
    return false;
  }

  const isCOD = [
    "cod",
    "cash on delivery",
    "cash_on_delivery",
  ].includes(paymentMethod);

  const isOnlinePayment = [
    "online payment",
    "online",
    "online_payment",
    "stripe",
    "card",
    "credit card",
    "debit card",
  ].includes(paymentMethod);

  return isCOD || isOnlinePayment;
}

function getSaleAmount(order: Order): number {
  const amount = Number(order.total);

  if (!Number.isFinite(amount) || amount <= 0) {
    return 0;
  }

  return amount;
}

/* ============================================
   PRODUCT NAME RESOLUTION
============================================ */

function getOrderProductNames(
  order: Order,
  products: Product[]
): string {
  const orderItems = [
    ...(Array.isArray(order.items) ? order.items : []),
    ...(Array.isArray(order.products) ? order.products : []),
  ];

  const names: string[] = [];

  for (const orderItem of orderItems) {
    const nestedProduct =
      typeof orderItem.product === "object" &&
      orderItem.product !== null
        ? orderItem.product
        : undefined;

    const productId = String(
      orderItem.productId ||
        orderItem.id ||
        nestedProduct?.id ||
        ""
    ).trim();

    const productNameFromDatabase = productId
      ? products.find((product) => product.id === productId)
          ?.name
      : "";

    const rawName =
      productNameFromDatabase ||
      (typeof orderItem.name === "string"
        ? orderItem.name
        : "") ||
      (typeof orderItem.productName === "string"
        ? orderItem.productName
        : "") ||
      nestedProduct?.name ||
      nestedProduct?.productName ||
      nestedProduct?.title ||
      (typeof orderItem.product === "string"
        ? orderItem.product
        : "") ||
      (typeof orderItem.title === "string"
        ? orderItem.title
        : "");

    const name = String(rawName || "").trim();

    if (
      name &&
      name.toLowerCase() !==
        order.customerName.trim().toLowerCase() &&
      name.toLowerCase() !== "unknown product" &&
      name.toLowerCase() !== "product name unavailable"
    ) {
      names.push(name);
    }
  }

  if (names.length > 0) {
    return [...new Set(names)].join(", ");
  }

  const directName = [
    order.product,
    order.productName,
    order.name,
    order.title,
  ].find(
    (value) =>
      typeof value === "string" &&
      value.trim() !== "" &&
      value.trim().toLowerCase() !==
        order.customerName.trim().toLowerCase() &&
      value.trim().toLowerCase() !== "unknown product" &&
      value.trim().toLowerCase() !==
        "product name unavailable"
  );

  if (directName) {
    return directName.trim();
  }

  return "Product name unavailable";
}

/* ============================================
   STATUS BADGE
============================================ */

function StatusBadge({
  status,
}: {
  status: string;
}) {
  const normalizedStatus = String(status || "")
    .trim()
    .toLowerCase();

  const styles: Record<string, string> = {
    completed: "bg-[#E4F1E9] text-[#276749]",
    processing: "bg-[#FFF1D6] text-[#9A6700]",
    pending: "bg-[#E9E7F7] text-[#5B4B9A]",
    cancelled: "bg-red-50 text-red-600",
    canceled: "bg-red-50 text-red-600",
  };

  const displayStatus = status || "Pending";

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
        styles[normalizedStatus] ??
        "bg-gray-100 text-gray-700"
      }`}
    >
      {displayStatus}
    </span>
  );
}

/* ============================================
   DASHBOARD
============================================ */

export default function DashboardContent() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /* ==========================================
     LOAD ORDERS
  ========================================== */

  useEffect(() => {
    const ordersQuery = query(
      collection(db, "orders"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      ordersQuery,
      (snapshot) => {
        const data: Order[] = snapshot.docs.map(
          (document) => {
            const item = document.data();

            return {
              id: document.id,

              customerName:
                typeof item.customerName === "string"
                  ? item.customerName
                  : "Unknown Customer",

              customerEmail:
                typeof item.customerEmail === "string"
                  ? item.customerEmail
                  : "",

              product:
                typeof item.product === "string"
                  ? item.product
                  : "",

              productName:
                typeof item.productName === "string"
                  ? item.productName
                  : "",

              name:
                typeof item.name === "string"
                  ? item.name
                  : "",

              title:
                typeof item.title === "string"
                  ? item.title
                  : "",

              items: Array.isArray(item.items)
                ? item.items
                : [],

              products: Array.isArray(item.products)
                ? item.products
                : [],

              total:
                typeof item.total === "number"
                  ? item.total
                  : Number(item.total) || 0,

              status:
                typeof item.status === "string"
                  ? item.status
                  : "Pending",

              paymentMethod:
                item.paymentMethod ||
                item.payment?.method ||
                "",

              paymentStatus:
                item.paymentStatus ||
                item.payment?.status ||
                "",

              payment: item.payment || null,

              createdAt: item.createdAt || null,
            };
          }
        );

        setOrders(data);
        setLoading(false);
        setError("");
      },
      (err) => {
        console.error("Orders listener error:", err);
        setError("Unable to load dashboard orders.");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  /* ==========================================
     LOAD PRODUCTS
  ========================================== */

  useEffect(() => {
    const productsQuery = query(
      collection(db, "products"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      productsQuery,
      (snapshot) => {
        const data: Product[] = snapshot.docs.map(
          (document) => {
            const item = document.data();

            return {
              id: document.id,
              name:
                item.name ||
                item.productName ||
                item.title ||
                "",
              category: item.category || "",
              price:
                typeof item.price === "number"
                  ? item.price
                  : Number(item.price) || 0,
              stock:
                typeof item.stock === "number"
                  ? item.stock
                  : Number(item.stock) || 0,
              description: item.description || "",
              createdAt: item.createdAt || null,
            };
          }
        );

        setProducts(data);
        setError((current) =>
          current === "Unable to load dashboard products."
            ? ""
            : current
        );
      },
      (err) => {
        console.error("Products listener error:", err);
        setError("Unable to load dashboard products.");
      }
    );

    return () => unsubscribe();
  }, []);

  /* ==========================================
     LOAD CUSTOMERS
  ========================================== */

  useEffect(() => {
    const customersQuery = query(
      collection(db, "customers"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      customersQuery,
      (snapshot) => {
        const data: Customer[] = snapshot.docs.map(
          (document) => {
            const item = document.data();

            return {
              id: document.id,
              name: item.name || "",
              email: item.email || "",
              status: item.status || "Active",
              createdAt: item.createdAt || null,
            };
          }
        );

        setCustomers(data);
        setError((current) =>
          current === "Unable to load dashboard customers."
            ? ""
            : current
        );
      },
      (err) => {
        console.error("Customers listener error:", err);
        setError("Unable to load dashboard customers.");
      }
    );

    return () => unsubscribe();
  }, []);

  /* ==========================================
     CALCULATE DASHBOARD DATA
  ========================================== */

  const dashboardData = useMemo(() => {
    const saleOrders = orders.filter(isSaleOrder);

    const totalSales = saleOrders.reduce(
      (sum, order) => sum + getSaleAmount(order),
      0
    );

    const totalOrders = orders.length;
    const totalProducts = products.length;
    const totalCustomers = customers.length;

    const totalStock = products.reduce(
      (sum, product) =>
        sum + Math.max(product.stock, 0),
      0
    );

    const lowStockProducts = products.filter(
      (product) =>
        product.stock > 0 && product.stock <= 10
    ).length;

    const outOfStockProducts = products.filter(
      (product) => product.stock <= 0
    ).length;

    const pendingOrders = orders.filter(
      (order) => getOrderStatus(order) === "pending"
    ).length;

    const activeCustomers = customers.filter(
      (customer) => customer.status === "Active"
    ).length;

    const newCustomers = customers.filter((customer) => {
      if (!customer.createdAt?.seconds) {
        return false;
      }

      const createdDate = new Date(
        customer.createdAt.seconds * 1000
      );

      const now = new Date();

      const firstDayOfMonth = new Date(
        now.getFullYear(),
        now.getMonth(),
        1
      );

      return createdDate >= firstDayOfMonth;
    }).length;

    return {
      totalSales,
      totalOrders,
      totalProducts,
      totalCustomers,
      totalStock,
      lowStockProducts,
      outOfStockProducts,
      pendingOrders,
      activeCustomers,
      newCustomers,
    };
  }, [orders, products, customers]);

  /* ==========================================
     SALES OVERVIEW - LAST 12 MONTHS
  ========================================== */

  const salesData = useMemo<SalesMonth[]>(() => {
    const now = new Date();
    const months: SalesMonth[] = [];

    for (let i = 11; i >= 0; i--) {
      const date = new Date(
        now.getFullYear(),
        now.getMonth() - i,
        1
      );

      const monthName = date.toLocaleString("en-US", {
        month: "short",
      });

      let value = 0;

      orders.forEach((order) => {
        if (!isSaleOrder(order)) {
          return;
        }

        if (!order.createdAt?.seconds) {
          return;
        }

        const orderDate = new Date(
          order.createdAt.seconds * 1000
        );

        if (
          orderDate.getFullYear() === date.getFullYear() &&
          orderDate.getMonth() === date.getMonth()
        ) {
          value += getSaleAmount(order);
        }
      });

      months.push({
        month: monthName,
        value,
      });
    }

    return months;
  }, [orders]);

  const maxSalesValue = Math.max(
    ...salesData.map((item) => item.value),
    1
  );

  const recentOrders = orders.slice(0, 5);

  /* ==========================================
     LOADING
  ========================================== */

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F4EBDD] p-4 md:p-6">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-2xl border border-[#DED7CB] bg-[#FBF9F5] p-8 text-center shadow-sm">
            <p className="text-sm font-medium text-[#355E4B]">
              Loading dashboard...
            </p>
            <p className="mt-1 text-xs text-[#777D78]">
              Fetching your store data.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4EBDD] p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* HEADER */}

        <div>
          <p className="text-sm font-medium text-[#355E4B]">
            Overview
          </p>

          <h1 className="mt-1 text-2xl font-bold text-[#111111] md:text-3xl">
            Dashboard
          </h1>

          <p className="mt-1 text-sm text-[#6F756F]">
            Welcome back. Here&apos;s what&apos;s happening with your store.
          </p>
        </div>

        {/* ERROR */}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        {/* STATS */}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Total Sales"
            value={`Rs. ${dashboardData.totalSales.toLocaleString(
              "en-PK",
              {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              }
            )}`}
            change="Live"
            positive={true}
            icon={ShoppingCart}
          />

          <StatCard
            title="Total Orders"
            value={dashboardData.totalOrders.toLocaleString()}
            change="Live"
            positive={true}
            icon={ShoppingBag}
          />

          <StatCard
            title="Total Products"
            value={dashboardData.totalProducts.toLocaleString()}
            change="Live"
            positive={true}
            icon={Package}
          />

          <StatCard
            title="Total Customers"
            value={dashboardData.totalCustomers.toLocaleString()}
            change="Live"
            positive={true}
            icon={Users}
          />
        </div>

        {/* SALES + SUMMARY */}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <section className="rounded-2xl border border-[#DED7CB] bg-[#FBF9F5] p-5 shadow-sm xl:col-span-2">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-[#111111]">
                  Sales Overview
                </h2>
                <p className="mt-1 text-xs text-[#777D78]">
                  Monthly paid sales performance
                </p>
              </div>

              <span className="rounded-lg bg-[#E7EFEA] px-3 py-2 text-xs font-semibold text-[#355E4B]">
                Last 12 Months
              </span>
            </div>

            <div className="mt-6 flex h-64 items-end gap-2 sm:gap-3">
              {salesData.map((item, index) => {
                const height =
                  item.value > 0
                    ? Math.max(
                        (item.value / maxSalesValue) * 100,
                        4
                      )
                    : 3;

                return (
                  <div
                    key={`${item.month}-${index}`}
                    className="flex h-full flex-1 flex-col justify-end"
                  >
                    <div className="flex h-full items-end">
                      <div
                        className="w-full rounded-t-lg bg-[#4D806F] transition hover:bg-[#355E4B]"
                        style={{ height: `${height}%` }}
                        title={`Rs. ${item.value.toLocaleString(
                          "en-PK",
                          {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0,
                          }
                        )}`}
                      />
                    </div>

                    <span className="mt-2 text-center text-[10px] text-[#858A85] sm:text-xs">
                      {item.month}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 flex items-center justify-between border-t border-[#E8E2D8] pt-4">
              <div>
                <p className="text-xs text-[#777D78]">
                  Total revenue
                </p>
                <p className="mt-1 text-lg font-bold text-[#111111]">
                  Rs.{" "}
                  {dashboardData.totalSales.toLocaleString(
                    "en-PK",
                    {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    }
                  )}
                </p>
              </div>

              <div className="flex items-center gap-1 text-xs font-semibold text-[#276749]">
                <ArrowUpRight size={15} />
                Live data
              </div>
            </div>
          </section>

          {/* STORE SUMMARY */}

          <section className="rounded-2xl border border-[#DED7CB] bg-[#FBF9F5] p-5 shadow-sm">
            <h2 className="font-semibold text-[#111111]">
              Store Summary
            </h2>

            <p className="mt-1 text-xs text-[#777D78]">
              Current store activity
            </p>

            <div className="mt-6 space-y-5">
              <SummaryRow
                label="Products in stock"
                value={dashboardData.totalStock.toLocaleString()}
                percentage={
                  dashboardData.totalProducts > 0
                    ? `${Math.min(
                        100,
                        Math.round(
                          ((dashboardData.totalProducts -
                            dashboardData.outOfStockProducts) /
                            dashboardData.totalProducts) *
                            100
                        )
                      )}%`
                    : "0%"
                }
              />

              <SummaryRow
                label="Low stock products"
                value={dashboardData.lowStockProducts.toLocaleString()}
                percentage={
                  dashboardData.totalProducts > 0
                    ? `${Math.min(
                        100,
                        Math.round(
                          (dashboardData.lowStockProducts /
                            dashboardData.totalProducts) *
                            100
                        )
                      )}%`
                    : "0%"
                }
              />

              <SummaryRow
                label="Out of Stock"
                value={dashboardData.outOfStockProducts.toLocaleString()}
                percentage={
                  dashboardData.totalProducts > 0
                    ? `${Math.min(
                        100,
                        Math.round(
                          (dashboardData.outOfStockProducts /
                            dashboardData.totalProducts) *
                            100
                        )
                      )}%`
                    : "0%"
                }
              />

              <SummaryRow
                label="Total Customers"
                value={dashboardData.totalCustomers.toLocaleString()}
                percentage={
                  dashboardData.totalCustomers > 0
                    ? "100%"
                    : "0%"
                }
              />
            </div>
          </section>
        </div>

        {/* RECENT ORDERS */}

        <section className="overflow-hidden rounded-2xl border border-[#DED7CB] bg-[#FBF9F5] shadow-sm">
          <div className="flex items-center justify-between border-b border-[#E5DFD5] px-5 py-4">
            <div>
              <h2 className="font-semibold text-[#111111]">
                Recent Orders
              </h2>
              <p className="mt-1 text-xs text-[#777D78]">
                Latest orders from your store
              </p>
            </div>

            <a
              href="/orders"
              className="rounded-lg px-3 py-2 text-xs font-semibold text-[#355E4B] hover:bg-[#E7EFEA]"
            >
              View All
            </a>
          </div>

          {recentOrders.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <ShoppingBag
                size={32}
                className="mx-auto text-[#A6AAA6]"
              />

              <p className="mt-3 text-sm font-semibold text-[#555B56]">
                No orders yet
              </p>

              <p className="mt-1 text-xs text-[#777D78]">
                Orders will appear here when they are added.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="border-b border-[#E5DFD5] bg-[#F7F4EE] text-left">
                    <th className="px-5 py-3 text-xs uppercase tracking-wide text-[#777D78]">
                      Order
                    </th>
                    <th className="px-5 py-3 text-xs uppercase tracking-wide text-[#777D78]">
                      Customer
                    </th>
                    <th className="px-5 py-3 text-xs uppercase tracking-wide text-[#777D78]">
                      Product
                    </th>
                    <th className="px-5 py-3 text-xs uppercase tracking-wide text-[#777D78]">
                      Amount
                    </th>
                    <th className="px-5 py-3 text-xs uppercase tracking-wide text-[#777D78]">
                      Status
                    </th>
                    <th className="px-5 py-3 text-right text-xs uppercase tracking-wide text-[#777D78]">
                      More
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {recentOrders.map((order) => (
                    <tr
                      key={order.id}
                      className="border-b border-[#EEE9E0] last:border-b-0 hover:bg-[#FCFAF6]"
                    >
                      <td className="px-5 py-4 text-sm font-semibold text-[#355E4B]">
                        #{order.id.slice(0, 8)}
                      </td>

                      <td className="px-5 py-4 text-sm text-[#222222]">
                        {order.customerName}
                      </td>

                      <td className="px-5 py-4 text-sm text-[#555B56]">
                        {getOrderProductNames(order, products)}
                      </td>

                      <td className="px-5 py-4 text-sm font-semibold text-[#111111]">
                        Rs.{" "}
                        {order.total.toLocaleString("en-PK", {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0,
                        })}
                      </td>

                      <td className="px-5 py-4">
                        <StatusBadge status={order.status} />
                      </td>

                      <td className="px-5 py-4 text-right">
                        <button
                          type="button"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#777D78] hover:bg-[#E7EFEA]"
                          title="Order options"
                        >
                          <MoreHorizontal size={17} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

/* ============================================
   STAT CARD
============================================ */

function StatCard({
  title,
  value,
  change,
  positive,
  icon: Icon,
}: {
  title: string;
  value: string;
  change: string;
  positive: boolean;
  icon: React.ElementType;
}) {
  return (
    <div className="rounded-2xl border border-[#DED7CB] bg-[#FBF9F5] p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#E7EFEA] text-[#355E4B]">
          <Icon size={21} />
        </div>

        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
            positive
              ? "bg-[#E4F1E9] text-[#276749]"
              : "bg-red-50 text-red-600"
          }`}
        >
          {positive ? (
            <ArrowUpRight size={13} />
          ) : (
            <ArrowDownRight size={13} />
          )}
          {change}
        </span>
      </div>

      <p className="mt-5 text-sm text-[#777D78]">
        {title}
      </p>

      <h2 className="mt-1 text-2xl font-bold text-[#111111]">
        {value}
      </h2>

      <p className="mt-1 text-xs text-[#8A908B]">
        Real-time store data
      </p>
    </div>
  );
}

/* ============================================
   SUMMARY ROW
============================================ */

function SummaryRow({
  label,
  value,
  percentage,
}: {
  label: string;
  value: string;
  percentage: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-[#555B56]">
          {label}
        </span>

        <span className="text-sm font-bold text-[#111111]">
          {value}
        </span>
      </div>

      <div className="mt-2 h-2 rounded-full bg-[#E7E2D9]">
        <div
          className="h-full rounded-full bg-[#4D806F] transition-all"
          style={{ width: percentage }}
        />
      </div>
    </div>
  );
}