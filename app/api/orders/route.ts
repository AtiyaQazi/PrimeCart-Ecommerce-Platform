
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

import { db } from "@/lib/firebase";

/* =========================================================
   GENERAL HELPERS
========================================================= */

function normalizeStatus(status: unknown): string {
  return String(status ?? "").trim().toLowerCase();
}

function normalizePaymentMethod(method: unknown): string {
  return String(method ?? "").trim().toLowerCase();
}

/* =========================================================
   PAKISTAN PHONE VALIDATION
========================================================= */

function normalizePakistanPhone(value: unknown): string {
  let phone = String(value ?? "").replace(/[\s()-]/g, "");

  if (phone.startsWith("+92")) {
    phone = "0" + phone.slice(3);
  } else if (phone.startsWith("0092")) {
    phone = "0" + phone.slice(4);
  } else if (phone.startsWith("92") && phone.length === 12) {
    phone = "0" + phone.slice(2);
  }

  return phone;
}

function isValidPakistanPhone(value: unknown): boolean {
  const phone = String(value ?? "").replace(/[\s()-]/g, "");

  return /^(?:(?:\+92|0092|92)?3\d{9}|03\d{9})$/.test(phone);
}

/* =========================================================
   PAKISTAN IBAN VALIDATION
========================================================= */

function normalizePakistaniIBAN(value: unknown): string {
  return String(value ?? "")
    .replace(/[\s-]/g, "")
    .toUpperCase();
}

function isValidPakistaniIBAN(value: unknown): boolean {
  const iban = normalizePakistaniIBAN(value);

  // Pakistan IBAN: PK + 2 checksum digits + 4 bank letters
  // + 16 account identifier characters = 24 characters.
  if (!/^PK\d{2}[A-Z]{4}[A-Z0-9]{16}$/.test(iban)) {
    return false;
  }

  // Move the first four characters to the end.
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;

  // Convert A-Z to 10-35 and calculate mod 97 safely.
  for (const character of rearranged) {
    const converted = /[A-Z]/.test(character)
      ? String(character.charCodeAt(0) - 55)
      : character;

    for (const digit of converted) {
      remainder = (remainder * 10 + Number(digit)) % 97;
    }
  }

  return remainder === 1;
}

/* =========================================================
   PAYMENT STATUS
========================================================= */

function getPaymentStatus(
  paymentMethod: string,
  orderStatus: string
): string {
  const method = normalizePaymentMethod(paymentMethod);
  const status = normalizeStatus(orderStatus);

  if (method === "online" || method === "online payment") {
    if (status === "cancelled") return "Refund";
    return "Paid";
  }

  if (method === "cod") {
    if (status === "completed") return "Paid";

    if (status === "processing" || status === "pending") {
      return "Pending";
    }

    if (status === "cancelled") return "";

    return "Pending";
  }

  return "Pending";
}

/* =========================================================
   SALES LOGIC
========================================================= */

function shouldBeInSales(
  paymentMethod: unknown,
  orderStatus: unknown
): boolean {
  const method = normalizePaymentMethod(paymentMethod);
  const status = normalizeStatus(orderStatus);

  if (method === "online" || method === "online payment") {
    return status === "processing" || status === "completed";
  }

  if (method === "cod") {
    return status === "completed";
  }

  return false;
}

/* =========================================================
   EMAIL VALIDATION
========================================================= */

function isValidEmail(value: unknown): boolean {
  const email = String(value ?? "").trim();

  return /^[^\s@]+@[^\s@]+\.com$/i.test(email);
}

/* =========================================================
   COLOR STOCK TYPES + HELPERS
========================================================= */

interface ColorStock {
  color: string;
  stock: number;
}

interface OrderItem {
  productId: string;
  name?: string;
  price?: number;
  quantity: number;
  color?: string;
  selectedColor?: string;
  selectedSize?: string;
  [key: string]: any;
}

function getItemColor(item: any): string {
  return String(
    item?.selectedColor ??
      item?.color ??
      item?.variantColor ??
      item?.variant?.color ??
      ""
  ).trim();
}

function normalizeColorStocks(value: unknown): ColorStock[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter(
      (entry: any) => entry && typeof entry === "object"
    )
    .map((entry: any) => ({
      color: String(entry.color ?? "").trim(),
      stock: Math.max(0, Math.floor(Number(entry.stock) || 0)),
    }))
    .filter((entry: ColorStock) => entry.color.length > 0);
}

