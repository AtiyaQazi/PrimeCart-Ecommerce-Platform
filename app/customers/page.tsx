"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
} from "firebase/firestore";
import {
  Mail,
  MoreHorizontal,
  Search,
  Trash2,
  Phone,
  ShoppingBag,
} from "lucide-react";

import DashboardLayout from "../../components/layout/DashboardLayout";
import { db } from "../../lib/firestore";

interface Customer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  createdAt?: Timestamp | null;
}

interface PaymentDetails {
  method?: string;
  status?: string;
  payerName?: string;
  paymentNumber?: string;
  accountNumber?: string;
  accountName?: string;
  amount?: number;
  reference?: string;
}

interface Order {
  id: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  total?: number;
  status: string;

  paymentMethod?: string;
  paymentStatus?: string;
  payment?: PaymentDetails;

  createdAt?: Timestamp | null;
}

interface CustomerSummary extends Customer {
  totalOrders: number;
  totalSpent: number;
  lastOrderDate: Timestamp | null;

  latestOrderStatus: string;
  latestPaymentMethod: string;
  latestPaymentStatus: string;
  latestPaymentAmount: number;

  status: "Active" | "Inactive";
}

/*
 * Normalize order status
 */
function getNormalizedOrderStatus(order: Order) {
  return String(order.status ?? "")
    .trim()
    .toLowerCase();
}

/*
 * Normalize payment method
 */
function getNormalizedPaymentMethod(order: Order) {
  return String(
    order.paymentMethod ||
      order.payment?.method ||
      ""
  )
    .trim()
    .toLowerCase()
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ");
}

/*
 * Check whether an order is a SALE.
 *
 * ONLINE:
 * Processing  -> Sale
 * Completed   -> Sale
 * Cancelled   -> NOT Sale
 *
 * COD:
 * Processing  -> NOT Sale
 * Completed   -> Sale
 * Cancelled   -> NOT Sale
 */
function isSaleOrder(order: Order) {
  const orderStatus = getNormalizedOrderStatus(order);
  const paymentMethod =
    getNormalizedPaymentMethod(order);

  const isCancelled =
    orderStatus === "cancelled" ||
    orderStatus === "canceled";

  // Cancelled orders are never counted as sales
  if (isCancelled) {
    return false;
  }

  /*
   * ONLINE PAYMENT
   */
  const isOnlinePayment =
    paymentMethod === "online" ||
    paymentMethod === "online payment" ||
    paymentMethod === "onlinepayment" ||
    paymentMethod === "stripe" ||
    paymentMethod === "card" ||
    paymentMethod === "credit card" ||
    paymentMethod === "debit card";

  if (isOnlinePayment) {
    return (
      orderStatus === "processing" ||
      orderStatus === "completed"
    );
  }

  /*
   * COD
   */
  const isCOD =
    paymentMethod === "cod" ||
    paymentMethod === "cash on delivery";

  if (isCOD) {
    return orderStatus === "completed";
  }

  return false;
}

/*
 * Get valid order amount
 */
function getOrderAmount(order: Order) {
  const amount = Number(order.total || 0);

  if (!Number.isFinite(amount)) {
    return 0;
  }

  return Math.max(0, amount);
}

/*
 * PAYMENT DISPLAY LOGIC
 *
 * ONLINE:
 * Processing -> Paid + amount
 * Completed  -> Paid + amount
 * Cancelled  -> Refund + amount
 *
 * COD:
 * Processing -> Pending + 0
 * Completed  -> Paid + amount
 * Cancelled  -> blank + 0
 */
