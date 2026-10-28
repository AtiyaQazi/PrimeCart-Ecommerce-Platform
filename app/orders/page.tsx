"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Eye,
  Loader2,
  Package,
  Search,
  ShoppingBag,
  Trash2,
  User,
  X,
} from "lucide-react";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import DashboardLayout from "@/components/layout/DashboardLayout";

interface OrderItem {
  productId?: string;
  id?: string;
  name?: string;
  quantity: number;
  price: number;
  image?: string;
}

interface PaymentDetails {
  method?:
    | "COD"
    | "Online Payment"
    | "Cash on Delivery"
    | string;

  status?:
    | "Pending"
    | "Paid"
    | "Failed"
    | "Refunded"
    | string;

  payerName?: string;
  paymentNumber?: string;
  accountNumber?: string;
  accountName?: string;
  amount?: number;
  reference?: string;
}

interface Order {
  id: string;

  orderId?: string;

  customerName: string;
  customerEmail: string;
  customerPhone: string;
  deliveryAddress: string;
  city: string;

  items?: OrderItem[];

  product?: string;
  productName?: string;
  quantity?: number;

  total: number;

  paymentMethod?:
    | "COD"
    | "Online Payment"
    | string;

  paymentStatus?:
    | "Pending"
    | "Paid"
    | "Failed"
    | string;

  payment?: PaymentDetails;

  status:
    | "Pending"
    | "Processing"
    | "Completed"
    | "Cancelled"
    | string;

  createdAt?: {
    seconds?: number;
    nanoseconds?: number;
  };

  updatedAt?: {
    seconds?: number;
    nanoseconds?: number;
  };
}

const statusOptions = [
  "All",
  "Processing",
  "Completed",
  "Cancelled",
];

const LOCAL_PRODUCT_IMAGES: Record<string, string> = {
  "analog wrist watch": "/products/analog-wrist-watch.jpeg",
  "artificial plant": "/products/artificial-plant.jpeg",
  "bluetooth speaker": "/products/bluetooth-speaker.jpeg",
  "canvas backpack": "/products/canvas-backpack.jpeg",
  "casual polo shirt": "/products/casual-polo-shirt.jpeg",
  "ceramic coffee mug": "/products/ceramic-coffee-mug.jpeg",
  chain: "/products/chain.jpeg",
  "classic cotton t-shirt":
    "/products/classic-cotton-t-shirt.jpeg",
  "classic sunglasses":
    "/products/classic-sunglasses.jpeg",
  "cotton hoodie": "/products/cotton-hoodie.jpeg",
  "cushion cover set":
    "/products/cushion-cover-set.jpeg",
  "decorative mirror":
    "/products/decorative-mirror.jpeg",
  "decorative vase":
    "/products/decorative-vase.jpeg",
  "denim jeans": "/products/denim-jeans.jpeg",
  "desk calendar": "/products/desk-calendar.jpeg",
  "face mask": "/products/face-mask.jpeg",
  "fashion handbag":
    "/products/fashion-handbag.jpeg",
  "formal shirt": "/products/formal-shirt.jpeg",
  "gentle face cleanser":
    "/products/gentle-face-cleanser.jpeg",
  "gift box": "/products/gift-box.jpeg",
  "glass water bottle":
    "/products/glass-water-bottle.jpeg",
  "hair clip set":
    "/products/hair-clip-set.jpeg",
  "hair conditioner":
    "/products/hair-conditioner.jpeg",
  "hair serum": "/products/hair-serum.jpeg",
  "hooded sweatshirt":
    "/products/hooded-sweatshirt.jpeg",
  "hydrating face cream":
    "/products/hydrating-face-cream.jpeg",
  "keychain set": "/products/keychain-set.jpeg",
  "laptop sleeve": "/products/laptop-sleeve.jpeg",
  "laundry basket":
    "/products/laundry-basket.jpeg",
  "leather wallet":
    "/products/leather-wallet.jpeg",
  "linen trousers":
    "/products/linen-trousers.jpeg",
  "lip balm": "/products/lip-balm.jpeg",
  "lunch box": "/products/lunch-box.jpg",
  "makeup brush set":
    "/products/makeup-brush-set.jpg",
  "mechanical keyboard":
    "/products/mechanical-keyboard.jpeg",
  "notebook set": "/products/notebook-set.jpeg",
  "pearl drop earrings":
    "/products/pearl-drop-earrings.jpeg",
  "perfume mist": "/products/perfume-mist.jpeg",
  "photo frame": "/products/photo-frame.jpeg",
  "portable mini fan":
    "/products/portable-mini-fan.jpg",
  

  "power bank": "/products/power-bank.jpeg",
  "reusable shopping bag":
    "/products/reusable-shopping-bag.jpeg",
  ring: "/products/ring.jpeg",
  "rose face toner":
    "/products/rose-face-toner.jpg",
  "scented candle":
    "/products/scented-candle.jpeg",
  "simple lace shawl": "/products/shawl.jpg",
  "smart led bulb":
    "/products/smart-led-bulb.jpeg",
  "smart watch": "/products/smart-watch.jpeg",
  "sports tracksuit":
    "/products/sports-tracksuit.jpeg",
  "stationery set":
    "/products/stationery-set.jpeg",
  "summer dress": "/products/summer-dress.jpeg",
  "tablet stand": "/products/tablet-stand.jpeg",
  "travel mug": "/products/travel-mug.jpeg",
  "travel organizer":
    "/products/travel-organizer.jpeg",
  "travel pillow":
    "/products/travel-pillow.jpeg",
  "travel pouch":
    "/products/travel-pouch.jpeg",
  "usb c charger":
    "/products/usb-c-charger.jpg",
  "usb flash drive":
    "/products/usb-flash-drive.jpeg",
  "vitamin c serum":
    "/products/vitamin-c-serum.jpeg",
  "wall clock": "/products/wall-clock.jpeg",
  "wall hanging shelf":
    "/products/wall-hanging-shelf.jpg",
  "winter jacket":
    "/products/winter-jacket.jpeg",
  "wireless headphones":
    "/products/wireless-headphones.jpeg",
  "wireless mouse":
    "/products/wireless-mouse.jpeg",
};

