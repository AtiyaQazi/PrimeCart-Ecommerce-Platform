"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Minus,
  Plus,
  ShoppingBag,
  ShoppingCart,
  Store,
  Trash2,
  X,
} from "lucide-react";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "@/lib/firebase";

type Product = {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  description: string;
  image: string;
  images: string[];
  colors: string[];
  colorStocks: { color: string; stock: number }[];
  sizes: string[];
};

type CartItem = Product & {
  quantity: number;
  selectedColor?: string;
  selectedSize?: string;
};

type CheckoutForm = {
  customerName: string;
  customerEmail: string;
  phone: string;
  address: string;
  paymentMethod: "COD" | "Online";
  paymentNumber: string;
  paymentType: "Mobile Number" | "Bank Account Number";
};

type CheckoutMode = "cart" | "buyNow";

type OrderConfirmation = {
  orderId: string;
  total: number;
  paymentMethod: "COD" | "Online";
  paymentStatus: string;
  orderStatus: string;
};

const CART_KEY = "med-store-cart";

const formatPrice = (amount: number) =>
  new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 0,
  }).format(amount);

function getStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is string =>
      typeof item === "string" && item.trim().length > 0
  );
}



function normalizeColorStocks(
  value: unknown,
  fallbackColors: string[],
  fallbackStock: number
) {
  if (Array.isArray(value)) {
    const rows = value
      .filter(
        (entry) =>
          entry !== null &&
          typeof entry === "object" &&
          typeof (entry as { color?: unknown }).color === "string"
      )
      .map((entry) => {
        const row = entry as { color: string; stock?: unknown };

        return {
          color: row.color.trim() || "Default",
          stock: Math.max(
            0,
            Math.floor(Number(row.stock) || 0)
          ),
        };
      });

    const seen = new Set<string>();

    const unique = rows.filter((entry) => {
      const key = entry.color.toLowerCase();

      if (seen.has(key)) return false;

      seen.add(key);
      return true;
    });

    if (unique.length > 0) return unique;
  }

  const colors = fallbackColors.length
    ? fallbackColors
    : ["Default"];

  // Legacy product with one color: its existing total stock
  // can safely be assigned to that one color.
  if (colors.length === 1) {
    return [
      {
        color: colors[0].trim() || "Default",
        stock: Math.max(
          0,
          Math.floor(Number(fallbackStock) || 0)
        ),
      },
    ];
  }
  return colors.map((color) => ({
    color: color.trim() || "Default",
    stock: 0,
  }));
}


function getVariantStock(item: Pick<Product, "stock" | "colorStocks" | "colors"> & { selectedColor?: string }) {
  const color = item.selectedColor || item.colors[0] || "Default";
  return item.colorStocks?.find((entry) => entry.color.toLowerCase() === color.toLowerCase())?.stock ?? 0;
}

function getProductImage(data: Record<string, unknown>): string {
  const value =
    data.image ??
    data.imageUrl ??
    data.imageURL ??
    data.photoURL ??
    data.thumbnail;

  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  return getStringArray(data.images)[0] ?? "";
}

function readCart(): CartItem[] {
  if (typeof window === "undefined") return [];

  try {
    const saved = localStorage.getItem(CART_KEY);
    if (!saved) return [];

    const parsed: unknown = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (item): item is CartItem =>
        !!item &&
        typeof item === "object" &&
        typeof item.id === "string" &&
        typeof item.name === "string" &&
        Number.isFinite(Number(item.price)) &&
        Number(item.price) >= 0 &&
        Number.isFinite(Number(item.quantity)) &&
        Number(item.quantity) > 0
    );
  } catch {
    return [];
  }
}

function saveCart(items: CartItem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(CART_KEY, JSON.stringify(items));
}

const initialForm: CheckoutForm = {
  customerName: "",
  customerEmail: "",
  phone: "",
  address: "",
  paymentMethod: "COD",
  paymentNumber: "",
  paymentType: "Mobile Number",
};

function sameVariant(a: CartItem, b: CartItem) {
  return (
    a.id === b.id &&
    (a.selectedColor ?? "") === (b.selectedColor ?? "") &&
    (a.selectedSize ?? "") === (b.selectedSize ?? "")
  );
}

const PAKISTAN_IBAN_BANKS: Record<string, string> = {
  ABPA: "Allied Bank Limited",
  AIIN: "Al Baraka Bank Pakistan",
  ALFH: "Bank Alfalah",
  ASCM: "Askari Bank",
  BAHL: "Bank AL Habib",
  BKIP: "BankIslami Pakistan",
  BPUN: "The Bank of Punjab",
  BCEY: "Bank Makramah / legacy Summit Bank identifier",
  DIBP: "Dubai Islamic Bank Pakistan",
  FAYS: "Faysal Bank",
  FWOM: "First Women Bank",
  HABB: "Habib Bank Limited (HBL)",
  KHYB: "The Bank of Khyber",
  MEZN: "Meezan Bank",
  MCIB: "MCB Islamic Bank",
  MUCB: "MCB Bank",
  MPBL: "Habib Metropolitan Bank",
  MBPL: "Legacy Samba Bank identifier",
  NBPA: "National Bank of Pakistan",
  NBPB: "National Bank of Pakistan (additional identifier)",
  SCBL: "Standard Chartered Bank Pakistan",
  SIND: "Sindh Bank",
  SONE: "Soneri Bank",
  UNIL: "United Bank Limited (UBL)",
  JSBL: "JS Bank",
  KHAS: "Khushhali Microfinance Bank (where applicable)",
  TMBL: "Telenor Microfinance Bank (where applicable)",
  FINC: "FINCA Microfinance Bank (where applicable)",
  NRSP: "NRSP Microfinance Bank (where applicable)",
  PMCB: "Pak Oman Microfinance Bank (where applicable)",
};

function normalizeMobileNumber(value: string): string {
  const cleaned = value.replace(/[^\d+]/g, "");
  const hasPlus = cleaned.startsWith("+");
  const digits = cleaned.replace(/\+/g, "");
  return hasPlus ? `+${digits}` : digits;
}

function isValidPakistanMobileNumber(value: string): boolean {
  const normalized = value.replace(/[\s()-]/g, "");
  return /^(?:03\d{9}|\+?923\d{9})$/.test(normalized);
}

function normalizePakistanIban(value: string): string {
  return value.replace(/[\s-]/g, "").toUpperCase();
}

function ibanMod97(iban: string): number {
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;

  for (const character of rearranged) {
    const code = character.charCodeAt(0);

    if (code >= 48 && code <= 57) {
      remainder = (remainder * 10 + Number(character)) % 97;
    } else if (code >= 65 && code <= 90) {
      const numericValue = code - 55;
      remainder = (remainder * 100 + numericValue) % 97;
    } else {
      return -1;
    }
  }

  return remainder;
}

type IbanValidationResult = {
  valid: boolean;
  message: string;
};

