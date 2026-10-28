
"use client";

import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "../../components/layout/DashboardLayout";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "../../lib/firestore";
import { getProductImage } from "../../lib/productImages";
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Download,
  Package,
  ShoppingBag,
  TrendingUp,
  XCircle,
} from "lucide-react";

interface OrderItem {
  productId?: string;
  productName?: string;
  name?: string;
  quantity?: number;
  price?: number;
  image?: string;
}

interface Order {
  id: string;
  customerName: string;
  customerEmail: string;
  total: number;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  payment?: {
    method?: string;
    status?: string;
  };
  items: OrderItem[];
  product?: string;
  createdAt?: {
    seconds?: number;
    nanoseconds?: number;
  } | null;
}

interface Product {
  id: string;
  name: string;
  category: string;
  stock: number;
  price: number;
  image: string;
}

interface DailySales {
  key: string;
  label: string;
  revenue: number;
  orders: number;
}

function formatPrice(amount: number) {
  return `Rs. ${Math.round(amount || 0).toLocaleString("en-PK")}`;
}

function getDate(timestamp?: { seconds?: number } | null) {
  if (!timestamp?.seconds) return null;
  return new Date(timestamp.seconds * 1000);
}

function formatDate(timestamp?: { seconds?: number } | null) {
  const date = getDate(timestamp);

  if (!date) return "—";

  return date.toLocaleDateString("en-PK", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function normalizeStatus(status: string) {
  const value = String(status ?? "").trim().toLowerCase();

  if (value === "completed") return "Completed";
  if (value === "processing") return "Processing";
  if (value === "cancelled") return "Cancelled";

  return "Pending";
}

function normalizePaymentMethod(order: Order) {
  const method = String(
    order.paymentMethod ?? order.payment?.method ?? ""
  )
    .trim()
    .toLowerCase();

  return method === "online" || method === "online payment"
    ? "Online Payment"
    : "COD";
}

/*
  Existing sales rules:
  Online: Pending, Processing and Completed count as sales.
  Online Cancelled orders do not count.
  COD: only Completed orders count as sales.
*/
function shouldCountAsSale(order: Order) {
  const status = normalizeStatus(order.status);
  const method = normalizePaymentMethod(order);

  if (method === "Online Payment") {
    return status !== "Cancelled";
  }

  return status === "Completed";
}

function getOrderItems(order: Order): OrderItem[] {
  if (Array.isArray(order.items) && order.items.length > 0) {
    return order.items;
  }

  if (order.product) {
    return [
      {
        productName: order.product,
        quantity: 1,
        price: order.total,
      },
    ];
  }

  return [];
}

function getItemName(item: OrderItem) {
  return (
    item.productName ||
    item.name ||
    "Product"
  );
}

function getMainProductName(order: Order) {
  const items = getOrderItems(order);
  return items.length > 0 ? getItemName(items[0]) : "Product";
}

function getMainProductImage(order: Order) {
  const items = getOrderItems(order);

  if (items.length > 0) {
    return getProductImage(
      getItemName(items[0]),
      items[0].image
    );
  }

  return getProductImage(order.product || "");
}

function StatusBadge({ status }: { status: string }) {
  const normalized = normalizeStatus(status);

  if (normalized === "Completed") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E6F3EC] px-3 py-1 text-xs font-semibold text-[#286044]">
        <CheckCircle2 size={13} />
        Completed
      </span>
    );
  }

  if (normalized === "Processing") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
        <Clock3 size={13} />
        Processing
      </span>
    );
  }

  if (normalized === "Cancelled") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
        <XCircle size={13} />
        Cancelled
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-700">
      <Clock3 size={13} />
      Pending
    </span>
  );
}