function normalizeName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function normalizePaymentValue(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ");
}

/*
 * Convert filename/path into a readable product name.
 */
function nameFromImagePath(image?: string) {
  if (!image?.trim()) {
    return "";
  }

  const fileName = image
    .split("/")
    .pop()
    ?.split("?")[0]
    ?.toLowerCase()
    .trim();

  if (!fileName) {
    return "";
  }

  const matchedEntry = Object.entries(
    LOCAL_PRODUCT_IMAGES
  ).find(([, imagePath]) => {
    const storedFileName = imagePath
      .split("/")
      .pop()
      ?.toLowerCase()
      .trim();

    return storedFileName === fileName;
  });

  if (matchedEntry) {
    return matchedEntry[0]
      .split(" ")
      .map(
        (word) =>
          word.charAt(0).toUpperCase() +
          word.slice(1)
      )
      .join(" ");
  }

  const fallbackName = fileName
    .replace(
      /\.(jpeg|jpg|png|webp)$/i,
      ""
    )
    .replace(/[-_]+/g, " ")
    .trim();

  if (!fallbackName) {
    return "";
  }

  return fallbackName
    .split(" ")
    .map(
      (word) =>
        word.charAt(0).toUpperCase() +
        word.slice(1)
    )
    .join(" ");
}

/*
 * Resolve product name from every possible
 * place an old/new order may have stored it.
 */
function getProductName(
  name?: string,
  image?: string,
  productId?: string
) {
  if (
    name?.trim() &&
    normalizeName(name) !== "unknown product"
  ) {
    return name.trim();
  }

  const imageName = nameFromImagePath(image);

  if (imageName) {
    return imageName;
  }

  if (productId?.trim()) {
    const normalizedId = productId
      .trim()
      .toLowerCase();

    if (
      LOCAL_PRODUCT_IMAGES[normalizedId]
    ) {
      return normalizedId
        .split(" ")
        .map(
          (word) =>
            word.charAt(0).toUpperCase() +
            word.slice(1)
        )
        .join(" ");
    }

    if (
      normalizedId.includes("-") ||
      normalizedId.includes("_")
    ) {
      return normalizedId
        .replace(/[-_]+/g, " ")
        .split(" ")
        .map(
          (word) =>
            word.charAt(0).toUpperCase() +
            word.slice(1)
        )
        .join(" ");
    }
  }

  return "Unknown Product";
}

/*
 * Resolve product image.
 */
function getProductImage(
  name?: string,
  image?: string,
  productId?: string
) {
  if (image?.trim()) {
    return image.trim();
  }

  if (name?.trim()) {
    const normalized = normalizeName(name);

    if (
      LOCAL_PRODUCT_IMAGES[normalized]
    ) {
      return LOCAL_PRODUCT_IMAGES[normalized];
    }

    const filenameStyle = normalized
      .replace(
        /\.(jpeg|jpg|png|webp)$/i,
        ""
      )
      .replace(/[-_]+/g, " ");

    if (
      LOCAL_PRODUCT_IMAGES[filenameStyle]
    ) {
      return LOCAL_PRODUCT_IMAGES[filenameStyle];
    }
  }

  if (productId?.trim()) {
    const normalizedId =
      normalizeName(productId);

    if (
      LOCAL_PRODUCT_IMAGES[normalizedId]
    ) {
      return LOCAL_PRODUCT_IMAGES[normalizedId];
    }

    const idAsName = normalizedId
      .replace(/[-_]+/g, " ");

    if (
      LOCAL_PRODUCT_IMAGES[idAsName]
    ) {
      return LOCAL_PRODUCT_IMAGES[idAsName];
    }
  }

  return "";
}

function formatPrice(
  value: number | undefined
) {
  return `Rs. ${Math.round(
    value || 0
  ).toLocaleString("en-PK")}`;
}

function formatDate(timestamp?: {
  seconds?: number;
  nanoseconds?: number;
}) {
  if (!timestamp?.seconds) {
    return "—";
  }

  const date = new Date(
    timestamp.seconds * 1000
  );

  return date.toLocaleDateString(
    "en-PK",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  );
}

function formatDateTime(timestamp?: {
  seconds?: number;
  nanoseconds?: number;
}) {
  if (!timestamp?.seconds) {
    return "—";
  }

  const date = new Date(
    timestamp.seconds * 1000
  );

  return date.toLocaleString(
    "en-PK",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  );
}

function getStatusClasses(
  status: string
) {
  switch (status) {
    case "Completed":
      return "bg-[#E6F3EC] text-[#286044] border border-[#D5E9DD]";

    case "Processing":
      return "bg-[#E8F2EC] text-[#355E4B] border border-[#D8E7DD]";

    case "Cancelled":
      return "bg-red-50 text-red-600 border border-red-100";

    default:
      return "bg-amber-50 text-amber-700 border border-amber-100";
  }
}

