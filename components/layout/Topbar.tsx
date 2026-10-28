"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Menu,
  Bell,
  LogOut,
  User,
  ShoppingCart,
  CreditCard,
  PackageCheck,
  Trash2,
} from "lucide-react";
import { onAuthStateChanged, signOut, User as FirebaseUser } from "firebase/auth";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  limit,
  Timestamp,
} from "firebase/firestore";

import { auth, db } from "../../lib/firebase";

interface TopbarProps {
  onMenuClick: () => void;
}

interface NotificationItem {
  id: string;
  type: "order" | "payment" | "status";
  title: string;
  message: string;
  orderId?: string;
  createdAt: number;
}

type OrderRecord = Record<string, any>;

const MAX_NOTIFICATIONS = 100;

const getNotificationsKey = (uid: string) =>
  `dashboard_notifications_${uid}`;

const getDismissedKey = (uid: string) =>
  `dashboard_dismissed_notifications_${uid}`;

function readStoredNotifications(uid: string): NotificationItem[] {
  try {
    const stored = localStorage.getItem(getNotificationsKey(uid));
    if (!stored) return [];

    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (item): item is NotificationItem =>
        item !== null &&
        typeof item === "object" &&
        typeof item.id === "string" &&
        typeof item.title === "string" &&
        typeof item.message === "string" &&
        typeof item.createdAt === "number"
    );
  } catch (error) {
    console.error("Unable to read saved notifications:", error);
    return [];
  }
}

function readDismissedIds(uid: string): Set<string> {
  try {
    const stored = localStorage.getItem(getDismissedKey(uid));
    if (!stored) return new Set();

    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return new Set();

    return new Set(
      parsed.filter((id): id is string => typeof id === "string")
    );
  } catch (error) {
    console.error("Unable to read dismissed notifications:", error);
    return new Set();
  }
}

function saveDismissedIds(uid: string, ids: Set<string>) {
  try {
    localStorage.setItem(
      getDismissedKey(uid),
      JSON.stringify(Array.from(ids))
    );
  } catch (error) {
    console.error("Unable to save dismissed notifications:", error);
  }
}

function saveNotifications(uid: string, items: NotificationItem[]) {
  try {
    localStorage.setItem(
      getNotificationsKey(uid),
      JSON.stringify(items.slice(0, MAX_NOTIFICATIONS))
    );
  } catch (error) {
    console.error("Unable to save notifications:", error);
  }
}

function normalizeStatus(value: unknown): string {
  const status = String(value ?? "").trim().toLowerCase();

  if (status === "pending") return "Pending";
  if (status === "processing") return "Processing";
  if (status === "completed" || status === "complete") return "Completed";
  if (status === "cancelled" || status === "canceled") return "Cancelled";

  return status
    ? status.charAt(0).toUpperCase() + status.slice(1)
    : "Processing";
}

function normalizePaymentMethod(value: unknown): string {
  const method = String(value ?? "").trim().toLowerCase();

  if (
    method === "online" ||
    method === "online payment" ||
    method === "onlinepayment" ||
    method === "card"
  ) {
    return "Online Payment";
  }

  return "COD";
}

function isPaid(order: OrderRecord): boolean {
  const paymentStatus = String(
    order?.paymentStatus ?? order?.payment?.status ?? ""
  )
    .trim()
    .toLowerCase();

  const paymentMethod = normalizePaymentMethod(
    order?.paymentMethod ?? order?.payment?.method
  );

  const status = normalizeStatus(order?.status);

  if (paymentStatus === "paid") return true;
  if (paymentMethod === "Online Payment") return status !== "Cancelled";

  return status === "Completed";
}