/* =========================================================
   ORDER ITEM NORMALIZATION
========================================================= */

function normalizeOrderItems(items: unknown): OrderItem[] {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("At least one product is required.");
  }

  return items.map((item: any) => {
    const productId = String(
      item?.productId ?? item?.id ?? ""
    ).trim();

    const quantity = Number(item?.quantity ?? item?.qty ?? 0);
    const color = getItemColor(item);

    if (!productId) {
      throw new Error("Each order item must have a productId.");
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error("Product quantity must be a positive integer.");
    }

    return {
      ...item,
      productId,
      quantity,
      ...(color
        ? {
            color,
            selectedColor: color,
          }
        : {}),
    };
  });
}

/* =========================================================
   MERGE DUPLICATE ITEMS

   Same product + same color + same size = merge.
   Different colors remain separate.
========================================================= */

function mergeOrderItems(items: OrderItem[]): OrderItem[] {
  const map = new Map<string, OrderItem>();

  for (const item of items) {
    const color = getItemColor(item).toLowerCase();
    const size = String(item.selectedSize ?? "")
      .trim()
      .toLowerCase();

    const key = JSON.stringify([
      item.productId,
      color,
      size,
    ]);

    const existing = map.get(key);

    if (existing) {
      existing.quantity += item.quantity;
    } else {
      map.set(key, {
        ...item,
        ...(color
          ? {
              color: getItemColor(item),
              selectedColor: getItemColor(item),
            }
          : {}),
      });
    }
  }

  return Array.from(map.values());
}

/* =========================================================
   CALCULATE STOCK FOR ONE ITEM

   - Color products: update selected color only.
   - Single-color legacy products: initialize colorStocks.
   - Products without color variants: update regular stock.
   - Multi-color products without configured color-wise stock:
     reject instead of deducting the wrong color.
========================================================= */

function getStockUpdate(
  productData: Record<string, any>,
  item: OrderItem,
  delta: number
): {
  stock: number;
  colorStocks?: ColorStock[];
  resolvedColor?: string;
} {
  const productName =
    item.name || productData.name || "this product";

  const currentStock = Number(productData.stock ?? 0);

  if (!Number.isFinite(currentStock) || currentStock < 0) {
    throw new Error(`Invalid stock for ${productName}.`);
  }

  const savedColorStocks = normalizeColorStocks(
    productData.colorStocks
  );

  const productColors = Array.isArray(productData.colors)
    ? productData.colors
        .map((color: unknown) => String(color ?? "").trim())
        .filter(Boolean)
    : [];

  const requestedColor = getItemColor(item);

  /* CASE 1: Color-wise stock already exists. */

  if (savedColorStocks.length > 0) {
    let colorIndex = requestedColor
      ? savedColorStocks.findIndex(
          (entry) =>
            entry.color.toLowerCase() ===
            requestedColor.toLowerCase()
        )
      : -1;

    if (colorIndex === -1 && !requestedColor) {
      if (savedColorStocks.length === 1) {
        colorIndex = 0;
      } else {
        throw new Error(
          `Please select a color for ${productName}.`
        );
      }
    }

    if (colorIndex === -1) {
      throw new Error(
        `Color "${requestedColor}" is not configured for ${productName}. Please check the product's color stock.`
      );
    }

    const selected = savedColorStocks[colorIndex];
    const nextColorStock = selected.stock + delta;

    if (nextColorStock < 0) {
      throw new Error(
        `Insufficient stock for ${productName} (${selected.color}). Available: ${selected.stock}, Requested: ${Math.abs(delta)}.`
      );
    }

    const colorStocks = savedColorStocks.map(
      (entry, index) =>
        index === colorIndex
          ? { ...entry, stock: nextColorStock }
          : entry
    );

    const stock = colorStocks.reduce(
      (total, entry) => total + entry.stock,
      0
    );

    return {
      stock,
      colorStocks,
      resolvedColor: selected.color,
    };
  }

  /* CASE 2: Legacy product has exactly one color. */

  if (productColors.length === 1) {
    const onlyColor = productColors[0];

    if (
      requestedColor &&
      requestedColor.toLowerCase() !== onlyColor.toLowerCase()
    ) {
      throw new Error(
        `Color "${requestedColor}" is not available for ${productName}.`
      );
    }

    const nextStock = currentStock + delta;

    if (nextStock < 0) {
      throw new Error(
        `Insufficient stock for ${productName} (${onlyColor}). Available: ${currentStock}, Requested: ${Math.abs(delta)}.`
      );
    }

    return {
      stock: nextStock,
      colorStocks: [
        {
          color: onlyColor,
          stock: nextStock,
        },
      ],
      resolvedColor: onlyColor,
    };
  }

  /* CASE 3: Multiple colors without color-wise stock. */

  if (productColors.length > 1) {
    throw new Error(
      `Color-wise stock is not configured for ${productName}. Please save stock for each color in the admin product page first.`
    );
  }

  /* CASE 4: Product has no color variants. */

  const nextStock = currentStock + delta;

  if (nextStock < 0) {
    throw new Error(
      `Insufficient stock for ${productName}. Available: ${currentStock}, Requested: ${Math.abs(delta)}.`
    );
  }

  return { stock: nextStock };
}