function getPaymentStatusClasses(
  status: string
) {
  switch (status) {
    case "Paid":
      return "bg-[#E6F3EC] text-[#286044] border border-[#D5E9DD]";

    case "Failed":
      return "bg-red-50 text-red-600 border border-red-100";

    default:
      return "bg-amber-50 text-amber-700 border border-amber-100";
  }
}

function maskPaymentNumber(
  value?: string
) {
  if (!value) {
    return "—";
  }

  const cleaned = value.trim();

  if (cleaned.includes("*")) {
    return cleaned;
  }

  if (cleaned.length <= 4) {
    return cleaned;
  }

  return `${"*".repeat(
    Math.max(
      0,
      cleaned.length - 4
    )
  )}${cleaned.slice(-4)}`;
}

function getOrderItems(
  order: Order
): OrderItem[] {
  if (
    order.items &&
    order.items.length > 0
  ) {
    return order.items;
  }

  /*
   * Backward compatibility.
   */
  if (
    order.productName ||
    order.product
  ) {
    return [
      {
        name:
          order.productName ||
          order.product ||
          "",
        quantity:
          order.quantity || 1,
        price:
          order.quantity &&
          order.quantity > 0
            ? order.total /
              order.quantity
            : order.total,
      },
    ];
  }

  return [];
}

function getPaymentMethod(
  order: Order
) {
  const method = String(
    order.paymentMethod ||
      order.payment?.method ||
      "COD"
  ).trim();

  const normalized = method
    .toLowerCase()
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ");

  if (
    normalized === "cash on delivery" ||
    normalized === "cod"
  ) {
    return "COD";
  }

  if (
    normalized === "online" ||
    normalized === "onlinepayment" ||
    normalized === "online payment"
  ) {
    return "Online Payment";
  }

  return method;
}

function isCancelledCOD(order: Order) {
  const normalizedStatus =
    normalizePaymentValue(order.status);

  return (
    getPaymentMethod(order) === "COD" &&
    (
      normalizedStatus === "cancelled" ||
      normalizedStatus === "canceled"
    )
  );
}

/*
 * Payment status display logic.
 *
 * Cancelled orders should not show
 * Paid / Pending / Failed.
 */
function getPaymentStatus(order: Order) {
  const method = getPaymentMethod(order);

  const normalizedStatus = String(order.status ?? "")
    .trim()
    .toLowerCase();

  // COD cancelled → payment status hide
  if (
    method === "COD" &&
    (normalizedStatus === "cancelled" ||
      normalizedStatus === "canceled")
  ) {
    return "";
  }

  // Online Payment cancelled → show Refund
  if (
    method === "Online Payment" &&
    (normalizedStatus === "cancelled" ||
      normalizedStatus === "canceled")
  ) {
    return "Refund";
  }

  return (
    order.paymentStatus ||
    order.payment?.status ||
    "Paid"
  );
}

/*
 * IMPORTANT SALES LOGIC
 *
 * Paid + Processing = SALE
 * Paid + Completed = SALE
 *
 * Pending = NOT SALE
 * Failed = NOT SALE
 * Cancelled = NOT SALE
 *
 * Both COD and Online Payment are valid.
 */
function isSaleOrder(order: Order) {
  const orderStatus =
    normalizePaymentValue(order.status);

  const paymentStatus =
    normalizePaymentValue(
      order.paymentStatus ||
        order.payment?.status
    );

  const paymentMethod =
    normalizePaymentValue(
      order.paymentMethod ||
        order.payment?.method
    );

  /*
   * Cancelled orders are never sales.
   */
  if (
    orderStatus === "cancelled" ||
    orderStatus === "canceled"
  ) {
    return false;
  }

  /*
   * Failed payments are never sales.
   */
  if (paymentStatus === "failed") {
    return false;
  }

  /*
   * Only Paid orders count as sales.
   */
  if (paymentStatus !== "paid") {
    return false;
  }

  /*
   * Only Processing and Completed orders
   * count as sales.
   */
  if (
    orderStatus !== "processing" &&
    orderStatus !== "completed"
  ) {
    return false;
  }

  /*
   * COD and Online Payment are supported.
   */
  const validPaymentMethod =
    paymentMethod === "cod" ||
    paymentMethod === "cash on delivery" ||
    paymentMethod === "online" ||
    paymentMethod === "online payment";

  return validPaymentMethod;
}

function getPaymentNumber(
  order: Order
) {
  return (
    order.payment
      ?.paymentNumber ||
    order.payment
      ?.accountNumber ||
    ""
  );
}

function getPayerName(
  order: Order
) {
  return (
    order.payment
      ?.payerName ||
    order.payment
      ?.accountName ||
    "—"
  );
}

function getPaymentReference(
  order: Order
) {
  return (
    order.payment
      ?.reference ||
    "—"
  );
}