function getPaymentDisplay(order: Order) {
  const orderStatus = getNormalizedOrderStatus(order);
  const paymentMethod =
    getNormalizedPaymentMethod(order);

  const amount = getOrderAmount(order);

  const isCancelled =
    orderStatus === "cancelled" ||
    orderStatus === "canceled";

  const isOnlinePayment =
    paymentMethod === "online" ||
    paymentMethod === "online payment" ||
    paymentMethod === "onlinepayment" ||
    paymentMethod === "stripe" ||
    paymentMethod === "card" ||
    paymentMethod === "credit card" ||
    paymentMethod === "debit card";

  const isCOD =
    paymentMethod === "cod" ||
    paymentMethod === "cash on delivery";

  /*
   * ONLINE PAYMENT
   */
  if (isOnlinePayment) {
    if (isCancelled) {
      return {
        label: "Refund",
        amount,
        method: "Online Payment",
      };
    }

    if (
      orderStatus === "processing" ||
      orderStatus === "completed"
    ) {
      return {
        label: "Paid",
        amount,
        method: "Online Payment",
      };
    }

    return {
      label: "Pending",
      amount: 0,
      method: "Online Payment",
    };
  }

  /*
   * COD
   */
  if (isCOD) {
    if (isCancelled) {
      return {
        label: "",
        amount: 0,
        method: "COD",
      };
    }

    if (orderStatus === "completed") {
      return {
        label: "Paid",
        amount,
        method: "COD",
      };
    }

    if (orderStatus === "processing") {
      return {
        label: "Pending",
        amount: 0,
        method: "COD",
      };
    }

    return {
      label: "Pending",
      amount: 0,
      method: "COD",
    };
  }

  /*
   * Unknown payment method
   */
  return {
    label: "",
    amount: 0,
    method: paymentMethod || "—",
  };
}

/*
 * Format date
 */
function formatDate(date?: Timestamp | null) {
  if (!date) {
    return "—";
  }

  return date.toDate().toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

/*
 * Format price
 */
function formatPrice(amount: number) {
  return `Rs. ${Math.round(
    amount || 0
  ).toLocaleString("en-PK")}`;
}

/*
 * Customer Active/Inactive badge
 */
function StatusBadge({
  status,
}: {
  status: "Active" | "Inactive";
}) {
  const styles = {
    Active: "bg-[#E4F1E9] text-[#276749]",
    Inactive: "bg-[#F1EEE7] text-[#6B706C]",
  };

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${styles[status]}`}
    >
      {status}
    </span>
  );
}

/*
 * Payment badge
 */
function PaymentBadge({
  status,
}: {
  status: string;
}) {
  if (!status) {
    return null;
  }

  const normalized = status.toLowerCase();

  let styles =
    "bg-[#F1EEE7] text-[#6B706C]";

  if (normalized === "paid") {
    styles =
      "bg-[#E4F1E9] text-[#276749]";
  }

  if (normalized === "pending") {
    styles =
      "bg-[#FFF4D6] text-[#9A6A00]";
  }

  if (normalized === "refund") {
    styles =
      "bg-[#FDE8E8] text-[#B42318]";
  }

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${styles}`}
    >
      {status}
    </span>
  );
}