function validatePakistanIban(value: string): IbanValidationResult {
  const iban = normalizePakistanIban(value);

  if (!iban) {
    return {
      valid: false,
      message: "Please enter your Pakistani bank IBAN.",
    };
  }

  if (!iban.startsWith("PK")) {
    return {
      valid: false,
      message:
        "Mobile numbers are not accepted here. Enter your bank IBAN starting with PK.",
    };
  }

  if (iban.length !== 24) {
    return {
      valid: false,
      message: "Pakistani IBAN must contain exactly 24 characters.",
    };
  }

  if (!/^PK\d{2}[A-Z]{4}[A-Z0-9]{16}$/.test(iban)) {
    return {
      valid: false,
      message:
        "Invalid IBAN. Format: PK + 2 digits + 4 bank-code letters + 16 account characters.",
    };
  }

  if (ibanMod97(iban) !== 1) {
    return {
      valid: false,
      message:
        "Invalid IBAN checksum. Please copy the correct IBAN from your bank.",
    };
  }

  return { valid: true, message: "" };
}

export default function ProductDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const rawId = params?.id;
  const productId = Array.isArray(rawId) ? rawId[0] : rawId;

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState("");
  const [selectedColor, setSelectedColor] = useState("");
  const [selectedSize, setSelectedSize] = useState("");

  const touchStartX = useRef<number | null>(null);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);

  // Buy Now uses separate checkout items and never overwrites the saved cart.
  const [checkoutItems, setCheckoutItems] = useState<CartItem[]>([]);
  const [checkoutMode, setCheckoutMode] = useState<CheckoutMode>("cart");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [cartLoaded, setCartLoaded] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [form, setForm] = useState<CheckoutForm>(initialForm);

  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [confirmedOrder, setConfirmedOrder] =
    useState<OrderConfirmation | null>(null);

  const cartCount = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart]
  );

  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cart]
  );

  const checkoutCount = useMemo(
    () => checkoutItems.reduce((sum, item) => sum + item.quantity, 0),
    [checkoutItems]
  );

  const checkoutSubtotal = useMemo(
    () =>
      checkoutItems.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      ),
    [checkoutItems]
  );

  const selectedColorStock = product ? getVariantStock({ ...product, selectedColor }) : 0;

  const selectedImageIndex = useMemo(
    () => Math.max(0, product?.images.indexOf(selectedImage) ?? 0),
    [product, selectedImage]
  );