/* =========================================================
   CREATE ORDER + DEDUCT STOCK
========================================================= */

async function createOrderAndDeductStock(orderData: any) {
  const normalizedItems = mergeOrderItems(
    normalizeOrderItems(orderData.items)
  );

  return await runTransaction(db, async (transaction) => {
    const productMap = new Map<
      string,
      {
        ref: ReturnType<typeof doc>;
        data: Record<string, any>;
      }
    >();

    /* STEP 1: Read each unique product exactly once. */

    for (const item of normalizedItems) {
      if (productMap.has(item.productId)) continue;

      const productRef = doc(db, "products", item.productId);
      const productSnapshot = await transaction.get(productRef);

      if (!productSnapshot.exists()) {
        throw new Error(`Product not found: ${item.productId}`);
      }

      productMap.set(item.productId, {
        ref: productRef,
        data: productSnapshot.data(),
      });
    }

    /* STEP 2: Calculate all changes in memory. */

    const updatedProducts = new Map<
      string,
      Record<string, any>
    >();

    const orderItemsWithResolvedColors: OrderItem[] = [];

    for (const item of normalizedItems) {
      const currentData =
        updatedProducts.get(item.productId) ??
        productMap.get(item.productId)!.data;

      const stockUpdate = getStockUpdate(
        currentData,
        item,
        -item.quantity
      );

      const nextData = {
        ...currentData,
        stock: stockUpdate.stock,
        ...(stockUpdate.colorStocks
          ? { colorStocks: stockUpdate.colorStocks }
          : {}),
      };

      updatedProducts.set(item.productId, nextData);

      const resolvedColor =
        stockUpdate.resolvedColor || getItemColor(item);

      orderItemsWithResolvedColors.push({
        ...item,
        ...(resolvedColor
          ? {
              color: resolvedColor,
              selectedColor: resolvedColor,
            }
          : {}),
      });
    }

    /* STEP 3: Write each product once. */

    for (const [productId, updatedData] of updatedProducts) {
      const product = productMap.get(productId)!;

      transaction.update(product.ref, {
        stock: updatedData.stock,
        ...(updatedData.colorStocks
          ? { colorStocks: updatedData.colorStocks }
          : {}),
      });
    }

    /* STEP 4: Create order in the same transaction. */

    const orderRef = doc(collection(db, "orders"));

    transaction.set(orderRef, {
      ...orderData,
      items: orderItemsWithResolvedColors,
      createdAt: orderData.createdAt ?? serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return orderRef.id;
  });
}

/* =========================================================
   UPDATE STOCK WHEN ORDER STATUS CHANGES

   Active -> Cancelled: restore stock.
   Cancelled -> Active: deduct stock again.
   Other changes: no stock adjustment.
========================================================= */

async function updateStockForStatusChange(
  oldStatus: string,
  newStatus: string,
  items: OrderItem[]
) {
  const oldNormalized = normalizeStatus(oldStatus);
  const newNormalized = normalizeStatus(newStatus);

  if (oldNormalized === newNormalized) return;

  const wasCancelled = oldNormalized === "cancelled";
  const isCancelled = newNormalized === "cancelled";

  if (wasCancelled === isCancelled) return;

  const normalizedItems = mergeOrderItems(
    normalizeOrderItems(items)
  );

  const deltaMultiplier = isCancelled ? 1 : -1;

  await runTransaction(db, async (transaction) => {
    const productMap = new Map<
      string,
      {
        ref: ReturnType<typeof doc>;
        data: Record<string, any>;
      }
    >();

    /* Read each unique product first. */

    for (const item of normalizedItems) {
      if (productMap.has(item.productId)) continue;

      const productRef = doc(db, "products", item.productId);
      const productSnapshot = await transaction.get(productRef);

      if (!productSnapshot.exists()) {
        throw new Error(`Product not found: ${item.productId}`);
      }

      productMap.set(item.productId, {
        ref: productRef,
        data: productSnapshot.data(),
      });
    }

    /* Calculate stock updates for every item. */

    const updatedProducts = new Map<
      string,
      Record<string, any>
    >();

    for (const item of normalizedItems) {
      const currentData =
        updatedProducts.get(item.productId) ??
        productMap.get(item.productId)!.data;

      const stockUpdate = getStockUpdate(
        currentData,
        item,
        deltaMultiplier * item.quantity
      );

      updatedProducts.set(item.productId, {
        ...currentData,
        stock: stockUpdate.stock,
        ...(stockUpdate.colorStocks
          ? { colorStocks: stockUpdate.colorStocks }
          : {}),
      });
    }

    /* Write each product once. */

    for (const [productId, updatedData] of updatedProducts) {
      const product = productMap.get(productId)!;

      transaction.update(product.ref, {
        stock: updatedData.stock,
        ...(updatedData.colorStocks
          ? { colorStocks: updatedData.colorStocks }
          : {}),
      });
    }
  });
}

/* =========================================================
   SYNC SALES
========================================================= */

async function syncSale(orderId: string, orderData: any) {
  const salesQuery = query(
    collection(db, "sales"),
    where("orderId", "==", orderId),
    limit(1)
  );

  const salesSnapshot = await getDocs(salesQuery);

  const shouldExist = shouldBeInSales(
    orderData.paymentMethod,
    orderData.status
  );

  if (shouldExist) {
    const saleData = {
      orderId,

      customerName:
        orderData.customerName || orderData.name || "",

      customerEmail:
        orderData.customerEmail || orderData.email || "",

      customerPhone:
        orderData.customerPhone || orderData.phone || "",

      amount: Number(
        orderData.total ??
          orderData.amount ??
          orderData.totalAmount ??
          0
      ),

      paymentMethod: orderData.paymentMethod || "",
      paymentStatus: orderData.paymentStatus || "",
      status: orderData.status || "",
      items: orderData.items || [],
      updatedAt: serverTimestamp(),
    };

    if (salesSnapshot.empty) {
      await addDoc(collection(db, "sales"), {
        ...saleData,
        createdAt: serverTimestamp(),
      });
    } else {
      await updateDoc(salesSnapshot.docs[0].ref, saleData);
    }
  } else {
    for (const sale of salesSnapshot.docs) {
      await deleteDoc(sale.ref);
    }
  }
}

/* =========================================================
   SYNC CUSTOMER
========================================================= */

async function syncCustomer(orderData: any) {
  const email = String(
    orderData.customerEmail || orderData.email || ""
  )
    .trim()
    .toLowerCase();

  if (!email) return;

  const customersQuery = query(
    collection(db, "customers"),
    where("email", "==", email),
    limit(1)
  );

  const customersSnapshot = await getDocs(customersQuery);

  const customerData = {
    name: orderData.customerName || orderData.name || "",
    email,

    phone: normalizePakistanPhone(
      orderData.customerPhone || orderData.phone || ""
    ),

    updatedAt: serverTimestamp(),
  };

  if (customersSnapshot.empty) {
    await addDoc(collection(db, "customers"), {
      ...customerData,
      totalOrders: 1,
      createdAt: serverTimestamp(),
    });
  } else {
    const customerDoc = customersSnapshot.docs[0];
    const oldData = customerDoc.data();

    await updateDoc(customerDoc.ref, {
      ...customerData,
      totalOrders: Number(oldData.totalOrders ?? 0) + 1,
    });
  }
}

/* =========================================================
   POST: CREATE NEW ORDER
========================================================= */

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const customerName = String(
      body.customerName ?? body.name ?? ""
    ).trim();

    const rawEmail = String(
      body.customerEmail ?? body.email ?? ""
    ).trim();

    const rawPhone = String(
      body.customerPhone ?? body.phone ?? ""
    ).trim();

    const paymentMethod = normalizePaymentMethod(
      body.paymentMethod
    );

    /* Required customer fields */

    if (!customerName) {
      return Response.json(
        { success: false, error: "Customer name is required." },
        { status: 400 }
      );
    }

    if (!rawEmail) {
      return Response.json(
        { success: false, error: "Customer email is required." },
        { status: 400 }
      );
    }

    if (!isValidEmail(rawEmail)) {
      return Response.json(
        {
          success: false,
          error: "Please enter a valid email ending with .com.",
        },
        { status: 400 }
      );
    }

    /* Delivery phone validation */

    if (!rawPhone) {
      return Response.json(
        {
          success: false,
          error: "Customer phone number is required.",
        },
        { status: 400 }
      );
    }

    if (!isValidPakistanPhone(rawPhone)) {
      return Response.json(
        {
          success: false,
          error:
            "Please enter a valid Pakistani mobile number: 03001234567 or +923001234567.",
        },
        { status: 400 }
      );
    }

    const normalizedPhone = normalizePakistanPhone(rawPhone);

    /* =====================================================
       PAYMENT TYPE + PAYMENT NUMBER VALIDATION
       IMPORTANT: Declarations exist only once in this POST.
    ===================================================== */

    const paymentType = String(
      body.paymentType ?? body.payment?.paymentType ?? ""
    ).trim();

    const isOnlinePayment =
      paymentMethod === "online" ||
      paymentMethod === "online payment";

    const rawPaymentNumber = String(
      body.paymentNumber ??
        body.transactionNumber ??
        body.accountNumber ??
        body.payment?.paymentNumber ??
        body.payment?.transactionNumber ??
        body.payment?.accountNumber ??
        ""
    ).trim();

    let normalizedPaymentNumber = "";

    if (isOnlinePayment) {
      if (!rawPaymentNumber) {
        return Response.json(
          {
            success: false,
            error:
              paymentType === "Bank Account Number"
                ? "Please enter your Pakistani bank IBAN."
                : "Please enter your mobile payment number.",
          },
          { status: 400 }
        );
      }

      if (paymentType === "Bank Account Number") {
        const iban = normalizePakistaniIBAN(rawPaymentNumber);

        if (!isValidPakistaniIBAN(iban)) {
          return Response.json(
            {
              success: false,
              error:
                "Please enter a valid 24-character Pakistani IBAN with a valid checksum.",
            },
            { status: 400 }
          );
        }

        normalizedPaymentNumber = iban;
      } else if (
        paymentType === "Mobile Number" ||
        !paymentType
      ) {
        if (!isValidPakistanPhone(rawPaymentNumber)) {
          return Response.json(
            {
              success: false,
              error:
                "Please enter a valid Pakistani mobile payment number: 03001234567 or +923001234567.",
            },
            { status: 400 }
          );
        }

        normalizedPaymentNumber =
          normalizePakistanPhone(rawPaymentNumber);
      } else {
        return Response.json(
          {
            success: false,
            error: "Please select a valid payment type.",
          },
          { status: 400 }
        );
      }
    }

    /* Normalize order items */

    const normalizedItems = mergeOrderItems(
      normalizeOrderItems(body.items)
    );

    /* Initial status */

    const initialStatus = "Processing";

    const initialPaymentStatus = getPaymentStatus(
      paymentMethod,
      initialStatus
    );

    /* Order total */

    const total = Number(
      body.total ?? body.amount ?? body.totalAmount ?? 0
    );

    if (!Number.isFinite(total) || total < 0) {
      return Response.json(
        { success: false, error: "Invalid order amount." },
        { status: 400 }
      );
    }

    /* Payment object */

    const existingPayment =
      body.payment && typeof body.payment === "object"
        ? body.payment
        : {};

    const paymentData = isOnlinePayment
      ? {
          ...existingPayment,
          method: "Online Payment",
          paymentType: paymentType || "Mobile Number",
          payerName: existingPayment.payerName || customerName,
          paymentNumber: normalizedPaymentNumber,
          amount: total,

          reference:
            existingPayment.reference ||
            existingPayment.transactionNumber ||
            existingPayment.paymentNumber ||
            "",

          transactionId:
            existingPayment.transactionId ||
            existingPayment.reference ||
            existingPayment.transactionNumber ||
            normalizedPaymentNumber,

          status: initialPaymentStatus,
        }
      : {
          ...existingPayment,
          method: "COD",
          amount: total,
          status: initialPaymentStatus,
        };

    /* Order data */

    const orderData = {
      ...body,

      customerName,
      customerEmail: rawEmail.toLowerCase(),
      customerPhone: normalizedPhone,

      name: customerName,
      email: rawEmail.toLowerCase(),
      phone: normalizedPhone,

      paymentMethod: paymentMethod === "cod" ? "COD" : "Online",

      paymentType: isOnlinePayment
        ? paymentType || "Mobile Number"
        : "COD",

      paymentNumber: normalizedPaymentNumber,
      payment: paymentData,
      paymentStatus: initialPaymentStatus,
      status: initialStatus,
      total,
      items: normalizedItems,

      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    /* Create order + deduct selected color stock */

    const orderId = await createOrderAndDeductStock(orderData);

    /* Sync sales */

    await syncSale(orderId, {
      ...orderData,
      id: orderId,
    });

    /* Sync customer */

    await syncCustomer(orderData);

    return Response.json(
      {
        success: true,
        orderId,
        message: "Order Confirmed!",
        paymentStatus: initialPaymentStatus,
        status: initialStatus,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Create order error:", error);

    return Response.json(
      {
        success: false,
        error: error?.message || "Failed to create order.",
      },
      { status: 500 }
    );
  }
}

/* =========================================================
   PATCH: UPDATE ORDER STATUS
========================================================= */

export async function PATCH(request: Request) {
  try {
    const body = await request.json();

    const orderId = String(
      body.orderId ?? body.id ?? ""
    ).trim();

    const newStatus = String(body.status ?? "").trim();

    if (!orderId) {
      return Response.json(
        { success: false, error: "Order ID is required." },
        { status: 400 }
      );
    }

    if (!newStatus) {
      return Response.json(
        { success: false, error: "Order status is required." },
        { status: 400 }
      );
    }

    const orderRef = doc(db, "orders", orderId);
    const orderSnapshot = await getDoc(orderRef);

    if (!orderSnapshot.exists()) {
      return Response.json(
        { success: false, error: "Order not found." },
        { status: 404 }
      );
    }

    const existingOrder = orderSnapshot.data();

    const oldStatus = String(existingOrder.status ?? "");

    const normalizedItems = mergeOrderItems(
      normalizeOrderItems(existingOrder.items)
    );

    /*
     * Active -> Cancelled: restore stock.
     * Cancelled -> Active: deduct stock again.
     * Processing <-> Completed: no stock change.
     */

    await updateStockForStatusChange(
      oldStatus,
      newStatus,
      normalizedItems
    );

    /* Payment status */

    const paymentStatus = getPaymentStatus(
      existingOrder.paymentMethod,
      newStatus
    );

    /* Update payment object */

    let updatedPayment = existingOrder.payment;

    if (
      existingOrder.payment &&
      typeof existingOrder.payment === "object"
    ) {
      updatedPayment = {
        ...existingOrder.payment,
        status: paymentStatus,
        amount:
          existingOrder.payment.amount ??
          existingOrder.total ??
          existingOrder.amount ??
          existingOrder.totalAmount ??
          0,
      };
    }

    /* Update order */

    const updatedOrder = {
      ...existingOrder,
      status: newStatus,
      paymentStatus,

      ...(updatedPayment ? { payment: updatedPayment } : {}),

      updatedAt: serverTimestamp(),
    };

    await updateDoc(orderRef, updatedOrder);

    /* Sync sales */

    await syncSale(orderId, {
      ...updatedOrder,
      id: orderId,
    });

    return Response.json(
      {
        success: true,
        orderId,
        status: newStatus,
        paymentStatus,
        message: "Order updated successfully.",
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Update order error:", error);

    return Response.json(
      {
        success: false,
        error: error?.message || "Failed to update order.",
      },
      { status: 500 }
    );
  }
}