export default function OrdersPage() {
  const [
    orders,
    setOrders,
  ] = useState<Order[]>([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    statusFilter,
    setStatusFilter,
  ] = useState("All");

  const [
    selectedOrder,
    setSelectedOrder,
  ] =
    useState<Order | null>(null);

  const [
    updatingId,
    setUpdatingId,
  ] =
    useState<string | null>(null);

  const [
    deletingId,
    setDeletingId,
  ] =
    useState<string | null>(null);

  const [
    openStatusId,
    setOpenStatusId,
  ] =
    useState<string | null>(null);

  useEffect(() => {
    const ordersQuery =
      query(
        collection(
          db,
          "orders"
        ),
        orderBy(
          "createdAt",
          "desc"
        )
      );

    const unsubscribe =
      onSnapshot(
        ordersQuery,
        (snapshot) => {
          const orderData: Order[] =
            snapshot.docs.map(
              (item) => {
                const data =
                  item.data();

                return {
                  id: item.id,
                  ...data,
                  total: Number(
                    data.total || 0
                  ),
                } as Order;
              }
            );

          setOrders(
            orderData
          );

          setLoading(false);
        },
        (error) => {
          console.error(
            "Orders listener error:",
            error
          );

          setLoading(false);
        }
      );

    return () =>
      unsubscribe();
  }, []);

  const filteredOrders =
    useMemo(() => {
      const queryText =
        search
          .trim()
          .toLowerCase();

      return orders.filter(
        (order) => {
          const matchesStatus =
            statusFilter ===
              "All" ||
            order.status ===
              statusFilter;

          if (
            !matchesStatus
          ) {
            return false;
          }

          if (!queryText) {
            return true;
          }

          const orderItems =
            getOrderItems(
              order
            );

          const productNames =
            orderItems
              .map(
                (item) =>
                  getProductName(
                    item.name,
                    item.image,
                    item.productId ||
                      item.id
                  )
              )
              .join(" ");

          return [
            order.id,
            order.orderId,
            order.customerName,
            order.customerEmail,
            order.customerPhone,
            order.city,
            productNames,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(
              queryText
            );
        }
      );
    }, [
      orders,
      search,
      statusFilter,
    ]);

  /*
   * ORDER STATISTICS
   *
   * Sales are calculated independently
   * from the Completed count.
   */
  const stats =
    useMemo(() => {
      const totalOrders =
        orders.length;

      const pending =
        orders.filter(
          (order) =>
            normalizePaymentValue(
              order.status
            ) === "pending"
        ).length;

      const processing =
        orders.filter(
          (order) =>
            normalizePaymentValue(
              order.status
            ) === "processing"
        ).length;

      const completed =
        orders.filter(
          (order) =>
            normalizePaymentValue(
              order.status
            ) === "completed"
        ).length;

      const cancelled =
        orders.filter(
          (order) => {
            const status =
              normalizePaymentValue(
                order.status
              );

            return (
              status === "cancelled" ||
              status === "canceled"
            );
          }
        ).length;

      /*
       * IMPORTANT:
       *
       * Processing + Paid
       * and
       * Completed + Paid
       *
       * both count as Sales.
       */
      const saleOrders =
        orders.filter(
          (order) =>
            isSaleOrder(order)
        );

      const totalSales =
        saleOrders.reduce(
          (
            sum,
            order
          ) => {
            const amount =
              Number(
                order.total || 0
              );

            return Number.isFinite(
              amount
            )
              ? sum + amount
              : sum;
          },
          0
        );

      return {
        totalOrders,
        pending,
        processing,
        completed,
        cancelled,
        totalSales,
      };
    }, [orders]);

  async function updateOrderStatus(
    orderId: string,
    newStatus: string
  ) {
    try {
      setUpdatingId(
        orderId
      );

      setOpenStatusId(
        null
      );

      const response =
        await fetch(
          "/api/orders",
          {
            method: "PATCH",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              orderId,
              status:
                newStatus,
            }),
          }
        );

      const result =
        await response.json();

      if (
        !response.ok ||
        !result.success
      ) {
        throw new Error(
          result.error ||
            "Failed to update order status."
        );
      }

      const updatedPayment =
        result.payment ?? {};

      const updatedStatus =
        result.status ??
        newStatus;

      const currentOrder =
        orders.find(
          (order) =>
            order.id ===
            orderId
        );

      const mergedOrder =
        {
          ...currentOrder,
          ...(result.order ?? {}),
          status:
            updatedStatus,
        } as Order;

      const cancelled =
        String(
          updatedStatus
        )
          .trim()
          .toLowerCase() ===
          "cancelled";

      const updatedPaymentStatus =
        cancelled
          ? ""
          : result.paymentStatus ??
            currentOrder?.paymentStatus ??
            result.payment?.status ??
            currentOrder?.payment?.status ??
            "Pending";

      /*
       * Keep UI immediately in sync.
       *
       * Firestore/API remains the source of truth.
       */
      setOrders(
        (current) =>
          current.map(
            (order) =>
              order.id ===
              orderId
                ? {
                    ...order,
                    ...(result.order ??
                      {}),
                    status:
                      updatedStatus,
                    paymentStatus:
                      updatedPaymentStatus,
                    payment: {
                      ...order.payment,
                      ...updatedPayment,
                    },
                  }
                : order
          )
      );

      setSelectedOrder(
        (current) =>
          current?.id ===
          orderId
            ? {
                ...current,
                ...(result.order ??
                  {}),
                status:
                  updatedStatus,
                paymentStatus:
                  updatedPaymentStatus,
                payment: {
                  ...current.payment,
                  ...updatedPayment,
                },
              }
            : current
      );
    } catch (error) {
      console.error(
        "Failed to update order status:",
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : "Failed to update order status."
      );
    } finally {
      setUpdatingId(
        null
      );
    }
  }

  async function deleteOrder(
    orderId: string
  ) {
    const confirmed =
      window.confirm(
        "Are you sure you want to delete this order?"
      );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingId(
        orderId
      );

      await deleteDoc(
        doc(
          db,
          "orders",
          orderId
        )
      );

      if (
        selectedOrder?.id ===
        orderId
      ) {
        setSelectedOrder(
          null
        );
      }
    } catch (error) {
      console.error(
        "Failed to delete order:",
        error
      );

      alert(
        "Failed to delete order."
      );
    } finally {
      setDeletingId(
        null
      );
    }
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-[#F4EBDD] px-4 py-6 text-[#111111] sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1600px]">

          {/* HEADER */}
         <div className="mb-7 flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-[#111111]">
             Orders
              </h1>
              <p className="mt-2 text-sm text-[#6B706C]">
                 Manage customer orders, payments and
                delivery status.
              </p>
            </div>

            <div className="rounded-xl border border-[#D8D4CB] bg-white px-4 py-3 shadow-sm">
              <p className="text-xs font-medium text-[#777C77]">
                Completed Sales
              </p>

              <p className="mt-1 text-lg font-bold text-[#173F35]">
                {formatPrice(
                  stats.totalSales
                )}
              </p>
            </div>
          </div>

          {/* STATS */}
          <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">

            <div className="rounded-xl border border-[#D8D4CB] bg-white p-4 shadow-sm">
              <p className="text-xs font-medium text-[#777C77]">
                Total Orders
              </p>

              <p className="mt-2 text-2xl font-bold text-[#173F35]">
                {stats.totalOrders}
              </p>
            </div>

            <div className="rounded-xl border border-[#D8D4CB] bg-white p-4 shadow-sm">
              <p className="text-xs font-medium text-[#777C77]">
                Processing
              </p>

              <p className="mt-2 text-2xl font-bold text-[#355E4B]">
                {stats.processing}
              </p>
            </div>

            <div className="rounded-xl border border-[#D8D4CB] bg-white p-4 shadow-sm">
              <p className="text-xs font-medium text-[#777C77]">
                Completed
              </p>

              <p className="mt-2 text-2xl font-bold text-[#286044]">
                {stats.completed}
              </p>
            </div>

            <div className="rounded-xl border border-[#D8D4CB] bg-white p-4 shadow-sm">
              <p className="text-xs font-medium text-[#777C77]">
                Cancelled
              </p>

              <p className="mt-2 text-2xl font-bold text-red-600">
                {stats.cancelled}
              </p>
            </div>
          </div>

          {/* FILTERS */}
          <div className="mb-5 flex flex-col gap-3 rounded-xl border border-[#D8D4CB] bg-white p-4 shadow-sm lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8A8D89]" />

              <input
                type="text"
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder="Search by order, customer, email or product..."
                className="h-11 w-full rounded-lg border border-[#D8D4CB] bg-[#FBF9F5] pl-10 pr-4 text-sm text-[#222222] outline-none transition placeholder:text-[#8A8D89] focus:border-[#355E4B] focus:ring-2 focus:ring-[#355E4B]/10"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {statusOptions.map(
                (status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() =>
                      setStatusFilter(
                        status
                      )
                    }
                    className={`rounded-lg px-4 py-2.5 text-sm font-medium transition ${
                      statusFilter ===
                      status
                        ? "bg-[#173F35] text-white"
                        : "border border-[#D8D4CB] bg-[#FBF9F5] text-[#555C56] hover:bg-[#EEEAE1]"
                    }`}
                  >
                    {status}
                  </button>
                )
              )}
            </div>
          </div>

          {/* TABLE */}
          <div className="overflow-hidden rounded-xl border border-[#D8D4CB] bg-white shadow-sm">
            {loading ? (
              <div className="flex min-h-[400px] items-center justify-center">
                <div className="flex items-center gap-2 text-sm text-[#68706A]">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Loading orders...
                </div>
              </div>
            ) : filteredOrders.length ===
              0 ? (
              <div className="flex min-h-[400px] flex-col items-center justify-center px-6 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#F1EEE7]">
                  <ShoppingBag className="h-7 w-7 text-[#6C746D]" />
                </div>

                <h3 className="text-base font-semibold text-[#173F35]">
                  No orders found
                </h3>

                <p className="mt-1 max-w-md text-sm text-[#777C77]">
                  {search ||
                  statusFilter !==
                    "All"
                    ? "Try changing your search or status filter."
                    : "Customer orders will appear here when they are placed."}
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1100px]">
                    <thead>
                      <tr className="border-b border-[#ECE7DE] bg-[#FBF9F5]">
                        <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-[#777C77]">
                          Order
                        </th>

                        <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-[#777C77]">
                          Customer
                        </th>

                        <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-[#777C77]">
                          Product(s)
                        </th>

                        <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-[#777C77]">
                          Date
                        </th>

                        <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-[#777C77]">
                          Amount
                        </th>

                        <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-[#777C77]">
                          Payment
                        </th>

                        <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-[#777C77]">
                          Status
                        </th>

                        <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide text-[#777C77]">
                          Action
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-[#ECE7DE]">
                      {filteredOrders.map(
                        (order) => {
                          const items =
                            getOrderItems(
                              order
                            );

                          const paymentMethod =
                            getPaymentMethod(
                              order
                            );

                          const paymentStatus =
                            getPaymentStatus(
                              order
                            );

                          return (
                            <tr
                              key={
                                order.id
                              }
                              className="transition hover:bg-[#FCFAF6]"
                            >
                              {/* ORDER */}
                              <td className="px-5 py-4 align-top">
                                <p className="font-semibold text-[#173F35]">
                                  #
                                  {order.orderId ||
                                    order.id
                                      .slice(
                                        0,
                                        8
                                      )
                                      .toUpperCase()}
                                </p>

                                <p className="mt-1 text-xs text-[#818681]">
                                  {order.id}
                                </p>
                              </td>

                              {/* CUSTOMER */}
                              <td className="px-5 py-4 align-top">
                                <p className="font-medium text-[#222222]">
                                  {order.customerName ||
                                    "—"}
                                </p>

                                <p className="mt-1 text-xs text-[#777C77]">
                                  {order.customerEmail ||
                                    "—"}
                                </p>

                                <p className="mt-1 text-xs text-[#777C77]">
                                  {order.customerPhone ||
                                    "—"}
                                </p>
                              </td>

                              {/* PRODUCTS */}
                              <td className="px-5 py-4 align-top">
                                <div className="space-y-3">
                                  {items
                                    .slice(
                                      0,
                                      2
                                    )
                                    .map(
                                      (
                                        item,
                                        index
                                      ) => {
                                        const productName =
                                          getProductName(
                                            item.name,
                                            item.image,
                                            item.productId ||
                                              item.id
                                          );

                                        const image =
                                          getProductImage(
                                            item.name,
                                            item.image,
                                            item.productId ||
                                              item.id
                                          );

                                        return (
                                          <div
                                            key={`${item.productId || item.id || productName}-${index}`}
                                            className="flex items-start gap-3"
                                          >
                                            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#F1EEE7]">
                                              {image ? (
                                                <img
                                                  src={
                                                    image
                                                  }
                                                  alt={
                                                    productName
                                                  }
                                                  onError={(
                                                    event
                                                  ) => {
                                                    event.currentTarget.style.display =
                                                      "none";
                                                  }}
                                                  className="block h-full w-full object-contain"
                                                />
                                              ) : (
                                                <Package className="h-5 w-5 text-[#8A8D89]" />
                                              )}
                                            </div>

                                            <div className="min-w-0 flex-1">
                                              <p className="break-words text-sm font-semibold leading-5 text-[#222222]">
                                                {
                                                  productName
                                                }
                                              </p>

                                              <p className="mt-1 text-xs text-[#777C77]">
                                                Qty:{" "}
                                                {item.quantity ||
                                                  1}
                                              </p>
                                            </div>
                                          </div>
                                        );
                                      }
                                    )}

                                  {items.length >
                                    2 && (
                                    <p className="text-xs font-medium text-[#52705F]">
                                      +
                                      {" "}
                                      {items.length -
                                        2}{" "}
                                      more product
                                      {items.length -
                                        2 ===
                                      1
                                        ? ""
                                        : "s"}
                                    </p>
                                  )}
                                </div>
                              </td>

                              {/* DATE */}
                              <td className="px-5 py-4 align-top">
                                <div className="flex items-center gap-2 text-sm text-[#555C56]">
                                  <CalendarDays className="h-4 w-4 text-[#8A8D89]" />

                                  {formatDate(
                                    order.createdAt
                                  )}
                                </div>
                              </td>

                              {/* AMOUNT */}
                              <td className="px-5 py-4 align-top">
                                <p className="font-semibold text-[#173F35]">
                                  {formatPrice(
                                    order.total
                                  )}
                                </p>
                              </td>

                              {/* PAYMENT */}
                              <td className="px-5 py-4 align-top">
                                <p className="text-sm font-medium text-[#222222]">
                                  {
                                    paymentMethod
                                  }
                                </p>

                                {paymentStatus && (
                                  <span
                                    className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getPaymentStatusClasses(
                                      paymentStatus
                                    )}`}
                                  >
                                    {
                                      paymentStatus
                                    }
                                  </span>
                                )}
                              </td>

                              {/* STATUS */}
                              <td className="px-5 py-4 align-top">
                                <div className="relative">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setOpenStatusId(
                                        openStatusId ===
                                          order.id
                                          ? null
                                          : order.id
                                      )
                                    }
                                    className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${getStatusClasses(
                                      order.status
                                    )}`}
                                  >
                                    {
                                      order.status
                                    }

                                    <ChevronDown className="h-3.5 w-3.5" />
                                  </button>

                                  {openStatusId ===
                                    order.id && (
                                    <div className="absolute left-0 top-9 z-30 w-40 overflow-hidden rounded-lg border border-[#D8D4CB] bg-white py-1 shadow-lg">
                                      {statusOptions
                                        .filter(
                                          (
                                            item
                                          ) =>
                                            item !==
                                            "All"
                                        )
                                        .map(
                                          (
                                            status
                                          ) => (
                                            <button
                                              key={
                                                status
                                              }
                                              type="button"
                                              onClick={() =>
                                                updateOrderStatus(
                                                  order.id,
                                                  status
                                                )
                                              }
                                              className={`block w-full px-3 py-2 text-left text-sm transition hover:bg-[#FCFAF6] ${
                                                order.status ===
                                                status
                                                  ? "font-semibold text-[#173F35]"
                                                  : "text-[#555C56]"
                                              }`}
                                            >
                                              {
                                                status
                                              }
                                            </button>
                                          )
                                        )}
                                    </div>
                                  )}
                                </div>

                                {updatingId ===
                                  order.id && (
                                  <div className="mt-2 flex items-center gap-1 text-xs text-[#68706A]">
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    Updating...
                                  </div>
                                )}
                              </td>

                              {/* ACTIONS */}
                              <td className="px-5 py-4 align-top">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setSelectedOrder(
                                        order
                                      )
                                    }
                                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#D8D4CB] bg-white text-[#52705F] transition hover:bg-[#EEEAE1]"
                                    title="View order"
                                  >
                                    <Eye className="h-4 w-4" />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      deleteOrder(
                                        order.id
                                      )
                                    }
                                    disabled={
                                      deletingId ===
                                      order.id
                                    }
                                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-100 bg-red-50 text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                                    title="Delete order"
                                  >
                                    {deletingId ===
                                    order.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Trash2 className="h-4 w-4" />
                                    )}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        }
                      )}
                    </tbody>
                  </table>
                </div>

                {/* FOOTER */}
                <div className="flex flex-col gap-3 border-t border-[#ECE7DE] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-[#777C77]">
                    Showing{" "}
                    <span className="font-semibold text-[#555C56]">
                      {
                        filteredOrders.length
                      }
                    </span>{" "}
                    of{" "}
                    <span className="font-semibold text-[#555C56]">
                      {
                        orders.length
                      }
                    </span>{" "}
                    orders
                  </p>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#D8D4CB] bg-[#FBF9F5] text-[#B0B3AE]"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>

                    <span className="inline-flex h-9 min-w-9 items-center justify-center rounded-lg bg-[#173F35] px-3 text-sm font-semibold text-white">
                      1
                    </span>

                    <button
                      type="button"
                      disabled
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#D8D4CB] bg-[#FBF9F5] text-[#B0B3AE]"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ORDER DETAILS MODAL */}
        {selectedOrder && (
          <div
            className="fixed inset-0 z-[100] overflow-y-auto bg-black/40 p-3 sm:p-5"
            onClick={() =>
              setSelectedOrder(null)
            }
          >
            <div className="flex min-h-full items-center justify-center">
              <div
                className="my-2 flex max-h-[calc(100vh-1rem)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:my-4 sm:max-h-[calc(100vh-2rem)]"
                onClick={(event) =>
                  event.stopPropagation()
                }
              >
                {/* MODAL HEADER */}
                <div className="flex shrink-0 items-start justify-between border-b border-[#ECE7DE] bg-white px-5 py-4 sm:px-6 sm:py-5">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-[#818681]">
                      Order Details
                    </p>

                    <h2 className="mt-1 text-xl font-bold text-[#173F35]">
                      #
                      {selectedOrder.orderId ||
                        selectedOrder.id
                          .slice(
                            0,
                            8
                          )
                          .toUpperCase()}
                    </h2>

                    <p className="mt-1 text-xs text-[#777C77]">
                      {formatDateTime(
                        selectedOrder.createdAt
                      )}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setSelectedOrder(
                        null
                      )
                    }
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#777C77] transition hover:bg-[#F1EEE7] hover:text-[#173F35]"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* MODAL SCROLL AREA */}
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6 sm:py-6">

                  {/* TOP INFORMATION */}
                  <div className="grid gap-5 lg:grid-cols-3">

                    {/* CUSTOMER */}
                    <div className="rounded-xl border border-[#D8D4CB] bg-[#FBF9F5] p-5">
                      <div className="mb-4 flex items-center gap-2">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#E8F2EC] text-[#355E4B]">
                          <User className="h-4 w-4" />
                        </div>

                        <h3 className="font-semibold text-[#173F35]">
                          Customer
                        </h3>
                      </div>

                      <div className="space-y-3 text-sm">
                        <div>
                          <p className="text-xs text-[#818681]">
                            Name
                          </p>

                          <p className="mt-1 font-medium text-[#222222]">
                            {selectedOrder.customerName ||
                              "—"}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-[#818681]">
                            Email
                          </p>

                          <p className="mt-1 break-all text-[#555C56]">
                            {selectedOrder.customerEmail ||
                              "—"}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-[#818681]">
                            Phone
                          </p>

                          <p className="mt-1 text-[#555C56]">
                            {selectedOrder.customerPhone ||
                              "—"}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-[#818681]">
                            Delivery Address
                          </p>

                          <p className="mt-1 text-[#555C56]">
                            {selectedOrder.deliveryAddress ||
                              "—"}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-[#818681]">
                            City
                          </p>

                          <p className="mt-1 text-[#555C56]">
                            {selectedOrder.city ||
                              "—"}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* PAYMENT */}
                    <div className="rounded-xl border border-[#D8D4CB] bg-[#FBF9F5] p-5">
                      <div className="mb-4 flex items-center gap-2">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#E8F2EC] text-[#355E4B]">
                          <CreditCard className="h-4 w-4" />
                        </div>

                        <h3 className="font-semibold text-[#173F35]">
                          Payment
                        </h3>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <p className="text-xs text-[#818681]">
                            Payment Method
                          </p>

                          <p className="mt-1 font-medium text-[#222222]">
                            {getPaymentMethod(
                              selectedOrder
                            )}
                          </p>
                        </div>

                        {getPaymentStatus(
                          selectedOrder
                        ) && (
                          <div>
                            <p className="text-xs text-[#818681]">
                              Payment Status
                            </p>

                            <span
                              className={`mt-1 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getPaymentStatusClasses(
                                getPaymentStatus(
                                  selectedOrder
                                )
                              )}`}
                            >
                              {getPaymentStatus(
                                selectedOrder
                              )}
                            </span>
                          </div>
                        )}

                        {getPaymentMethod(
                          selectedOrder
                        ) ===
                          "Online Payment" && (
                          <>
                            <div>
                              <p className="text-xs text-[#818681]">
                                Payer Name
                              </p>

                              <p className="mt-1 font-medium text-[#222222]">
                                {getPayerName(
                                  selectedOrder
                                )}
                              </p>
                            </div>

                            <div>
                              <p className="text-xs text-[#818681]">
                                Payment Account / Mobile
                              </p>

                              <p className="mt-1 font-medium text-[#222222]">
                                {maskPaymentNumber(
                                  getPaymentNumber(
                                    selectedOrder
                                  )
                                )}
                              </p>
                            </div>

                            <div>
                              <p className="text-xs text-[#818681]">
                                Payment Amount
                              </p>

                              <p className="mt-1 font-semibold text-[#173F35]">
                                {formatPrice(
                                  selectedOrder
                                    .payment
                                    ?.amount ||
                                    selectedOrder.total
                                )}
                              </p>
                            </div>

                            <div>
                              <p className="text-xs text-[#818681]">
                                Transaction / Reference ID
                              </p>

                              <p className="mt-1 break-all font-medium text-[#222222]">
                                {getPaymentReference(
                                  selectedOrder
                                )}
                              </p>
                            </div>
                          </>
                        )}

                        <div>
                          <p className="text-xs text-[#818681]">
                            Order Total
                          </p>

                          <p className="mt-1 text-xl font-bold text-[#173F35]">
                            {formatPrice(
                              selectedOrder.total
                            )}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* STATUS */}
                    <div className="rounded-xl border border-[#D8D4CB] bg-[#FBF9F5] p-5">
                      <div className="mb-4 flex items-center gap-2">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#E8F2EC] text-[#355E4B]">
                          <Package className="h-4 w-4" />
                        </div>

                        <h3 className="font-semibold text-[#173F35]">
                          Order Status
                        </h3>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <p className="text-xs text-[#818681]">
                            Current Status
                          </p>

                          <span
                            className={`mt-1 inline-flex rounded-full px-3 py-1.5 text-xs font-semibold ${getStatusClasses(
                              selectedOrder.status
                            )}`}
                          >
                            {
                              selectedOrder.status
                            }
                          </span>
                        </div>

                        <div>
                          <p className="mb-2 text-xs text-[#818681]">
                            Change Status
                          </p>

                          <div className="grid grid-cols-2 gap-2">
                            {statusOptions
                              .filter(
                                (item) =>
                                  item !==
                                  "All"
                              )
                              .map(
                                (
                                  status
                                ) => (
                                  <button
                                    key={
                                      status
                                    }
                                    type="button"
                                    onClick={() =>
                                      updateOrderStatus(
                                        selectedOrder.id,
                                        status
                                      )
                                    }
                                    disabled={
                                      updatingId ===
                                      selectedOrder.id
                                    }
                                    className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
                                      selectedOrder.status ===
                                      status
                                        ? "border-[#173F35] bg-[#173F35] text-white"
                                        : "border-[#D8D4CB] bg-white text-[#555C56] hover:bg-[#EEEAE1]"
                                    }`}
                                  >
                                    {
                                      status
                                    }
                                  </button>
                                )
                              )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* PRODUCTS */}
                  <div className="mt-5 rounded-xl border border-[#D8D4CB] bg-white">
                    <div className="border-b border-[#ECE7DE] px-5 py-4">
                      <h3 className="font-semibold text-[#173F35]">
                        Ordered Products
                      </h3>
                    </div>

                    <div className="divide-y divide-[#ECE7DE]">
                      {getOrderItems(
                        selectedOrder
                      ).map(
                        (
                          item,
                          index
                        ) => {
                          const productName =
                            getProductName(
                              item.name,
                              item.image,
                              item.productId ||
                                item.id
                            );

                          const image =
                            getProductImage(
                              item.name,
                              item.image,
                              item.productId ||
                                item.id
                            );

                          const itemTotal =
                            Number(
                              item.price ||
                                0
                            ) *
                            Number(
                              item.quantity ||
                                0
                            );

                          return (
                            <div
                              key={`${item.productId || item.id || productName}-${index}`}
                              className="flex items-center gap-4 px-5 py-4"
                            >
                              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#F1EEE7]">
                                {image ? (
                                  <img
                                    src={
                                      image
                                    }
                                    alt={
                                      productName
                                    }
                                    onError={(
                                      event
                                    ) => {
                                      event.currentTarget.style.display =
                                        "none";
                                    }}
                                    className="block h-full w-full object-contain"
                                  />
                                ) : (
                                  <ShoppingBag className="h-6 w-6 text-[#8A8D89]" />
                                )}
                              </div>

                              <div className="min-w-0 flex-1">
                                <p className="break-words font-semibold text-[#222222]">
                                  {
                                    productName
                                  }
                                </p>

                                <p className="mt-1 text-sm text-[#777C77]">
                                  {formatPrice(
                                    item.price
                                  )}{" "}
                                  ×{" "}
                                  {
                                    item.quantity
                                  }
                                </p>
                              </div>

                              <p className="shrink-0 font-semibold text-[#173F35]">
                                {formatPrice(
                                  itemTotal
                                )}
                              </p>
                            </div>
                          );
                        }
                      )}
                    </div>

                    {/* TOTAL */}
                    <div className="flex items-center justify-between border-t border-[#ECE7DE] bg-[#FBF9F5] px-5 py-4">
                      <span className="font-semibold text-[#555C56]">
                        Total
                      </span>

                      <span className="text-xl font-bold text-[#173F35]">
                        {formatPrice(
                          selectedOrder.total
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="h-3" />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}