function changeGalleryImage(direction: number) {
  if (!product || product.images.length < 2) return;

  const nextIndex = selectedImageIndex + direction;

  if (nextIndex < 0 || nextIndex >= product.images.length) return;

  setSelectedImage(product.images[nextIndex]);
}

  function handleGalleryTouchStart(
    event: React.TouchEvent<HTMLDivElement>
  ) {
    touchStartX.current = event.changedTouches[0]?.clientX ?? null;
  }

  function handleGalleryTouchEnd(
    event: React.TouchEvent<HTMLDivElement>
  ) {
    if (touchStartX.current === null) return;

    const endX = event.changedTouches[0]?.clientX ?? touchStartX.current;
    const distance = endX - touchStartX.current;

    if (Math.abs(distance) > 45) {
      changeGalleryImage(distance < 0 ? 1 : -1);
    }

    touchStartX.current = null;
  }

  useEffect(() => {
    if (!productId) {
      setError("The product ID is missing from this URL.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    setProduct(null);

    const unsubscribe = onSnapshot(
      doc(db, "products", productId),
      (snapshot) => {
        if (!snapshot.exists()) {
          setProduct(null);
          setError("This product is no longer available.");
          setLoading(false);
          return;
        }

        try {
          const data = snapshot.data() as Record<string, unknown>;
          const price = Number(data.price ?? 0);
          const stock = Number(data.stock ?? 0);

          if (
            !Number.isFinite(price) ||
            price < 0 ||
            !Number.isFinite(stock) ||
            stock < 0
          ) {
            throw new Error("This product has invalid pricing or stock data.");
          }

          // Supports both legacy `image` and the newer `images` array.
          // Remove duplicates and display a maximum of four images.
      const imageCandidates = [
  data.image,
  data.imageUrl,
  data.imageURL,
  data.photoURL,
  data.thumbnail,
  ...getStringArray(data.images),
  ...getStringArray(data.imageLinks),
  ...getStringArray(data.imageUrls),
  ...getStringArray(data.productImages),
];

const images = Array.from(
  new Set(
    imageCandidates
      .filter(
        (value): value is string =>
          typeof value === "string" && value.trim().length > 0
      )
      .map((value) => value.trim())
  )
);

          const rawColors = getStringArray(data.colors);
          const colorStocks = normalizeColorStocks(
            data.colorStocks,
            rawColors,
            stock
          );
          const normalizedColors = colorStocks.map((entry) => entry.color);
          const totalColorStock = colorStocks.reduce((sum, entry) => sum + entry.stock, 0);

          const loadedProduct: Product = {
            id: snapshot.id,
            name:
              typeof data.name === "string" && data.name.trim()
                ? data.name.trim()
                : "Unnamed Product",
            category:
              typeof data.category === "string" ? data.category : "Other",
            price,
            stock: totalColorStock,
            description:
              typeof data.description === "string" ? data.description : "",
            image: images[0] ?? "",
            images,
            colors: normalizedColors.length ? normalizedColors : ["Default"],
            colorStocks,
            sizes: getStringArray(data.sizes),
          };

          setProduct(loadedProduct);

          setSelectedImage((current) =>
            images.includes(current) ? current : images[0] ?? ""
          );

          setSelectedColor((current) =>
            loadedProduct.colors.includes(current)
              ? current
              : loadedProduct.colors[0] ?? "Default"
          );

          setSelectedSize((current) =>
            loadedProduct.sizes.includes(current)
              ? current
              : loadedProduct.sizes[0] ?? ""
          );

          setQuantity((current) => {
            const currentColor = loadedProduct.colors.includes(selectedColor)
              ? selectedColor
              : loadedProduct.colors[0];
            const available = loadedProduct.colorStocks.find((entry) => entry.color === currentColor)?.stock ?? 0;
            if (available <= 0) return 0;
            return Math.min(Math.max(1, current), available);
          });

          setCart((current) =>
            current.map((item) =>
              item.id === snapshot.id
                ? {
                    ...item,
                    ...loadedProduct,
                    quantity: item.quantity,
                    selectedColor: item.selectedColor,
                    selectedSize: item.selectedSize,
                  }
                : item
            )
          );

          setError("");
          setLoading(false);
        } catch (err) {
          console.error("Product details error:", err);
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load this product."
          );
          setLoading(false);
        }
      },
      (err) => {
        console.error("Product stock listener error:", err);
        setError("Unable to load the latest product stock.");
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [productId]);

  useEffect(() => {
    setCart(readCart());
    setCartLoaded(true);
  }, []);

  useEffect(() => {
    if (!cartLoaded) return;

    try {
      saveCart(cart);
    } catch (err) {
      console.error("Unable to save cart:", err);
      setError(
        "Unable to save your cart. Please check your browser storage settings."
      );
    }
  }, [cart, cartLoaded]);

  useEffect(() => {
    function handleStorage(event: StorageEvent) {
      if (event.key !== CART_KEY) return;
      setCart(readCart());
    }

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) return;

      setForm((current) => ({
        ...current,
        customerName: current.customerName || user.displayName || "",
        customerEmail: current.customerEmail || user.email || "",
      }));
    });

    return unsubscribe;
  }, []);

  function handleBack() {
    if (confirmationOpen) {
      setConfirmationOpen(false);
      return;
    }

    if (checkoutOpen) {
      setCheckoutOpen(false);
      setCheckoutError("");
      setCartOpen(checkoutMode === "cart");
      return;
    }

    if (cartOpen) {
      setCartOpen(false);
      setCheckoutError("");
      return;
    }

    if (window.history.length > 1) {
      router.back();
    } else {
      router.push("/store");
    }
  }

  function addProductToCart(goToCheckout: boolean) {
    if (!product || !cartLoaded) return;

    setError("");
    setNotice("");
    setConfirmedOrder(null);
    setCheckoutError("");

    const availableForColor = selectedColorStock;
    if (availableForColor < 1) {
      setError(`${selectedColor || "Default"} is currently out of stock.`);
      return;
    }

    if (
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > availableForColor
    ) {
      setError(`Please select a quantity between 1 and ${availableForColor} for ${selectedColor || "Default"}.`);
      return;
    }

    const selectedItem: CartItem = {
      ...product,
      quantity,
      selectedColor: selectedColor || undefined,
      selectedSize: selectedSize || undefined,
    };

    if (goToCheckout) {
      setCheckoutItems([selectedItem]);
      setCheckoutMode("buyNow");
      setCartOpen(false);
      setCheckoutOpen(true);
      return;
    }

    const existingCart = readCart();
    const matchingItem = existingCart.find((item) =>
      sameVariant(item, selectedItem)
    );

    const totalVariantQuantity = existingCart
      .filter((item) => sameVariant(item, selectedItem))
      .reduce((sum, item) => sum + Number(item.quantity || 0), 0);

    const newTotalVariantQuantity = totalVariantQuantity + quantity;

    if (newTotalVariantQuantity > availableForColor) {
      setError(
        `Only ${availableForColor} unit(s) of ${selectedColor || "Default"} are available. You already have ${totalVariantQuantity} in your cart.`
      );
      return;
    }

    const updatedCart = matchingItem
      ? existingCart.map((item) =>
          sameVariant(item, selectedItem)
            ? {
                ...item,
                ...product,
                quantity: item.quantity + quantity,
                selectedColor: selectedItem.selectedColor,
                selectedSize: selectedItem.selectedSize,
              }
            : item
        )
      : [...existingCart, selectedItem];

    try {
      saveCart(updatedCart);
      setCart(updatedCart);
    } catch (err) {
      console.error("Unable to save cart:", err);
      setError(
        "Unable to save your cart. Please check your browser storage settings."
      );
      return;
    }

    setCheckoutOpen(false);
    setCartOpen(true);
  }

  function updateCartQuantity(item: CartItem, delta: number) {
    const latestCart = readCart();
    const currentItem = latestCart.find((entry) => sameVariant(entry, item));

    if (!currentItem) return;

    const nextQuantity = currentItem.quantity + delta;

    if (nextQuantity < 1) {
      removeCartItem(item);
      return;
    }

    const availableForVariant = getVariantStock(currentItem);
    const sameColorOtherQuantity = latestCart
      .filter(
        (entry) =>
          entry.id === currentItem.id &&
          (entry.selectedColor || "Default").toLowerCase() ===
            (currentItem.selectedColor || "Default").toLowerCase() &&
          !sameVariant(entry, currentItem)
      )
      .reduce((sum, entry) => sum + entry.quantity, 0);

    if (nextQuantity + sameColorOtherQuantity > availableForVariant) {
      setCheckoutError(
        `Only ${availableForVariant} unit(s) of ${currentItem.name} (${currentItem.selectedColor || "Default"}) are available across sizes.`
      );
      return;
    }

    const updatedCart = latestCart.map((entry) =>
      sameVariant(entry, item) ? { ...entry, quantity: nextQuantity } : entry
    );

    try {
      saveCart(updatedCart);
      setCart(updatedCart);
      setCheckoutError("");
    } catch (err) {
      console.error("Unable to update cart quantity:", err);
      setCheckoutError("Unable to update your cart. Please try again.");
    }
  }

  function removeCartItem(item: CartItem) {
    const updatedCart = readCart().filter(
      (currentItem) => !sameVariant(currentItem, item)
    );

    try {
      saveCart(updatedCart);
      setCart(updatedCart);
      setCheckoutError("");
    } catch (err) {
      console.error("Unable to remove cart item:", err);
      setCheckoutError("Unable to update your cart. Please try again.");
    }
  }

  function closeCart() {
    setCartOpen(false);
    setCheckoutError("");
  }

  function closeCheckout() {
    setCheckoutOpen(false);
    setCheckoutError("");
  }

  function openCartCheckout() {
    const latestCart = readCart();

    if (latestCart.length === 0) {
      setCart([]);
      setCheckoutError("Your cart is empty. Add a product before checking out.");
      return;
    }

    setCheckoutItems(latestCart);
    setCheckoutMode("cart");
    setCheckoutError("");
    setCartOpen(false);
    setCheckoutOpen(true);
  }

  function updateForm<K extends keyof CheckoutForm>(
    key: K,
    value: CheckoutForm[K]
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function placeOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCheckoutError("");

    if (submitting) return;

    const latestItems =
      checkoutMode === "buyNow" ? checkoutItems : readCart();

    if (latestItems.length === 0) {
      setCheckoutError(
        checkoutMode === "buyNow"
          ? "No product is selected for Buy Now. Please return to the product and try again."
          : "Your cart is empty. Add a product before checking out."
      );

      if (checkoutMode === "cart") {
        setCart([]);
        setCheckoutOpen(false);
        setCartOpen(true);
      }

      return;
    }

    if (
      !form.customerName.trim() ||
      !form.customerEmail.trim() ||
      !form.phone.trim() ||
      !form.address.trim()
    ) {
      setCheckoutError("Please complete all customer and delivery details.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.customerEmail.trim())) {
      setCheckoutError("Please enter a valid email address.");
      return;
    }

    if (!isValidPakistanMobileNumber(form.phone)) {
      setCheckoutError(
        "Enter a valid Pakistani mobile number, for example 03001234567 or +923001234567."
      );
      return;
    }

    let normalizedPaymentNumber = "";

    if (form.paymentMethod === "Online") {
      if (!form.paymentNumber.trim()) {
        setCheckoutError(
          form.paymentType === "Bank Account Number"
            ? "Bank IBAN is required for online payment."
            : "Mobile payment number is required for online payment."
        );
        return;
      }

      if (form.paymentType === "Mobile Number") {
        if (!isValidPakistanMobileNumber(form.paymentNumber)) {
          setCheckoutError(
            "Enter a valid Pakistani mobile payment number, for example 03001234567 or +923001234567."
          );
          return;
        }

        normalizedPaymentNumber = form.paymentNumber.replace(/[\s()-]/g, "");
      } else {
        const ibanResult = validatePakistanIban(form.paymentNumber);

        if (!ibanResult.valid) {
          setCheckoutError(ibanResult.message);
          return;
        }

        normalizedPaymentNumber = normalizePakistanIban(
          form.paymentNumber
        );
      }
    }

    setSubmitting(true);

    try {
      const productQuantities = new Map<string, { id: string; color: string; quantity: number; item: CartItem }>();

      for (const item of latestItems) {
        if (!Number.isInteger(item.quantity) || item.quantity < 1) {
          throw new Error(
            `Invalid quantity for ${item.name}. Please update your order.`
          );
        }

        const color = item.selectedColor || item.colors[0] || "Default";
        const key = `${item.id}::${color.toLowerCase()}`;
        const existing = productQuantities.get(key);
        productQuantities.set(key, {
          id: item.id,
          color,
          quantity: (existing?.quantity ?? 0) + item.quantity,
          item,
        });
      }

      // Verify current stock for every product in the checkout.
      for (const { id, color, quantity: requestedQuantity, item } of productQuantities.values()) {
        const snapshot = await getDoc(doc(db, "products", id));

        if (!snapshot.exists()) {
          throw new Error(
            `${item?.name ?? "A product"} is no longer available. Please remove it from your order.`
          );
        }

        const productData = snapshot.data();
        const rawColorStocks = normalizeColorStocks(
          productData.colorStocks,
          getStringArray(productData.colors),
          Number(productData.stock ?? 0)
        );
    const matchedColor = rawColorStocks.find(
  (entry) =>
    entry.color.trim().toLowerCase() === color.trim().toLowerCase()
);

if (!matchedColor) {
  throw new Error(
    `Stock for ${item.name} in color "${color}" is not configured. Please contact the store administrator.`
  );
}

const latestStock = matchedColor.stock;

        if (!Number.isFinite(latestStock) || latestStock < requestedQuantity) {
          throw new Error(
            `Insufficient stock for ${item.name} in ${color}. Available quantity: ${Math.max(0, latestStock)}. Please update your order.`
          );
        }

        const totalLatestStock = rawColorStocks.reduce((sum, entry) => sum + entry.stock, 0);
        setCheckoutItems((current) =>
          current.map((checkoutItem) => checkoutItem.id === id
            ? { ...checkoutItem, stock: totalLatestStock, colorStocks: rawColorStocks }
            : checkoutItem)
        );
        setCart((current) =>
          current.map((cartItem) => cartItem.id === id
            ? { ...cartItem, stock: totalLatestStock, colorStocks: rawColorStocks }
            : cartItem)
        );
      }

      const orderTotal = latestItems.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      );

      const paymentNumber =
        form.paymentMethod === "Online" ? normalizedPaymentNumber : "";

      const paymentType =
        form.paymentMethod === "Online" ? form.paymentType : "";

      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customerName: form.customerName.trim(),
          customerEmail: form.customerEmail.trim().toLowerCase(),
          phone: form.phone.trim(),
          address: form.address.trim(),

        
items: latestItems.map((item) => {
  const color =
    item.selectedColor || item.colors[0] || "Default";

  return {
    productId: item.id,
    id: item.id,
    name: item.name,
    price: item.price,
    quantity: item.quantity,
    image: item.image,
    images: item.images,
    category: item.category,

    // Both fields are sent for compatibility with the orders API.
    color,
    selectedColor: color,
    selectedSize: item.selectedSize ?? "",
  };
}),


          totalAmount: orderTotal,
          total: orderTotal,

          paymentMethod: form.paymentMethod,
          paymentType,
          paymentNumber,

          payment: {
            method:
              form.paymentMethod === "Online" ? "Online Payment" : "COD",
            paymentType,
            payerName: form.customerName.trim(),
            paymentNumber,
            amount: orderTotal,
          },

          paymentStatus: form.paymentMethod === "Online" ? "Paid" : "Pending",
status: "Processing",
          source: "store",
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Unable to place your order.");
      }

      const orderId = String(result.orderId ?? "");

      // A Buy Now order must never clear the saved cart.
      if (checkoutMode === "cart") {
        setCart([]);
        saveCart([]);
      }

      setCheckoutItems([]);
      setCheckoutOpen(false);
      setCartOpen(false);
      setNotice("");

      // Open the confirmation popup only after the API confirms success.
      setConfirmedOrder({
        orderId,
        total: orderTotal,
        paymentMethod: form.paymentMethod,
        paymentStatus:
  form.paymentMethod === "Online"
    ? "Paid"
    : typeof result.paymentStatus === "string"
      ? result.paymentStatus
      : "Pending",
        orderStatus:
          typeof result.status === "string" ? result.status : "Processing",
      });
      setConfirmationOpen(true);

      setForm((current) => ({
        ...current,
        phone: "",
        address: "",
        paymentNumber: "",
      }));
    } catch (err) {
      console.error("Order submission error:", err);
      setCheckoutError(
        err instanceof Error
          ? err.message
          : "Unable to place your order. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  function continueShopping() {
    setConfirmationOpen(false);
    setConfirmedOrder(null);
    router.push("/store");
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center gap-3 bg-[#F7F5EF] text-[#315C43]">
        <Loader2 size={25} className="animate-spin" />
        <span className="text-sm font-medium">Loading product details...</span>
      </main>
    );
  }

  if (!product) {
    return (
      <main className="min-h-screen bg-[#F7F5EF] px-4 py-16 text-[#20251F]">
        <div className="mx-auto max-w-xl rounded-2xl border border-[#E4E2D8] bg-white p-8 text-center">
          <ShoppingBag size={40} className="mx-auto text-[#77796F]" />
          <h1 className="mt-4 text-xl font-bold">Product unavailable</h1>
          <p className="mt-2 break-words text-sm leading-6 text-[#77796F]">
            {error || "This product could not be found."}
          </p>
          <p className="mt-3 break-all text-xs text-[#929489]">
            Product ID: {productId || "Missing"}
          </p>
          <Link
            href="/store"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#315C43] px-5 py-3 text-sm font-semibold text-white hover:bg-[#254832]"
          >
            <ArrowLeft size={17} />
            Back to Store
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F7F5EF] text-[#20251F]">
      <header className="sticky top-0 z-30 border-b border-[#E4E2D8] bg-[#F7F5EF]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/store" className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#315C43] text-white">
              <Store size={23} />
            </span>
            <span>
              <span className="block text-lg font-bold">PrimeCart</span>
              <span className="block text-xs text-[#77796F]">
                Everyday shopping, made simple
              </span>
            </span>
          </Link>

          <button
            type="button"
            onClick={() => {
              setError("");
              setNotice("");
              setCheckoutError("");
              setCheckoutOpen(false);
              setCartOpen(true);
            }}
            className="relative flex items-center gap-2 rounded-xl bg-[#315C43] px-4 py-3 text-sm font-semibold text-white hover:bg-[#254832]"
          >
            <ShoppingCart size={19} />
            <span className="hidden sm:inline">My Cart</span>
            <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-[#E9DDBD] px-1 text-xs font-bold text-[#20251F]">
              {cartCount}
            </span>
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#315C43] hover:underline"
        >
          <ArrowLeft size={17} />
          Back
        </button>

        {notice && (
          <div className="mt-5 flex items-start gap-2 rounded-xl border border-[#C8DDCA] bg-[#EDF5EC] p-4 text-sm text-[#315C43]">
            <CheckCircle2 size={19} className="mt-0.5 shrink-0" />
            <p>{notice}</p>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        <section className="mt-7 grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-12">
          <div>
            {/* Main image gallery: arrows, thumbnails and mobile swipe */}
            <div
              className="relative flex min-h-[340px] touch-pan-y items-center justify-center overflow-hidden rounded-3xl bg-[#F0EEE5] sm:min-h-[480px]"
              onTouchStart={handleGalleryTouchStart}
              onTouchEnd={handleGalleryTouchEnd}
            >
              {selectedImage ? (
                <img
                  src={selectedImage}
                  alt={product.name}
                  draggable={false}
                  className="max-h-[480px] w-full select-none object-contain p-5 sm:p-8"
                />
              ) : (
                <ShoppingBag
                  size={76}
                  strokeWidth={1.1}
                  className="text-[#A5A79A]"
                />
              )}

              {product.images.length > 1 && (
                <>
                  <button
  type="button"
  disabled={selectedImageIndex === 0}
  onClick={() => changeGalleryImage(-1)}
  aria-label="Previous product image"
  className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-[#E4E2D8] bg-white/95 text-[#315C43] shadow-md transition hover:bg-[#E7EFE6] disabled:cursor-not-allowed disabled:opacity-30"
>
  <ArrowLeft size={19} />
</button>

                  <button
  type="button"
  disabled={selectedImageIndex === product.images.length - 1}
  onClick={() => changeGalleryImage(1)}
  aria-label="Next product image"
  className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-[#E4E2D8] bg-white/95 text-[#315C43] shadow-md transition hover:bg-[#E7EFE6] disabled:cursor-not-allowed disabled:opacity-30"
>
  <ArrowRight size={19} />
</button>

                  <span className="absolute bottom-3 right-3 rounded-full bg-[#20251F]/75 px-3 py-1.5 text-xs font-semibold text-white">
                    {selectedImageIndex + 1} / {product.images.length}
                  </span>
                </>
              )}
            </div>

            {product.images.length > 1 && (
              <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
                {product.images.map((image, index) => (
                  <button
                    key={`${image}-${index}`}
                    type="button"
                    onClick={() => setSelectedImage(image)}
                    aria-label={`View product image ${index + 1}`}
                    aria-pressed={selectedImage === image}
                    className={`relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border-2 bg-white ${
                      selectedImage === image
                        ? "border-[#315C43]"
                        : "border-[#E4E2D8]"
                    }`}
                  >
                    <img
                      src={image}
                      alt={`${product.name} ${index + 1}`}
                      className="h-full w-full object-contain p-1"
                    />
                  </button>
                ))}
              </div>
            )}

            {product.images.length > 1 && (
              <p className="mt-1 text-center text-xs text-[#77796F]">
                Select a thumbnail or swipe to view more images.
              </p>
            )}
          </div>

          <div className="py-1 sm:py-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#66806B]">
              {product.category}
            </p>
            <h1 className="mt-3 text-3xl font-bold leading-tight sm:text-4xl">
              {product.name}
            </h1>
            <p className="mt-5 text-2xl font-bold text-[#315C43] sm:text-3xl">
              {formatPrice(product.price)}
            </p>

            <div className="mt-5">
              {selectedColorStock <= 0 ? (
                <span className="inline-flex rounded-full bg-red-100 px-3 py-1.5 text-sm font-semibold text-red-700">
                  Out of Stock
                </span>
              ) : selectedColorStock <= 10 ? (
                <span className="inline-flex rounded-full bg-[#F8E9C9] px-3 py-1.5 text-sm font-semibold text-[#805B19]">
                  Low Stock · {selectedColorStock} left
                </span>
              ) : (
                <span className="inline-flex rounded-full bg-[#E7EFE6] px-3 py-1.5 text-sm font-semibold text-[#315C43]">
                  In Stock · {selectedColorStock} available
                </span>
              )}
            </div>

            <div className="mt-7 border-t border-[#E4E2D8] pt-6">
              <h2 className="font-bold">Product Description</h2>
              <p className="mt-3 whitespace-pre-line text-sm leading-7 text-[#62665C]">
                {product.description ||
                  "Product details have not been added yet."}
              </p>
            </div>

            {product.colors.length > 0 && (
              <div className="mt-7">
                <h2 className="text-sm font-bold">
                  Color:{" "}
                  <span className="font-medium text-[#62665C]">
                    {selectedColor}
                  </span>
                </h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {product.colors.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => {
                        setSelectedColor(color);
                        const available = product.colorStocks.find((entry) => entry.color.toLowerCase() === color.toLowerCase())?.stock ?? 0;
                        setQuantity(available > 0 ? 1 : 0);
                        setError("");
                      }}
                      className={`rounded-xl border px-4 py-2 text-sm font-medium ${
                        selectedColor === color
                          ? "border-[#315C43] bg-[#E7EFE6] text-[#315C43]"
                          : "border-[#E0DED3] bg-white hover:border-[#315C43]"
                      }`}
                    >
                      <span>{color}</span>
                      {(product.colorStocks.find((entry) => entry.color.toLowerCase() === color.toLowerCase())?.stock ?? 0) <= 0 && (
                        <span className="ml-2 text-xs font-bold text-red-600">Not in stock</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {product.sizes.length > 0 && (
              <div className="mt-6">
                <h2 className="text-sm font-bold">
                  Size:{" "}
                  <span className="font-medium text-[#62665C]">
                    {selectedSize}
                  </span>
                </h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {product.sizes.map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setSelectedSize(size)}
                      className={`min-w-12 rounded-xl border px-4 py-2 text-sm font-medium ${
                        selectedSize === size
                          ? "border-[#315C43] bg-[#E7EFE6] text-[#315C43]"
                          : "border-[#E0DED3] bg-white hover:border-[#315C43]"
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-7">
              <label className="block text-sm font-bold">Quantity</label>
              <div className="mt-3 inline-flex items-center gap-5 rounded-xl border border-[#E0DED3] bg-white p-2">
                <button
                  type="button"
                  disabled={quantity <= 1 || selectedColorStock < 1}
                  onClick={() =>
                    setQuantity((current) => Math.max(1, current - 1))
                  }
                  className="rounded-lg p-2 hover:bg-[#F0EEE5] disabled:opacity-40"
                  aria-label="Decrease quantity"
                >
                  <Minus size={17} />
                </button>
                <span className="min-w-6 text-center font-bold">
                  {quantity}
                </span>
                <button
                  type="button"
                  disabled={quantity >= selectedColorStock || selectedColorStock < 1}
                  onClick={() =>
                    setQuantity((current) =>
                      Math.min(selectedColorStock, current + 1)
                    )
                  }
                  className="rounded-lg p-2 hover:bg-[#F0EEE5] disabled:opacity-40"
                  aria-label="Increase quantity"
                >
                  <Plus size={17} />
                </button>
              </div>
            </div>

            <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                disabled={selectedColorStock < 1 || !cartLoaded}
                onClick={() => addProductToCart(false)}
                className="flex items-center justify-center gap-2 rounded-xl border border-[#315C43] bg-white px-4 py-3.5 text-sm font-bold text-[#315C43] transition hover:bg-[#E7EFE6] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ShoppingCart size={18} />
                Add to Cart
              </button>
              <button
                type="button"
                disabled={selectedColorStock < 1 || !cartLoaded}
                onClick={() => addProductToCart(true)}
                className="flex items-center justify-center gap-2 rounded-xl bg-[#315C43] px-4 py-3.5 text-sm font-bold text-white transition hover:bg-[#254832] disabled:cursor-not-allowed disabled:bg-[#B8BBAF]"
              >
                <ShoppingBag size={18} />
                Buy Now
              </button>
            </div>

            <p className="mt-4 text-xs leading-5 text-[#77796F]">
              Review your cart and delivery details before placing your order.
            </p>
          </div>
        </section>
      </div>

      <footer className="mt-10 border-t border-[#E4E2D8] bg-white">
        <div className="mx-auto max-w-7xl px-4 py-7 text-sm text-[#77796F] sm:px-6 lg:px-8">
          <span className="font-semibold text-[#315C43]">PrimeCart</span>
          <span className="ml-3">Thank you for shopping with us.</span>
        </div>
      </footer>

      {/* Cart drawer */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button
            type="button"
            aria-label="Close cart"
            onClick={closeCart}
            className="absolute inset-0 bg-black/40"
          />

          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Your cart"
            className="relative flex h-full w-full max-w-lg flex-col bg-[#F7F5EF] shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[#E4E2D8] bg-white px-5 py-4">
              <button
                type="button"
                onClick={closeCart}
                className="inline-flex items-center gap-2 text-sm font-semibold text-[#315C43] hover:underline"
              >
                <ArrowLeft size={18} />
                Back to Product
              </button>
              <button
                type="button"
                onClick={closeCart}
                aria-label="Close cart"
                className="rounded-lg p-2 hover:bg-[#F0EEE5]"
              >
                <X size={21} />
              </button>
            </div>

            <div className="flex items-center justify-between px-5 py-5">
              <h2 className="text-xl font-bold">Your Cart</h2>
              <span className="rounded-full bg-[#E9DDBD] px-3 py-1 text-sm font-bold">
                {cartCount} item(s)
              </span>
            </div>

            <div className="flex-1 overflow-y-auto px-5 pb-5">
              {cart.length === 0 ? (
                <div className="rounded-2xl border border-[#E4E2D8] bg-white p-8 text-center">
                  <ShoppingCart
                    size={38}
                    className="mx-auto text-[#77796F]"
                  />
                  <h3 className="mt-4 font-bold">Your cart is empty</h3>
                  <p className="mt-2 text-sm text-[#77796F]">
                    Return to the product and add an item to your cart.
                  </p>
                  <button
                    type="button"
                    onClick={closeCart}
                    className="mt-5 rounded-xl bg-[#315C43] px-5 py-3 text-sm font-semibold text-white"
                  >
                    Continue Shopping
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {cart.map((item) => (
                    <div
                      key={`${item.id}-${item.selectedColor ?? ""}-${item.selectedSize ?? ""}`}
                      className="rounded-2xl border border-[#E4E2D8] bg-white p-4"
                    >
                      <div className="flex gap-3">
                        <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#F0EEE5]">
                          {item.image ? (
                            <img
                              src={item.image}
                              alt={item.name}
                              className="h-full w-full object-contain p-2"
                            />
                          ) : (
                            <ShoppingBag
                              size={28}
                              className="text-[#A5A79A]"
                            />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <h3 className="font-bold">{item.name}</h3>
                          <p className="mt-1 text-sm font-semibold text-[#315C43]">
                            {formatPrice(item.price)}
                          </p>

                          {(item.selectedColor || item.selectedSize) && (
                            <p className="mt-1 text-xs text-[#77796F]">
                              {[item.selectedColor, item.selectedSize]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          )}

                          <p className="mt-1 text-xs text-[#77796F]">
                            {getVariantStock(item) > 0
                              ? `${getVariantStock(item)} available in ${item.selectedColor || "Default"}`
                              : `${item.selectedColor || "Default"} — Not in stock`}
                          </p>

                          <div className="mt-3 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 rounded-lg border border-[#E4E2D8] px-1">
                              <button
                                type="button"
                                aria-label={`Decrease ${item.name} quantity`}
                                onClick={() => updateCartQuantity(item, -1)}
                                className="p-1.5 hover:text-[#315C43]"
                              >
                                <Minus size={14} />
                              </button>

                              <span className="min-w-5 text-center text-sm font-bold">
                                {item.quantity}
                              </span>

                              <button
                                type="button"
                                aria-label={`Increase ${item.name} quantity`}
                                disabled={
                                  item.quantity >= getVariantStock(item) ||
                                  cart
                                    .filter(
                                      (entry) =>
                                        entry.id === item.id &&
                                        !sameVariant(entry, item)
                                    )
                                    .filter((entry) => (entry.selectedColor || "Default").toLowerCase() === (item.selectedColor || "Default").toLowerCase())
                                    .reduce((sum, entry) => sum + entry.quantity, 0) +
                                    item.quantity >= getVariantStock(item)
                                }
                                onClick={() => updateCartQuantity(item, 1)}
                                className="p-1.5 hover:text-[#315C43] disabled:opacity-40"
                              >
                                <Plus size={14} />
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() => removeCartItem(item)}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:underline"
                            >
                              <Trash2 size={14} />
                              Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {checkoutError && (
                <p
                  role="alert"
                  className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                >
                  {checkoutError}
                </p>
              )}
            </div>

            {cart.length > 0 && (
              <div className="border-t border-[#E4E2D8] bg-white p-5">
                <div className="flex items-center justify-between text-sm text-[#62665C]">
                  <span>Subtotal</span>
                  <span className="font-bold text-[#20251F]">
                    {formatPrice(subtotal)}
                  </span>
                </div>
                <p className="mt-2 text-xs text-[#77796F]">
                  Delivery charges, if applicable, will be confirmed separately.
                </p>
                <button
                  type="button"
                  onClick={openCartCheckout}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#315C43] px-4 py-3.5 text-sm font-bold text-white hover:bg-[#254832]"
                >
                  Proceed to Checkout
                  <ShoppingBag size={17} />
                </button>
              </div>
            )}
          </aside>
        </div>
      )}

      {/* Checkout dialog */}
      {checkoutOpen && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/45 p-3 sm:p-6">
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Checkout"
            className="my-auto w-full max-w-2xl overflow-hidden rounded-2xl border border-[#E4E2D8] bg-[#F7F5EF] shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[#E4E2D8] bg-white px-5 py-4 sm:px-6">
              <button
                type="button"
                onClick={() => {
                  setCheckoutOpen(false);
                  setCheckoutError("");
                  setCartOpen(checkoutMode === "cart");
                }}
                className="inline-flex items-center gap-2 text-sm font-semibold text-[#315C43] hover:underline"
              >
                <ArrowLeft size={18} />
                {checkoutMode === "buyNow" ? "Back to Product" : "Back to Cart"}
              </button>

              <button
                type="button"
                onClick={closeCheckout}
                aria-label="Close checkout"
                className="rounded-lg p-2 hover:bg-[#F0EEE5]"
              >
                <X size={21} />
              </button>
            </div>

            <form
              onSubmit={placeOrder}
              className="max-h-[calc(100vh-100px)] overflow-y-auto p-5 sm:p-6"
            >
              <h2 className="text-2xl font-bold">Checkout</h2>
              <p className="mt-1 text-sm text-[#77796F]">
                {checkoutMode === "buyNow"
                  ? "Review your selected product and enter your details."
                  : "Review your cart and enter your details to place your order."}
              </p>

              <div className="mt-5 rounded-xl border border-[#E4E2D8] bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-[#62665C]">
                    Items ({checkoutCount})
                  </span>
                  <span className="font-bold">
                    {formatPrice(checkoutSubtotal)}
                  </span>
                </div>

                <div className="mt-3 space-y-2">
                  {checkoutItems.map((item) => (
                    <div
                      key={`${item.id}-${item.selectedColor ?? ""}-${item.selectedSize ?? ""}`}
                      className="flex justify-between gap-3 text-sm"
                    >
                      <span className="text-[#62665C]">
                        {item.name} × {item.quantity}
                        {(item.selectedColor || item.selectedSize) &&
                          ` (${[item.selectedColor, item.selectedSize]
                            .filter(Boolean)
                            .join(", ")})`}
                      </span>
                      <span className="shrink-0 font-semibold">
                        {formatPrice(item.price * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="customerName"
                    className="mb-1.5 block text-sm font-semibold"
                  >
                    Full Name *
                  </label>
                  <input
                    id="customerName"
                    required
                    autoComplete="name"
                    value={form.customerName}
                    onChange={(e) =>
                      updateForm("customerName", e.target.value)
                    }
                    className="w-full rounded-xl border border-[#DCD9CD] bg-white px-3 py-3 text-sm outline-none focus:border-[#315C43]"
                    placeholder="Enter your full name"
                  />
                </div>

                <div>
                  <label
                    htmlFor="customerEmail"
                    className="mb-1.5 block text-sm font-semibold"
                  >
                    Email Address *
                  </label>
                  <input
                    id="customerEmail"
                    type="email"
                    required
                    autoComplete="email"
                    value={form.customerEmail}
                    onChange={(e) =>
                      updateForm("customerEmail", e.target.value)
                    }
                    className="w-full rounded-xl border border-[#DCD9CD] bg-white px-3 py-3 text-sm outline-none focus:border-[#315C43]"
                    placeholder="you@example.com"
                  />
                </div>

                <div>
                  <label
                    htmlFor="customerPhone"
                    className="mb-1.5 block text-sm font-semibold"
                  >
                    Mobile Number *
                  </label>
                  <input
                    id="customerPhone"
                    type="tel"
                    required
                    autoComplete="tel"
                    value={form.phone}
                    onChange={(e) =>
                      updateForm("phone", normalizeMobileNumber(e.target.value))
                    }
                    className="w-full rounded-xl border border-[#DCD9CD] bg-white px-3 py-3 text-sm outline-none focus:border-[#315C43]"
                    placeholder="03001234567"
                  />
                </div>

                <div>
                  <label
                    htmlFor="deliveryAddress"
                    className="mb-1.5 block text-sm font-semibold"
                  >
                    Delivery Address *
                  </label>
                  <input
                    id="deliveryAddress"
                    required
                    autoComplete="street-address"
                    value={form.address}
                    onChange={(e) => updateForm("address", e.target.value)}
                    className="w-full rounded-xl border border-[#DCD9CD] bg-white px-3 py-3 text-sm outline-none focus:border-[#315C43]"
                    placeholder="House, street, city"
                  />
                </div>
              </div>

              <div className="mt-6">
                <h3 className="text-sm font-bold">Payment Method</h3>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        paymentMethod: "COD",
                        paymentNumber: "",
                      }))
                    }
                    className={`rounded-xl border p-4 text-left ${
                      form.paymentMethod === "COD"
                        ? "border-[#315C43] bg-[#E7EFE6]"
                        : "border-[#E0DED3] bg-white"
                    }`}
                  >
                    <span className="block font-bold">Cash on Delivery</span>
                    <span className="mt-1 block text-xs text-[#77796F]">
                      Pay when your order arrives.
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => updateForm("paymentMethod", "Online")}
                    className={`rounded-xl border p-4 text-left ${
                      form.paymentMethod === "Online"
                        ? "border-[#315C43] bg-[#E7EFE6]"
                        : "border-[#E0DED3] bg-white"
                    }`}
                  >
                    <span className="block font-bold">Online Payment</span>
                    <span className="mt-1 block text-xs text-[#77796F]">
                      Choose a mobile number or bank account number.
                    </span>
                  </button>
                </div>
              </div>

              {form.paymentMethod === "Online" && (
                <div className="mt-4 rounded-xl border border-[#DCD9CD] bg-white p-4">
                  <h3 className="mb-3 text-sm font-bold">
                    Online Payment Details
                  </h3>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          paymentType: "Mobile Number",
                          paymentNumber: "",
                        }))
                      }
                      className={`rounded-xl border p-3 text-left text-sm font-semibold ${
                        form.paymentType === "Mobile Number"
                          ? "border-[#315C43] bg-[#E7EFE6] text-[#315C43]"
                          : "border-[#E0DED3] bg-white"
                      }`}
                    >
                      Mobile Number
                      <span className="mt-1 block text-xs font-normal text-[#77796F]">
                        Easypaisa, JazzCash or other mobile payment
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          paymentType: "Bank Account Number",
                          paymentNumber: "",
                        }))
                      }
                      className={`rounded-xl border p-3 text-left text-sm font-semibold ${
                        form.paymentType === "Bank Account Number"
                          ? "border-[#315C43] bg-[#E7EFE6] text-[#315C43]"
                          : "border-[#E0DED3] bg-white"
                      }`}
                    >
                      Bank Account Number
                      <span className="mt-1 block text-xs font-normal text-[#77796F]">
                        Enter your 24-character Pakistani IBAN
                      </span>
                    </button>
                  </div>

                  <label
                    htmlFor="paymentNumber"
                    className="mb-1.5 mt-4 block text-sm font-semibold"
                  >
                    {form.paymentType === "Bank Account Number"
                      ? "Pakistani IBAN *"
                      : "Mobile Payment Number *"}
                  </label>

                  <input
                    id="paymentNumber"
                    type="text"
                    inputMode={
                      form.paymentType === "Bank Account Number"
                        ? "text"
                        : "tel"
                    }
                    autoComplete="off"
                    autoCapitalize={
                      form.paymentType === "Bank Account Number"
                        ? "characters"
                        : "off"
                    }
                    spellCheck={false}
                    required
                    maxLength={
                      form.paymentType === "Bank Account Number" ? 24 : 13
                    }
                    value={form.paymentNumber}
                    onChange={(e) => {
                      const rawValue = e.target.value;

                      if (form.paymentType === "Bank Account Number") {
                        const value = rawValue
                          .replace(/[\s-]/g, "")
                          .replace(/[^a-zA-Z0-9]/g, "")
                          .toUpperCase()
                          .slice(0, 24);

                        if (
                          value &&
                          !value.startsWith("PK") &&
                          !"PK".startsWith(value)
                        ) {
                          return;
                        }

                        updateForm("paymentNumber", value);
                        return;
                      }

                      const value = normalizeMobileNumber(rawValue).slice(
                        0,
                        13
                      );
                      updateForm("paymentNumber", value);
                    }}
                    className="w-full rounded-xl border border-[#DCD9CD] bg-white px-3 py-3 text-sm uppercase outline-none focus:border-[#315C43]"
                    placeholder={
                      form.paymentType === "Bank Account Number"
                        ? "PK36SCBL0000001123456702"
                        : "03001234567"
                    }
                    aria-describedby="paymentNumberHelp"
                  />

                  {form.paymentType === "Bank Account Number" && (
                    <div className="mt-2 rounded-lg bg-[#F7F5EF] p-3">
                      <p className="text-xs leading-5 text-[#62665C]">
                        Enter your complete Pakistani IBAN.
                      </p>

                      {form.paymentNumber.length >= 8 && (
                        <p className="mt-1 text-xs font-medium text-[#315C43]">
                          Bank identifier:{" "}
                          {PAKISTAN_IBAN_BANKS[
                            normalizePakistanIban(form.paymentNumber).slice(
                              4,
                              8
                            )
                          ] ??
                            "Code not listed — IBAN format and checksum will still be validated"}
                        </p>
                      )}
                    </div>
                  )}

                  <p
                    id="paymentNumberHelp"
                    className="mt-2 text-xs leading-5 text-[#77796F]"
                  >
                    {form.paymentType === "Bank Account Number"
                      ? "Enter your 24-character Pakistani IBAN.Example: PK36SCBL0000001123456702. Format validation does not confirm account ownership or transfer money."
                      : "Enter a Pakistani IBAN."}
                  </p>
                </div>
              )}

              {checkoutError && (
                <p
                  role="alert"
                  className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                >
                  {checkoutError}
                </p>
              )}

              <div className="mt-6 border-t border-[#E4E2D8] pt-5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Order Total</span>
                  <span className="text-xl font-bold text-[#315C43]">
                    {formatPrice(checkoutSubtotal)}
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={submitting || checkoutItems.length === 0}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#315C43] px-4 py-3.5 text-sm font-bold text-white hover:bg-[#254832] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Placing Order...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={18} />
                      Place Order
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={closeCheckout}
                  className="mt-3 w-full rounded-xl border border-[#315C43] bg-white px-4 py-3 text-sm font-semibold text-[#315C43] hover:bg-[#E7EFE6]"
                >
                  Continue Shopping
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* Order confirmation popup */}
      {confirmationOpen && confirmedOrder && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/55 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="order-confirmed-title"
            className="relative my-auto w-full max-w-md overflow-hidden rounded-3xl border border-[#E4E2D8] bg-[#F7F5EF] shadow-2xl"
          >
            <button
              type="button"
              onClick={() => setConfirmationOpen(false)}
              aria-label="Close order confirmation"
              className="absolute right-3 top-3 rounded-full p-2 text-[#77796F] transition hover:bg-[#E9E5D9] hover:text-[#20251F]"
            >
              <X size={20} />
            </button>

            <div className="px-6 pb-7 pt-9 text-center sm:px-8">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#E1EEDF]">
                <CheckCircle2
                  size={45}
                  strokeWidth={1.8}
                  className="text-[#315C43]"
                />
              </div>

              <p className="mt-5 text-xs font-bold uppercase tracking-[0.2em] text-[#66806B]">
                Thank you for your order
              </p>

              <h2
                id="order-confirmed-title"
                className="mt-2 text-3xl font-bold text-[#315C43]"
              >
                Order Confirmed!
              </h2>

              <p className="mt-3 text-sm leading-6 text-[#62665C]">
                Your order has been placed successfully. Keep the order
                reference below for your records.
              </p>

              <div className="mt-6 rounded-2xl border border-[#E4E2D8] bg-white p-4 text-left">
                <div className="flex items-start justify-between gap-4 border-b border-[#EEECE4] pb-3">
                  <span className="text-sm text-[#77796F]">Order ID</span>
                  <span className="max-w-[60%] break-all text-right text-sm font-bold text-[#20251F]">
                    {confirmedOrder.orderId || "Order placed"}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-4 border-b border-[#EEECE4] py-3">
                  <span className="text-sm text-[#77796F]">Order Total</span>
                  <span className="text-right text-base font-bold text-[#315C43]">
                    {formatPrice(confirmedOrder.total)}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-4 border-b border-[#EEECE4] py-3">
                  <span className="text-sm text-[#77796F]">Payment</span>
                  <span className="text-right text-sm font-semibold text-[#20251F]">
                    {confirmedOrder.paymentMethod === "COD"
                      ? "Cash on Delivery"
                      : "Online Payment"}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-4 border-b border-[#EEECE4] py-3">
                  <span className="text-sm text-[#77796F]">Order Status</span>
                  <span className="rounded-full bg-[#E7EFE6] px-3 py-1 text-xs font-bold text-[#315C43]">
                    {confirmedOrder.orderStatus}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-4 pt-3">
                  <span className="text-sm text-[#77796F]">Payment Status</span>
                  <span className="rounded-full bg-[#F8E9C9] px-3 py-1 text-xs font-bold text-[#805B19]">
                    {confirmedOrder.paymentStatus}
                  </span>
                </div>
              </div>

            {confirmedOrder.paymentMethod === "Online" && (
  <p className="mt-3 text-left text-xs leading-5 text-[#77796F]">
    Payment status: Paid.
  </p>
)}

              <button
                type="button"
                onClick={continueShopping}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#315C43] px-5 py-3.5 text-sm font-bold text-white transition hover:bg-[#254832]"
              >
                <ShoppingBag size={18} />
                Continue Shopping
              </button>

              <button
                type="button"
                onClick={() => setConfirmationOpen(false)}
                className="mt-3 w-full rounded-xl border border-[#DCD9CD] bg-white px-5 py-3 text-sm font-semibold text-[#315C43] transition hover:bg-[#E7EFE6]"
              >
                Close
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}