function ProductImage({
  src,
  alt,
}: {
  src: string;
  alt: string;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return (
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#F1EEE7] text-[#8A8D89]">
        <Package size={20} />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      onError={() => setFailed(true)}
      className="h-12 w-12 shrink-0 rounded-xl object-cover"
    />
  );
}

function MetricCard({
  title,
  value,
  icon,
  description,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  description?: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-[#6B706C]">{title}</p>
          <p className="mt-2 break-words text-2xl font-bold text-[#111111] sm:text-3xl">
            {value}
          </p>
          {description && (
            <p className="mt-2 text-xs text-[#858981]">
              {description}
            </p>
          )}
        </div>
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#E8F2EC] text-[#173F35]">
          {icon}
        </div>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dateRange, setDateRange] = useState<7 | 30 | 90>(30);

  // Load orders from Firestore.
  useEffect(() => {
    const ordersQuery = query(
      collection(db, "orders"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      ordersQuery,
      (snapshot) => {
        const data: Order[] = snapshot.docs.map((orderDoc) => {
          const item = orderDoc.data();

          return {
            id: orderDoc.id,
            customerName: String(item.customerName ?? ""),
            customerEmail: String(item.customerEmail ?? ""),
            total: Number(item.total ?? 0),
            status: String(item.status ?? "Pending"),
            paymentMethod: String(item.paymentMethod ?? ""),
            paymentStatus: String(item.paymentStatus ?? ""),
            payment:
              item.payment && typeof item.payment === "object"
                ? item.payment
                : undefined,
            items: Array.isArray(item.items) ? item.items : [],
            product: String(item.product ?? ""),
            createdAt: item.createdAt ?? null,
          };
        });

        setOrders(data);
        setLoading(false);
        setError("");
      },
      (snapshotError) => {
        console.error("Analytics orders error:", snapshotError);
        setError("Unable to load analytics orders. Please check your Firestore permissions.");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Load products from Firestore.
  useEffect(() => {
    const productsQuery = query(
      collection(db, "products"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      productsQuery,
      (snapshot) => {
        const data: Product[] = snapshot.docs.map((productDoc) => {
          const item = productDoc.data();
          const name = String(item.name ?? "").trim();

          return {
            id: productDoc.id,
            name,
            category: String(item.category ?? "Other").trim() || "Other",
            stock: Number(item.stock ?? 0),
            price: Number(item.price ?? 0),
            image: getProductImage(
              name,
              String(item.image ?? "")
            ),
          };
        });

        setProducts(data);
      },
      (snapshotError) => {
        console.error("Analytics products error:", snapshotError);
        setError("Unable to load analytics products. Please check your Firestore permissions.");
      }
    );

    return () => unsubscribe();
  }, []);

  // Include today and the preceding days in the selected calendar range.
  const filteredOrders = useMemo(() => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    startDate.setDate(startDate.getDate() - (dateRange - 1));

    return orders.filter((order) => {
      const date = getDate(order.createdAt);
      return Boolean(date && date >= startDate && date <= today);
    });
  }, [orders, dateRange]);

  const saleOrders = useMemo(
    () => filteredOrders.filter(shouldCountAsSale),
    [filteredOrders]
  );

  const totalSales = useMemo(
    () =>
      saleOrders.reduce(
        (sum, order) => sum + Number(order.total || 0),
        0
      ),
    [saleOrders]
  );

  const averageOrder =
    saleOrders.length > 0 ? totalSales / saleOrders.length : 0;

  const unitsSold = useMemo(
    () =>
      saleOrders.reduce(
        (sum, order) =>
          sum +
          getOrderItems(order).reduce(
            (itemSum, item) =>
              itemSum + Math.max(0, Number(item.quantity ?? 1)),
            0
          ),
        0
      ),
    [saleOrders]
  );

  // Order status counts use the selected date range.
  const completedOrders = filteredOrders.filter(
    (order) => normalizeStatus(order.status) === "Completed"
  ).length;

  const processingOrders = filteredOrders.filter(
    (order) => normalizeStatus(order.status) === "Processing"
  ).length;

  const cancelledOrders = filteredOrders.filter(
    (order) => normalizeStatus(order.status) === "Cancelled"
  ).length;


  // Inventory metrics remain based on all current products.
  const totalStock = products.reduce(
    (sum, product) => sum + product.stock,
    0
  );

  const lowStock = products.filter(
    (product) => product.stock > 0 && product.stock <= 10
  ).length;

  const outOfStock = products.filter(
    (product) => product.stock <= 0
  ).length;

  // Product category counts.
  const categories = useMemo(() => {
    const categoryMap = new Map<string, number>();

    products.forEach((product) => {
      const category = product.category || "Other";
      categoryMap.set(
        category,
        (categoryMap.get(category) || 0) + 1
      );
    });

    return Array.from(categoryMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [products]);

  // Daily sales data for the selected date range.
  const dailySales = useMemo<DailySales[]>(() => {
    const result: DailySales[] = [];
    const dayMap = new Map<string, DailySales>();

    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    startDate.setDate(startDate.getDate() - (dateRange - 1));

    for (let i = 0; i < dateRange; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);

      const key = `${date.getFullYear()}-${String(
        date.getMonth() + 1
      ).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

      const entry: DailySales = {
        key,
        label:
          dateRange === 7
            ? date.toLocaleDateString("en-PK", { weekday: "short" })
            : date.toLocaleDateString("en-PK", {
                month: "short",
                day: "numeric",
              }),
        revenue: 0,
        orders: 0,
      };

      result.push(entry);
      dayMap.set(key, entry);
    }

    saleOrders.forEach((order) => {
      const date = getDate(order.createdAt);
      if (!date) return;

      const key = `${date.getFullYear()}-${String(
        date.getMonth() + 1
      ).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

      const day = dayMap.get(key);
      if (!day) return;

      day.revenue += Number(order.total || 0);
      day.orders += 1;
    });

    return result;
  }, [saleOrders, dateRange]);

  const maxDailyRevenue = Math.max(
    ...dailySales.map((day) => day.revenue),
    1
  );

  // Revenue per product category, calculated from the items in eligible orders.
  const categoryRevenue = useMemo(() => {
    const productMap = new Map(products.map((product) => [product.id, product]));
    const categoryMap = new Map<string, number>();

    saleOrders.forEach((order) => {
      const items = getOrderItems(order);
      const weightedItems = items.map((item) => {
        const quantity = Math.max(0, Number(item.quantity ?? 1));
        const price = Math.max(0, Number(item.price ?? 0));
        return {
          item,
          quantity,
          lineValue: price * quantity,
        };
      });

      const itemValueTotal = weightedItems.reduce(
        (sum, item) => sum + item.lineValue,
        0
      );

      weightedItems.forEach(({ item, lineValue, quantity }) => {
        const product = item.productId
          ? productMap.get(item.productId)
          : undefined;

        const category = product?.category || "Other";
        const itemRevenue =
          itemValueTotal > 0
            ? (Number(order.total || 0) * lineValue) / itemValueTotal
            : weightedItems.length > 0
              ? Number(order.total || 0) / weightedItems.length
              : 0;

        categoryMap.set(
          category,
          (categoryMap.get(category) || 0) + itemRevenue
        );

        // Quantity is intentionally used above to calculate each line's weight.
        void quantity;
      });
    });

    return Array.from(categoryMap.entries())
      .map(([name, revenue]) => ({ name, revenue }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [saleOrders, products]);

  const maxCategoryRevenue = Math.max(
    ...categoryRevenue.map((category) => category.revenue),
    1
  );

  const recentOrders = useMemo(
    () => [...filteredOrders].sort((a, b) => {
      const aTime = getDate(a.createdAt)?.getTime() ?? 0;
      const bTime = getDate(b.createdAt)?.getTime() ?? 0;
      return bTime - aTime;
    }).slice(0, 5),
    [filteredOrders]
  );

  // Download the selected range's daily report as a CSV file.
  function exportReport() {
    const rows = [
      ["Date", "Revenue (PKR)", "Eligible Sales Orders"],
      ...dailySales.map((day) => [
        day.key,
        String(Math.round(day.revenue)),
        String(day.orders),
      ]),
    ];

    const csv = rows
      .map((row) =>
        row
          .map((value) => `"${String(value).replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\r\n");

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `sales-report-${dateRange}-days.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  // Create an SVG line chart without requiring an external chart library.
  const chartPoints = useMemo(() => {
    const width = 760;
    const height = 250;
    const left = 42;
    const right = 16;
    const top = 18;
    const bottom = 35;
    const usableWidth = width - left - right;
    const usableHeight = height - top - bottom;

    return dailySales.map((day, index) => {
      const x =
        dailySales.length <= 1
          ? left + usableWidth / 2
          : left + (index / (dailySales.length - 1)) * usableWidth;

      const y =
        top +
        usableHeight -
        (day.revenue / maxDailyRevenue) * usableHeight;

      return { ...day, x, y };
    });
  }, [dailySales, maxDailyRevenue]);

  const linePath = chartPoints
    .map((point, index) =>
      `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`
    )
    .join(" ");

  const areaPath = chartPoints.length
    ? `${linePath} L ${chartPoints[chartPoints.length - 1].x} 215 L ${chartPoints[0].x} 215 Z`
    : "";

  const labelStep =
    dateRange === 7 ? 1 : dateRange === 30 ? 5 : 15;

  return (
    <DashboardLayout>
      <main className="min-h-screen bg-[#F4EBDD] p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-7xl">
          {/* PAGE HEADER */}
          <div className="mb-7 flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-[#111111]">
                Sales Analytics
              </h1>
              <p className="mt-2 text-sm text-[#6B706C]">
                Track revenue, orders, products and business performance.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 rounded-xl border border-[#E3DCCE] bg-white px-3 py-2.5">
                <CalendarDays size={17} className="text-[#355E4B]" />
                <label
                  htmlFor="analytics-date-range"
                  className="text-sm font-medium text-[#555C56]"
                >
                  Period
                </label>
                <select
                  id="analytics-date-range"
                  value={dateRange}
                  onChange={(event) =>
                    setDateRange(Number(event.target.value) as 7 | 30 | 90)
                  }
                  className="cursor-pointer bg-transparent text-sm font-semibold text-[#173F35] outline-none"
                >
                  <option value={7}>Last 7 days</option>
                  <option value={30}>Last 30 days</option>
                  <option value={90}>Last 90 days</option>
                </select>
              </div>

              <button
                type="button"
                onClick={exportReport}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#355E4B] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#284B3A]"
              >
                <Download size={17} />
                Export CSV
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              <AlertTriangle size={18} className="mt-0.5 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {/* KEY METRICS */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              title="Total Revenue"
              value={loading ? "—" : formatPrice(totalSales)}
              icon={<TrendingUp size={23} />}
              description={`Eligible sales in the last ${dateRange} days`}
            />
            <MetricCard
              title="Total Orders"
              value={loading ? "—" : filteredOrders.length.toLocaleString("en-PK")}
              icon={<ShoppingBag size={23} />}
              description="All orders in the selected period"
            />
            <MetricCard
              title="Average Order Value"
              value={loading ? "—" : formatPrice(averageOrder)}
              icon={<BarChart3 size={23} />}
              description="Revenue divided by eligible sales orders"
            />
            <MetricCard
              title="Units Sold"
              value={loading ? "—" : unitsSold.toLocaleString("en-PK")}
              icon={<Package size={23} />}
              description="Items in eligible sales orders"
            />
          </div>

          {/* SALES LINE CHART */}
          <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
              <div>
                <h2 className="text-lg font-bold text-[#111111]">
                  Sales Over Time
                </h2>
                <p className="mt-1 text-sm text-[#727771]">
                  Daily revenue for the selected {dateRange}-day period
                </p>
              </div>
              <div className="text-lg font-bold text-[#355E4B]">
                {loading ? "—" : formatPrice(totalSales)}
              </div>
            </div>

            <div className="mt-5 w-full overflow-x-auto">
              <svg
                viewBox="0 0 760 250"
                role="img"
                aria-label={`Sales revenue line chart for the last ${dateRange} days`}
                className="h-auto min-w-[540px] w-full"
              >
                {[0, 1, 2, 3].map((tick) => {
                  const y = 18 + tick * 65;
                  const value = maxDailyRevenue * (1 - tick / 3);

                  return (
                    <g key={tick}>
                      <line
                        x1="42"
                        y1={y}
                        x2="744"
                        y2={y}
                        stroke="#EAE7E0"
                        strokeDasharray="4 5"
                      />
                      <text
                        x="35"
                        y={y + 4}
                        textAnchor="end"
                        fontSize="10"
                        fill="#777C77"
                      >
                        {value >= 1000
                          ? `${Math.round(value / 1000)}k`
                          : Math.round(value)}
                      </text>
                    </g>
                  );
                })}

                {areaPath && (
                  <path
                    d={areaPath}
                    fill="#DCEBE1"
                    opacity="0.8"
                  />
                )}

                {linePath && (
                  <path
                    d={linePath}
                    fill="none"
                    stroke="#355E4B"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {chartPoints.map((point, index) => {
                  const showLabel =
                    index === 0 ||
                    index === chartPoints.length - 1 ||
                    index % labelStep === 0;

                  return (
                    <g key={point.key}>
                      <circle
                        cx={point.x}
                        cy={point.y}
                        r={dateRange === 7 ? 4 : 2.5}
                        fill="#355E4B"
                        stroke="white"
                        strokeWidth="1.5"
                      >
                        <title>
                          {point.key}: {formatPrice(point.revenue)} ({point.orders} orders)
                        </title>
                      </circle>

                      {showLabel && (
                        <text
                          x={point.x}
                          y="240"
                          textAnchor="middle"
                          fontSize="10"
                          fill="#777C77"
                        >
                          {point.label}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>

            {!loading && saleOrders.length === 0 && (
              <p className="mt-2 text-center text-sm text-[#858981]">
                No eligible sales found in this period.
              </p>
            )}
          </section>

          {/* CATEGORY REVENUE + ORDER STATUS */}
          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            <section className="rounded-2xl bg-white p-5 shadow-sm sm:p-6">
              <div>
                <h2 className="text-lg font-bold text-[#111111]">
                  Revenue by Product Category
                </h2>
                <p className="mt-1 text-sm text-[#727771]">
                  Revenue distribution in the selected period
                </p>
              </div>

              {categoryRevenue.length === 0 ? (
                <div className="py-12 text-center text-sm text-[#858981]">
                  No category sales data available for this period.
                </div>
              ) : (
                <div className="mt-6 space-y-5">
                  {categoryRevenue.map((category, index) => {
                    const percentage =
                      totalSales > 0
                        ? (category.revenue / totalSales) * 100
                        : 0;

                    return (
                      <div key={category.name}>
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-2">
                            <span
                              className={`h-3 w-3 shrink-0 rounded-full ${
                                index % 4 === 0
                                  ? "bg-[#355E4B]"
                                  : index % 4 === 1
                                    ? "bg-[#79A88A]"
                                    : index % 4 === 2
                                      ? "bg-[#D6B477]"
                                      : "bg-[#91BFC0]"
                              }`}
                            />
                            <span className="truncate text-sm font-semibold text-[#303530]">
                              {category.name}
                            </span>
                          </div>
                          <span className="shrink-0 text-sm font-bold text-[#222222]">
                            {formatPrice(category.revenue)}
                          </span>
                        </div>

                        <div className="h-2.5 overflow-hidden rounded-full bg-[#F0EEE8]">
                          <div
                            className={`h-full rounded-full transition-all ${
                              index % 4 === 0
                                ? "bg-[#355E4B]"
                                : index % 4 === 1
                                  ? "bg-[#79A88A]"
                                  : index % 4 === 2
                                    ? "bg-[#D6B477]"
                                    : "bg-[#91BFC0]"
                            }`}
                            style={{
                              width: `${Math.min(100, (category.revenue / maxCategoryRevenue) * 100)}%`,
                            }}
                          />
                        </div>

                        <p className="mt-1 text-xs text-[#858981]">
                          {percentage.toFixed(1)}% of total revenue
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="rounded-2xl bg-white p-5 shadow-sm sm:p-6">
              <div>
                <h2 className="text-lg font-bold text-[#111111]">
                  Order Status
                </h2>
                <p className="mt-1 text-sm text-[#727771]">
                  Order breakdown for the selected period
                </p>
              </div>

              <div className="mt-6 space-y-5">
                {[
                  {
                    label: "Completed",
                    count: completedOrders,
                    color: "bg-[#355E4B]",
                  },
                  {
                    label: "Processing",
                    count: processingOrders,
                    color: "bg-amber-500",
                  },
                 
                  {
                    label: "Cancelled",
                    count: cancelledOrders,
                    color: "bg-red-500",
                  },
                ].map((status) => {
                  const percentage =
                    filteredOrders.length > 0
                      ? (status.count / filteredOrders.length) * 100
                      : 0;

                  return (
                    <div key={status.label}>
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-sm font-semibold text-[#303530]">
                          {status.label}
                        </span>
                        <span className="text-sm font-bold text-[#222222]">
                          {status.count}
                        </span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-[#F0EEE8]">
                        <div
                          className={`h-full rounded-full ${status.color}`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-[#858981]">
                        {percentage.toFixed(1)}% of orders
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          {/* INVENTORY SUMMARY */}
          <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#E8F2EC] text-[#355E4B]">
                <Package size={22} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-[#111111]">
                  Inventory Summary
                </h2>
                <p className="mt-1 text-sm text-[#727771]">
                  Current inventory levels across all products
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl bg-[#F8F7F2] p-4">
                <p className="text-sm text-[#6B706C]">Products</p>
                <p className="mt-2 text-2xl font-bold text-[#222222]">
                  {loading ? "—" : products.length}
                </p>
              </div>
              <div className="rounded-xl bg-[#F8F7F2] p-4">
                <p className="text-sm text-[#6B706C]">Total Units in Stock</p>
                <p className="mt-2 text-2xl font-bold text-[#222222]">
                  {loading ? "—" : totalStock.toLocaleString("en-PK")}
                </p>
              </div>
              <div className="rounded-xl bg-amber-50 p-4">
                <p className="text-sm text-amber-800">Low Stock Products</p>
                <p className="mt-2 text-2xl font-bold text-amber-800">
                  {loading ? "—" : lowStock}
                </p>
                <p className="mt-1 text-xs text-amber-700">
                  Between 1 and 10 units
                </p>
              </div>
              <div className="rounded-xl bg-red-50 p-4">
                <p className="text-sm text-red-700">Out of Stock</p>
                <p className="mt-2 text-2xl font-bold text-red-700">
                  {loading ? "—" : outOfStock}
                </p>
              </div>
            </div>

            {lowStock > 0 && (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <AlertTriangle size={18} className="mt-0.5 shrink-0" />
                <p>
                  {lowStock} product{lowStock === 1 ? "" : "s"} need restocking.
                </p>
              </div>
            )}
          </section>

          {/* PRODUCT CATEGORIES */}
          <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm sm:p-6">
            <div>
              <h2 className="text-lg font-bold text-[#111111]">
                Product Categories
              </h2>
              <p className="mt-1 text-sm text-[#727771]">
                Number of products in each category
              </p>
            </div>

            {categories.length === 0 ? (
              <p className="py-8 text-center text-sm text-[#858981]">
                No products available.
              </p>
            ) : (
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {categories.map((category) => (
                  <div
                    key={category.name}
                    className="flex items-center justify-between rounded-xl border border-[#ECE7DE] bg-[#FCFAF6] p-4"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E8F2EC] text-[#355E4B]">
                        <Package size={19} />
                      </div>
                      <span className="truncate text-sm font-semibold text-[#303530]">
                        {category.name}
                      </span>
                    </div>
                    <span className="ml-3 rounded-lg bg-white px-3 py-1.5 text-sm font-bold text-[#355E4B]">
                      {category.count}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* RECENT ORDERS */}
          <section className="mt-6 overflow-hidden rounded-2xl bg-white shadow-sm">
            <div className="flex flex-col justify-between gap-2 border-b border-[#ECE7DE] p-5 sm:flex-row sm:items-center sm:px-6">
              <div>
                <h2 className="text-lg font-bold text-[#111111]">
                  Recent Orders
                </h2>
                <p className="mt-1 text-sm text-[#727771]">
                  Latest orders in the selected period
                </p>
              </div>
              <span className="text-sm font-semibold text-[#355E4B]">
                {filteredOrders.length} orders
              </span>
            </div>

            {loading ? (
              <div className="p-10 text-center text-sm text-[#777C77]">
                Loading analytics...
              </div>
            ) : recentOrders.length === 0 ? (
              <div className="p-10 text-center text-sm text-[#777C77]">
                No orders found for this date range.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px]">
                  <thead>
                    <tr className="border-b border-[#ECE7DE] bg-[#FBF9F5]">
                      <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wide text-[#777C77]">
                        Customer
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wide text-[#777C77]">
                        Product
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wide text-[#777C77]">
                        Amount
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wide text-[#777C77]">
                        Status
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wide text-[#777C77]">
                        Date
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {recentOrders.map((order) => {
                      const productName = getMainProductName(order);
                      const productImage = getMainProductImage(order);

                      return (
                        <tr
                          key={order.id}
                          className="border-b border-[#F0ECE4] last:border-0 hover:bg-[#FCFAF6]"
                        >
                          <td className="px-6 py-4">
                            <p className="text-sm font-semibold text-[#222222]">
                              {order.customerName || "Customer"}
                            </p>
                            <p className="mt-1 text-xs text-[#777C77]">
                              {order.customerEmail || "—"}
                            </p>
                          </td>

                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <ProductImage
                                src={productImage}
                                alt={productName}
                              />
                              <div className="min-w-0">
                                <p className="max-w-xs truncate text-sm font-semibold text-[#222222]">
                                  {productName}
                                </p>
                                {getOrderItems(order).length > 1 && (
                                  <p className="mt-1 text-xs text-[#777C77]">
                                    +{getOrderItems(order).length - 1} more
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>

                          <td className="px-6 py-4 text-sm font-bold text-[#222222]">
                            {formatPrice(order.total)}
                          </td>

                          <td className="px-6 py-4">
                            <StatusBadge status={order.status} />
                          </td>

                          <td className="px-6 py-4 text-sm text-[#777C77]">
                            {formatDate(order.createdAt)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </main>
    </DashboardLayout>
  );
}