function getTimestamp(value: any): number | null {
  if (!value) return null;

  if (value instanceof Timestamp) {
    return value.toMillis();
  }

  if (typeof value?.toMillis === "function") {
    return value.toMillis();
  }

  if (typeof value === "object" && typeof value.seconds === "number") {
    return value.seconds * 1000;
  }

  if (typeof value === "number") {
    return value < 1_000_000_000_000 ? value * 1000 : value;
  }

  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

function formatCurrency(amount: unknown): string {
  const number = Number(amount ?? 0);

  return `Rs. ${number.toLocaleString("en-PK", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function getCustomerName(order: OrderRecord): string {
  return String(
    order?.customerName ??
      order?.name ??
      order?.customer?.name ??
      order?.userName ??
      "Customer"
  );
}

function getOrderAmount(order: OrderRecord): number {
  return Number(order?.total ?? order?.totalAmount ?? order?.amount ?? 0);
}

function getOrderNumber(order: OrderRecord): string {
  return String(order?.orderNumber ?? order?.orderId ?? order?.id ?? "");
}

function formatRelativeTime(timestamp: number): string {
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));

  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;

  return new Date(timestamp).toLocaleDateString("en-PK", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function Topbar({ onMenuClick }: TopbarProps) {
  const [userName, setUserName] = useState("Admin");
  const [userEmail, setUserEmail] = useState("");
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [currentUserId, setCurrentUserId] = useState("");

  const audioContextRef = useRef<AudioContext | null>(null);
  const currentUserIdRef = useRef("");
  const dismissedIdsRef = useRef<Set<string>>(new Set());
  const previousOrdersRef = useRef<Record<string, OrderRecord>>({});
  const initialSnapshotLoadedRef = useRef(false);
  const processedEventsRef = useRef<Set<string>>(new Set());

  const playNotificationSound = useCallback(() => {
    try {
      const AudioContextClass =
        window.AudioContext ||
        (
          window as typeof window & {
            webkitAudioContext?: typeof AudioContext;
          }
        ).webkitAudioContext;

      if (!AudioContextClass) return;

      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContextClass();
      }

      const context = audioContextRef.current;

      if (context.state === "suspended") {
        void context.resume();
      }

      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(880, context.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(
        660,
        context.currentTime + 0.15
      );

      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.15,
        context.currentTime + 0.02
      );
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        context.currentTime + 0.3
      );

      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.3);
    } catch (error) {
      console.error("Notification sound error:", error);
    }
  }, []);

  /*
   * AUTH + USER-SPECIFIC NOTIFICATION RESTORE
   */
  useEffect(() => {
    let active = true;

    const unsubscribe = onAuthStateChanged(auth, (user: FirebaseUser | null) => {
      if (!active) return;

      if (!user) {
        currentUserIdRef.current = "";
        dismissedIdsRef.current = new Set();
        previousOrdersRef.current = {};
        initialSnapshotLoadedRef.current = false;
        processedEventsRef.current = new Set();

        setCurrentUserId("");
        setUserName("Admin");
        setUserEmail("");
        setNotifications([]);
        setShowNotifications(false);
        return;
      }

      const uid = user.uid;

      currentUserIdRef.current = uid;
      setCurrentUserId(uid);
      setUserName(user.displayName?.trim() || "Admin");
      setUserEmail(user.email || "");

      // Load dismissed IDs first, before loading visible notifications.
      const dismissed = readDismissedIds(uid);
      dismissedIdsRef.current = dismissed;

      const savedNotifications = readStoredNotifications(uid);
      const visibleNotifications = savedNotifications
        .filter((item) => !dismissed.has(item.id))
        .slice(0, MAX_NOTIFICATIONS);

      setNotifications(visibleNotifications);

      // Clean stale dismissed entries from the visible notification storage.
      saveNotifications(uid, visibleNotifications);

      // Every login begins with a fresh baseline of existing Firestore orders.
      previousOrdersRef.current = {};
      initialSnapshotLoadedRef.current = false;
      processedEventsRef.current = new Set();
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  /*
   * SAVE NOTIFICATIONS FOR THE CURRENT ADMIN
   */
  useEffect(() => {
    if (!currentUserId) return;

    const dismissed = dismissedIdsRef.current;
    const visible = notifications
      .filter((item) => !dismissed.has(item.id))
      .slice(0, MAX_NOTIFICATIONS);

    if (visible.length !== notifications.length) {
      setNotifications(visible);
      return;
    }

    saveNotifications(currentUserId, visible);
  }, [notifications, currentUserId]);

  /*
   * FIRESTORE REAL-TIME ORDER LISTENER
   *
   * First snapshot = baseline only.
   * Later added/modified events create notifications.
   */
  useEffect(() => {
    if (!currentUserId) return;

    let active = true;

    const ordersQuery = query(
      collection(db, "orders"),
      orderBy("createdAt", "desc"),
      limit(100)
    );

    const unsubscribe = onSnapshot(
      ordersQuery,
      (snapshot) => {
        if (!active || currentUserIdRef.current !== currentUserId) return;

        const currentOrders: Record<string, OrderRecord> = {};

        snapshot.docs.forEach((orderDoc) => {
          currentOrders[orderDoc.id] = {
            id: orderDoc.id,
            ...orderDoc.data(),
          };
        });

        // Do not generate notifications for orders already present on login.
        if (!initialSnapshotLoadedRef.current) {
          previousOrdersRef.current = currentOrders;
          initialSnapshotLoadedRef.current = true;
          return;
        }

        const generated: NotificationItem[] = [];
        const now = Date.now();

        snapshot.docChanges().forEach((change) => {
          const orderId = change.doc.id;
          const order: OrderRecord = {
            id: orderId,
            ...change.doc.data(),
          };

          if (change.type === "added") {
            // Ignore an order already known in the previous snapshot.
            if (previousOrdersRef.current[orderId]) return;

            const eventId = `order-${orderId}`;
            if (processedEventsRef.current.has(eventId)) return;

            processedEventsRef.current.add(eventId);

            generated.push({
              id: eventId,
              type: "order",
              title: "New Order Received",
              message: `${getCustomerName(order)} placed order #${getOrderNumber(
                order
              ).slice(-8)} for ${formatCurrency(getOrderAmount(order))}.`,
              orderId,
              createdAt: getTimestamp(order.createdAt) ?? now,
            });

            return;
          }

          if (change.type !== "modified") return;

          const oldOrder = previousOrdersRef.current[orderId];
          if (!oldOrder) return;

          const orderNumber = getOrderNumber(order).slice(-8);
          const oldStatus = normalizeStatus(oldOrder.status);
          const newStatus = normalizeStatus(order.status);

          // Status update: create an event only when the status really changes.
          if (oldStatus !== newStatus) {
            const eventId = `status-${orderId}-${oldStatus}-${newStatus}`;

            if (!processedEventsRef.current.has(eventId)) {
              processedEventsRef.current.add(eventId);

              generated.push({
                id: eventId,
                type: "status",
                title: "Order Status Updated",
                message: `Order #${orderNumber} changed from ${oldStatus} to ${newStatus}.`,
                orderId,
                createdAt: getTimestamp(order.updatedAt) ?? now,
              });
            }
          }

          // Payment event: notify only when payment changes from unpaid to paid.
          const wasPaid = isPaid(oldOrder);
          const nowPaid = isPaid(order);

          if (!wasPaid && nowPaid) {
            const eventId = `payment-${orderId}-paid`;

            if (!processedEventsRef.current.has(eventId)) {
              processedEventsRef.current.add(eventId);

              generated.push({
                id: eventId,
                type: "payment",
                title: "Payment Received",
                message: `${formatCurrency(
                  getOrderAmount(order)
                )} payment received for order #${orderNumber}.`,
                orderId,
                createdAt:
                  getTimestamp(
                    order.paidAt ??
                      order.paymentUpdatedAt ??
                      order.payment?.paidAt ??
                      order.updatedAt
                  ) ?? now,
              });
            }
          }
        });

        // Always update the baseline, even if notifications were dismissed.
        previousOrdersRef.current = currentOrders;

        const uid = currentUserIdRef.current;
        if (!uid || uid !== currentUserId) return;

        // Filter synchronously against the dismissed list.
        const dismissed = dismissedIdsRef.current;
        const allowed = generated.filter(
          (item) => !dismissed.has(item.id)
        );

        if (allowed.length === 0) return;

        setNotifications((previous) => {
          const latestDismissed = dismissedIdsRef.current;

          const existingIds = new Set(previous.map((item) => item.id));
          const additions = allowed.filter(
            (item) =>
              !latestDismissed.has(item.id) && !existingIds.has(item.id)
          );

          if (additions.length === 0) return previous;

          return [...additions.reverse(), ...previous].slice(
            0,
            MAX_NOTIFICATIONS
          );
        });

        playNotificationSound();
      },
      (error) => {
        console.error("Notification listener error:", error);
      }
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [currentUserId, playNotificationSound]);

  /*
   * CLEAR ALL
   *
   * Persist every currently visible notification ID as dismissed.
   * This is the important part that prevents old notifications
   * from reappearing after refresh, route changes, or login.
   */
  const clearNotifications = useCallback(() => {
    const uid = currentUserIdRef.current;
    if (!uid) {
      setNotifications([]);
      setShowNotifications(false);
      return;
    }

    const dismissed = new Set(dismissedIdsRef.current);

    notifications.forEach((item) => {
      dismissed.add(item.id);
    });

    // Update the ref synchronously before another listener callback can run.
    dismissedIdsRef.current = dismissed;

    saveDismissedIds(uid, dismissed);
    saveNotifications(uid, []);

    setNotifications([]);
    setShowNotifications(false);
  }, [notifications]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      window.location.href = "/login";
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const unreadCount = notifications.length;

  return (
    <header className="sticky top-0 z-30 flex h-20 items-center border-b border-[#DED7CB] bg-[#FBF9F5]/95 px-4 backdrop-blur md:px-6">
      <div className="flex w-full items-center gap-4">
        <button
          type="button"
          onClick={onMenuClick}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#DDD7CC] text-[#355E4B] hover:bg-[#E7EFEA] lg:hidden"
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>

        <div className="ml-auto flex items-center gap-3">
          {/* NOTIFICATION BELL */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowNotifications((previous) => !previous)}
              className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-[#DDD7CC] bg-white text-[#555B56] transition hover:bg-[#E7EFEA] hover:text-[#355E4B]"
              aria-label="Notifications"
              aria-expanded={showNotifications}
            >
              <Bell size={18} />

              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#B84B42] px-1 text-[10px] font-bold text-white">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 top-12 z-50 w-[min(360px,calc(100vw-24px))] overflow-hidden rounded-2xl border border-[#DDD7CC] bg-white shadow-xl">
                <div className="flex items-center justify-between border-b border-[#EEE9E1] px-4 py-3">
                  <div>
                    <h3 className="text-sm font-bold text-[#222222]">
                      Notifications
                    </h3>
                    <p className="text-[11px] text-[#858A85]">
                      {unreadCount > 0
                        ? `${unreadCount} notification${
                            unreadCount === 1 ? "" : "s"
                          }`
                        : "No new notifications"}
                    </p>
                  </div>

                  {notifications.length > 0 && (
                    <button
                      type="button"
                      onClick={clearNotifications}
                      className="flex items-center gap-1 text-xs font-semibold text-[#B84B42] hover:underline"
                    >
                      <Trash2 size={13} />
                      Clear all
                    </button>
                  )}
                </div>

                <div className="max-h-[380px] overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center px-5 py-10 text-center">
                      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#E7EFEA] text-[#355E4B]">
                        <Bell size={22} />
                      </div>
                      <p className="text-sm font-semibold text-[#333333]">
                        No notifications
                      </p>
                      <p className="mt-1 text-xs text-[#858A85]">
                        New orders and future updates will appear here.
                      </p>
                    </div>
                  ) : (
                    notifications.map((notification) => (
                      <div
                        key={notification.id}
                        className="flex gap-3 border-b border-[#F0ECE6] px-4 py-3 hover:bg-[#FBF9F5]"
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#E7EFEA] text-[#355E4B]">
                          {notification.type === "order" ? (
                            <ShoppingCart size={17} />
                          ) : notification.type === "payment" ? (
                            <CreditCard size={17} />
                          ) : (
                            <PackageCheck size={17} />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-[#222222]">
                            {notification.title}
                          </p>
                          <p className="mt-1 text-xs leading-5 text-[#666B67]">
                            {notification.message}
                          </p>
                          <p className="mt-1 text-[10px] text-[#999999]">
                            {formatRelativeTime(notification.createdAt)}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ADMIN PROFILE */}
          <div className="hidden items-center gap-3 border-l border-[#DDD7CC] pl-4 sm:flex">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E7EFEA] text-[#355E4B]">
              <User size={17} />
            </div>

            <div className="hidden min-w-0 md:block">
              <p className="max-w-[150px] truncate text-sm font-semibold text-[#111111]">
                {userName}
              </p>
              <p className="max-w-[180px] truncate text-[11px] text-[#858A85]">
                {userEmail}
              </p>
            </div>
          </div>

          {/* LOGOUT */}
          <button
            type="button"
            onClick={handleLogout}
            className="flex h-10 items-center gap-2 rounded-xl border border-[#DDD7CC] bg-white px-3 text-sm font-semibold text-[#555B56] transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
          >
            <LogOut size={17} />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
}