export default function CustomersPage() {
  const [customers, setCustomers] =
    useState<Customer[]>([]);

  const [orders, setOrders] =
    useState<Order[]>([]);

  const [search, setSearch] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState("All");

  const [loading, setLoading] =
    useState(true);

  const [ordersLoading, setOrdersLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [selectedCustomer, setSelectedCustomer] =
    useState<CustomerSummary | null>(null);

  /*
   * Customers
   */
  useEffect(() => {
    const customersQuery = query(
      collection(db, "customers"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      customersQuery,
      (snapshot) => {
        const data: Customer[] =
          snapshot.docs.map((customerDoc) => {
            const customerData =
              customerDoc.data();

            return {
              id: customerDoc.id,
              name: customerData.name || "",
              email: customerData.email || "",
              phone: customerData.phone || "",
              createdAt:
                customerData.createdAt || null,
            };
          });

        setCustomers(data);
        setLoading(false);
        setError("");
      },
      (snapshotError) => {
        console.error(snapshotError);

        setError(
          "Unable to load customers. Please check your Firestore permissions."
        );

        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  /*
   * Orders
   */
  useEffect(() => {
    const ordersQuery = query(
      collection(db, "orders"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      ordersQuery,
      (snapshot) => {
     
     
   

const data: Order[] = snapshot.docs.map((document) => {
  const item = document.data();

  return {
    id: document.id,

    customerName:
      item.customerName || item.name || "Unknown Customer",

    customerEmail:
      item.customerEmail || item.email || "",

    // Product name will be resolved from products collection below.
    product: "",

    items: Array.isArray(item.items) ? item.items : [],

    total:
      typeof item.total === "number"
        ? item.total
        : Number(item.total) || 0,

    status: item.status || "Pending",

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
});

  
   
    
        setOrders(data);
        setOrdersLoading(false);
        setError("");
      },
      (snapshotError) => {
        console.error(snapshotError);

        setError(
          "Unable to load customer orders. Please check your Firestore permissions."
        );

        setOrdersLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  /*
   * Build customer summaries
   */
  const customerSummaries =
    useMemo<CustomerSummary[]>(() => {
      const ninetyDaysAgo =
        Date.now() -
        90 * 24 * 60 * 60 * 1000;

      return customers.map((customer) => {
        /*
         * Find all orders belonging to customer
         */
        const customerOrders =
          orders.filter((order) => {
            const sameEmail =
              order.customerEmail &&
              customer.email &&
              order.customerEmail
                .toLowerCase()
                .trim() ===
                customer.email
                  .toLowerCase()
                  .trim();

            const sameName =
              order.customerName &&
              customer.name &&
              order.customerName
                .toLowerCase()
                .trim() ===
                customer.name
                  .toLowerCase()
                  .trim();

            return sameEmail || sameName;
          });

        /*
         * Sort newest order first
         */
        const sortedOrders = [
          ...customerOrders,
        ].sort((a, b) => {
          const aTime =
            a.createdAt?.toMillis() || 0;

          const bTime =
            b.createdAt?.toMillis() || 0;

          return bTime - aTime;
        });

        /*
         * Latest order
         */
        const latestOrder =
          sortedOrders[0];

        const lastOrderDate =
          latestOrder?.createdAt || null;

        /*
         * SALES TOTAL
         *
         * Online:
         * Processing/Completed count
         *
         * COD:
         * Completed only
         *
         * Cancelled:
         * Never count
         */
        const totalSpent =
          customerOrders
            .filter(isSaleOrder)
            .reduce(
              (sum, order) =>
                sum + getOrderAmount(order),
              0
            );

        /*
         * Latest payment display
         */
        const latestPayment =
          latestOrder
            ? getPaymentDisplay(
                latestOrder
              )
            : {
                label: "",
                amount: 0,
                method: "—",
              };

        /*
         * Active customer:
         * order within last 90 days
         */
        const hasRecentOrder =
          lastOrderDate &&
          lastOrderDate.toMillis() >=
            ninetyDaysAgo;

        return {
          ...customer,

          totalOrders:
            customerOrders.length,

          totalSpent,

          lastOrderDate,

          latestOrderStatus:
            latestOrder?.status || "—",

          latestPaymentMethod:
            latestPayment.method,

          latestPaymentStatus:
            latestPayment.label,

          latestPaymentAmount:
            latestPayment.amount,

          status: hasRecentOrder
            ? "Active"
            : "Inactive",
        };
      });
    }, [customers, orders]);

  /*
   * Filter customers
   */
  const filteredCustomers =
    useMemo(() => {
      const value =
        search.trim().toLowerCase();

      return customerSummaries.filter(
        (customer) => {
          const matchesStatus =
            statusFilter === "All" ||
            customer.status ===
              statusFilter;

          if (!matchesStatus) {
            return false;
          }

          if (!value) {
            return true;
          }

          return (
            customer.name
              .toLowerCase()
              .includes(value) ||
            customer.email
              .toLowerCase()
              .includes(value) ||
            (customer.phone || "")
              .toLowerCase()
              .includes(value)
          );
        }
      );
    }, [
      customerSummaries,
      search,
      statusFilter,
    ]);

  /*
   * Stats
   */
  const activeCustomers =
    customerSummaries.filter(
      (customer) =>
        customer.status === "Active"
    ).length;

  const inactiveCustomers =
    customerSummaries.filter(
      (customer) =>
        customer.status === "Inactive"
    ).length;

  const totalOrders =
    customerSummaries.reduce(
      (sum, customer) =>
        sum + customer.totalOrders,
      0
    );

  /*
   * Total actual sales
   */
  const totalSpent =
    customerSummaries.reduce(
      (sum, customer) =>
        sum + customer.totalSpent,
      0
    );

  /*
   * Delete customer
   */
  const deleteCustomer = async (
    customerId: string
  ) => {
    const confirmed =
      window.confirm(
        "Are you sure you want to delete this customer?"
      );

    if (!confirmed) {
      return;
    }

    try {
      await deleteDoc(
        doc(db, "customers", customerId)
      );

      setSelectedCustomer(null);
    } catch (deleteError) {
      console.error(deleteError);

      setError(
        "Unable to delete customer."
      );
    }
  };

  return (
    <DashboardLayout>
      <main className="min-h-screen bg-[#F4EBDD] p-4 md:p-6">
        <div className="mx-auto max-w-7xl space-y-6">

          {/* Header */}
        <div className="mb-7 flex flex-col justify-between gap-4 lg:flex-row lg:items-center"></div>
           <div>
              <h1 className="text-3xl font-bold tracking-tight text-[#111111]">
             Customers
              </h1>
              <p className="mt-2 text-sm text-[#6B706C]">
              View and manage your customers.
              </p>
            </div>

          {/* Stats */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

            <Stat
              title="Total Customers"
              value={String(
                customers.length
              )}
            />

            <Stat
              title="Active Customers"
              value={String(
                activeCustomers
              )}
            />

            <Stat
              title="Inactive Customers"
              value={String(
                inactiveCustomers
              )}
            />

            <Stat
              title="Total Orders"
              value={String(totalOrders)}
            />

          </div>

          {/* Revenue Summary */}
          <div className="rounded-2xl border border-[#DED7CB] bg-[#FBF9F5] p-5 shadow-sm">
            <div className="flex items-center justify-between">

              <div>
                <p className="text-sm text-[#777D78]">
                  Customer Sales
                </p>

                <p className="mt-2 text-2xl font-bold text-[#173F35]">
                  {formatPrice(totalSpent)}
                </p>

                <p className="mt-1 text-xs text-[#777D78]">
                  Online paid orders and completed COD orders
                </p>
              </div>

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#E8F2EC] text-[#355E4B]">
                <ShoppingBag size={21} />
              </div>

            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Customer Table */}
          <section className="overflow-hidden rounded-2xl border border-[#DED7CB] bg-[#FBF9F5] shadow-sm">

            {/* Table Header */}
            <div className="flex flex-col gap-4 border-b border-[#E3DDD3] p-5 md:flex-row md:items-center md:justify-between">

              <div>
                <h2 className="font-semibold text-[#111111]">
                  All Customers
                </h2>

                <p className="mt-1 text-xs text-[#777D78]">
                  {filteredCustomers.length} customer
                  {filteredCustomers.length !==
                  1
                    ? "s"
                    : ""}{" "}
                  found
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">

                {/* Search */}
                <div className="relative w-full sm:w-72">

                  <Search
                    size={17}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A908B]"
                  />

                  <input
                    value={search}
                    onChange={(event) =>
                      setSearch(
                        event.target.value
                      )
                    }
                    placeholder="Search customers..."
                    className="h-10 w-full rounded-xl border border-[#D8D4CB] bg-white pl-10 pr-4 text-sm text-[#222222] outline-none placeholder:text-[#8A908B] focus:border-[#355E4B]"
                  />

                </div>

                {/* Status */}
                <select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(
                      event.target.value
                    )
                  }
                  className="h-10 rounded-xl border border-[#D8D4CB] bg-white px-3 text-sm text-[#222222] outline-none focus:border-[#355E4B]"
                >
                  <option value="All">
                    All Statuses
                  </option>

                  <option value="Active">
                    Active
                  </option>

                  <option value="Inactive">
                    Inactive
                  </option>
                </select>

              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1250px]">

                <thead>
                  <tr className="border-b border-[#E3DDD3] bg-[#F7F4EE] text-left">

                    <th className="px-5 py-3 text-xs uppercase tracking-wide text-[#777D78]">
                      Customer
                    </th>

                    <th className="px-5 py-3 text-xs uppercase tracking-wide text-[#777D78]">
                      Contact
                    </th>

                    <th className="px-5 py-3 text-xs uppercase tracking-wide text-[#777D78]">
                      Orders
                    </th>

                    <th className="px-5 py-3 text-xs uppercase tracking-wide text-[#777D78]">
                      Total Spent
                    </th>

                    <th className="px-5 py-3 text-xs uppercase tracking-wide text-[#777D78]">
                      Latest Payment
                    </th>

                    <th className="px-5 py-3 text-xs uppercase tracking-wide text-[#777D78]">
                      Order Status
                    </th>

                    <th className="px-5 py-3 text-xs uppercase tracking-wide text-[#777D78]">
                      Last Order
                    </th>

                    <th className="px-5 py-3 text-xs uppercase tracking-wide text-[#777D78]">
                      Status
                    </th>

                    <th className="px-5 py-3" />

                  </tr>
                </thead>

                <tbody>

                  {loading ||
                  ordersLoading ? (
                    <tr>
                      <td
                        colSpan={9}
                        className="px-5 py-12 text-center text-sm text-[#777D78]"
                      >
                        Loading customers...
                      </td>
                    </tr>
                  ) : filteredCustomers.length ===
                    0 ? (
                    <tr>
                      <td
                        colSpan={9}
                        className="px-5 py-12 text-center"
                      >
                        <p className="text-sm font-semibold text-[#333333]">
                          No customers found
                        </p>

                        <p className="mt-1 text-xs text-[#777D78]">
                          Try changing your search or
                          status filter.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredCustomers.map(
                      (customer) => (
                        <tr
                          key={customer.id}
                          className="border-b border-[#EEE9E0] last:border-0 hover:bg-[#FCFAF6]"
                        >

                          {/* Customer */}
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">

                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#E4F1E9] text-sm font-bold text-[#355E4B]">
                                {customer.name
                                  .charAt(0)
                                  .toUpperCase() ||
                                  "?"}
                              </div>

                              <div>
                                <p className="text-sm font-semibold text-[#222222]">
                                  {customer.name ||
                                    "Unknown Customer"}
                                </p>

                                <p className="mt-0.5 text-xs text-[#777D78]">
                                  Joined{" "}
                                  {formatDate(
                                    customer.createdAt
                                  )}
                                </p>
                              </div>

                            </div>
                          </td>

                          {/* Contact */}
                          <td className="px-5 py-4">
                            <div className="space-y-1">

                              <div className="flex items-center gap-2 text-sm text-[#555B56]">
                                <Mail size={14} />

                                {customer.email ||
                                  "—"}
                              </div>

                              {customer.phone && (
                                <div className="flex items-center gap-2 text-xs text-[#777D78]">
                                  <Phone
                                    size={13}
                                  />

                                  {customer.phone}
                                </div>
                              )}

                            </div>
                          </td>

                          {/* Orders */}
                          <td className="px-5 py-4">
                            <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#355E4B]">
                              <ShoppingBag
                                size={15}
                              />

                              {
                                customer.totalOrders
                              }
                            </span>
                          </td>

                          {/* Total Spent */}
                          <td className="px-5 py-4 text-sm font-semibold text-[#173F35]">
                            {formatPrice(
                              customer.totalSpent
                            )}
                          </td>

                          {/* Latest Payment */}
                          <td className="px-5 py-4">

                            <div className="space-y-1.5">

                              <p className="text-xs font-medium text-[#777D78]">
                                {
                                  customer.latestPaymentMethod
                                }
                              </p>

                              <div className="flex items-center gap-2">

                                {customer.latestPaymentStatus && (
                                  <PaymentBadge
                                    status={
                                      customer.latestPaymentStatus
                                    }
                                  />
                                )}

                                <span className="text-sm font-semibold text-[#173F35]">
                                  {formatPrice(
                                    customer.latestPaymentAmount
                                  )}
                                </span>

                              </div>

                            </div>

                          </td>

                          {/* Latest Order Status */}
                          <td className="px-5 py-4">

                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                                customer.latestOrderStatus
                                  .toLowerCase() ===
                                "completed"
                                  ? "bg-[#E4F1E9] text-[#276749]"
                                  : customer.latestOrderStatus
                                      .toLowerCase() ===
                                    "cancelled"
                                  ? "bg-[#FDE8E8] text-[#B42318]"
                                  : "bg-[#FFF4D6] text-[#9A6A00]"
                              }`}
                            >
                              {
                                customer.latestOrderStatus
                              }
                            </span>

                          </td>

                          {/* Last Order */}
                          <td className="px-5 py-4 text-sm text-[#777D78]">
                            {formatDate(
                              customer.lastOrderDate
                            )}
                          </td>

                          {/* Customer Status */}
                          <td className="px-5 py-4">
                            <StatusBadge
                              status={
                                customer.status
                              }
                            />
                          </td>

                          {/* Actions */}
                          <td className="relative px-5 py-4 text-right">

                            <button
                              type="button"
                              onClick={() =>
                                setSelectedCustomer(
                                  selectedCustomer?.id ===
                                    customer.id
                                    ? null
                                    : customer
                                )
                              }
                              className="rounded-lg p-2 text-[#777D78] hover:bg-[#E7EFEA]"
                            >
                              <MoreHorizontal
                                size={18}
                              />
                            </button>

                            {selectedCustomer?.id ===
                              customer.id && (
                              <div className="absolute right-5 top-12 z-20 w-60 rounded-xl border border-[#DED7CB] bg-white p-2 text-left shadow-lg">

                                <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[#777D78]">
                                  Customer Details
                                </p>

                                <div className="space-y-3 px-3 py-2">

                                  <div>
                                    <p className="text-xs text-[#777D78]">
                                      Customer
                                    </p>

                                    <p className="text-sm font-medium text-[#222222]">
                                      {customer.name ||
                                        "Unknown"}
                                    </p>
                                  </div>

                                  <div>
                                    <p className="text-xs text-[#777D78]">
                                      Orders
                                    </p>

                                    <p className="text-sm font-medium text-[#222222]">
                                      {
                                        customer.totalOrders
                                      }
                                    </p>
                                  </div>

                                  <div>
                                    <p className="text-xs text-[#777D78]">
                                      Sales
                                    </p>

                                    <p className="text-sm font-medium text-[#355E4B]">
                                      {formatPrice(
                                        customer.totalSpent
                                      )}
                                    </p>
                                  </div>

                                  <div>
                                    <p className="text-xs text-[#777D78]">
                                      Latest Payment
                                    </p>

                                    <div className="mt-1 flex items-center gap-2">
                                      {customer.latestPaymentStatus && (
                                        <PaymentBadge
                                          status={
                                            customer.latestPaymentStatus
                                          }
                                        />
                                      )}

                                      <span className="text-sm font-semibold text-[#173F35]">
                                        {formatPrice(
                                          customer.latestPaymentAmount
                                        )}
                                      </span>
                                    </div>
                                  </div>

                                  <div>
                                    <p className="text-xs text-[#777D78]">
                                      Latest Order
                                    </p>

                                    <p className="text-sm font-medium text-[#222222]">
                                      {
                                        customer.latestOrderStatus
                                      }
                                    </p>
                                  </div>

                                </div>

                                <div className="my-1 border-t border-[#EEE9E0]" />

                                <button
                                  type="button"
                                  onClick={() =>
                                    deleteCustomer(
                                      customer.id
                                    )
                                  }
                                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                                >
                                  <Trash2
                                    size={15}
                                  />

                                  Delete Customer
                                </button>

                              </div>
                            )}

                          </td>

                        </tr>
                      )
                    )
                  )}

                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>

      {/* Close menu */}
      {selectedCustomer && (
        <button
          type="button"
          aria-label="Close customer menu"
          onClick={() =>
            setSelectedCustomer(null)
          }
          className="fixed inset-0 z-10 cursor-default"
        />
      )}
    </DashboardLayout>
  );
}

/*
 * Stats Card
 */
function Stat({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-[#DED7CB] bg-[#FBF9F5] p-5 shadow-sm">

      <p className="text-sm text-[#777D78]">
        {title}
      </p>

      <p className="mt-2 text-2xl font-bold text-[#111111]">
        {value}
      </p>

    </div>
  );
}