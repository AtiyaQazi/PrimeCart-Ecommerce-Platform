
"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  ShoppingCart,
  Store,
  Trash2,
  X,
} from "lucide-react";
import { collection, onSnapshot } from "firebase/firestore";
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
  images?: string[];
  colors?: string[];
  sizes?: string[];
};

type CartItem = Product & {
  quantity: number;
  selectedColor?: string;
  selectedSize?: string;
};

type PaymentMethod = "COD" | "Online";
type PaymentType = "Mobile Number" | "Bank Account Number";

type CustomerForm = {
  customerName: string;
  customerEmail: string;
  phone: string;
  address: string;
  paymentMethod: PaymentMethod;
  paymentType: PaymentType;
  paymentNumber: string;
};

const CART_KEY = "med-store-cart";

const formatPrice = (amount: number) =>
  new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 0,
  }).format(amount);

/* =========================================================
   PAKISTAN PHONE VALIDATION
========================================================= */

function isValidPakistanPhone(phone: string): boolean {
  const value = String(phone || "").trim();

  return /^03\d{9}$/.test(value) || /^\+923\d{9}$/.test(value);
}

function normalizePakistanPhone(phone: string): string {
  const value = String(phone || "").trim();

  if (/^03\d{9}$/.test(value)) {
    return value;
  }

  if (/^\+923\d{9}$/.test(value)) {
    return `0${value.slice(3)}`;
  }

  return value;
}

/* =========================================================
   PAKISTAN IBAN VALIDATION
========================================================= */

function normalizePakistanIban(value: string): string {
  return String(value || "")
    .replace(/[\s-]/g, "")
    .toUpperCase();
}

function ibanMod97(value: string): number {
  const rearranged = value.slice(4) + value.slice(0, 4);
  let remainder = 0;

  for (const character of rearranged) {
    const converted = /[A-Z]/.test(character)
      ? String(character.charCodeAt(0) - 55)
      : character;

    for (const digit of converted) {
      remainder = (remainder * 10 + Number(digit)) % 97;
    }
  }

  return remainder;
}

function validatePakistanIban(value: string): {
  valid: boolean;
  message: string;
} {
  const iban = normalizePakistanIban(value);

  if (!iban) {
    return {
      valid: false,
      message: "Please enter your Pakistani IBAN.",
    };
  }

  if (!iban.startsWith("PK")) {
    return {
      valid: false,
      message: "A Pakistani IBAN must start with PK.",
    };
  }

  if (iban.length !== 24) {
    return {
      valid: false,
      message:
        "Please enter a complete Pakistani IBAN containing 24 characters.",
    };
  }

  if (!/^PK\d{2}[A-Z]{4}[A-Z0-9]{16}$/.test(iban)) {
    return {
      valid: false,
      message:
        "The IBAN format is invalid. Please check the bank code and account details.",
    };
  }

  if (ibanMod97(iban) !== 1) {
    return {
      valid: false,
      message:
        "The IBAN checksum is invalid. Please check your IBAN and try again.",
    };
  }

  return { valid: true, message: "" };
}

/* =========================================================
   PRODUCT HELPERS
========================================================= */

function getProductImage(data: Record<string, unknown>): string {
  const possibleImage =
    data.image ??
    data.imageUrl ??
    data.imageURL ??
    data.photoURL ??
    data.thumbnail;

  if (
    typeof possibleImage === "string" &&
    possibleImage.trim()
  ) {
    return possibleImage.trim();
  }

  if (Array.isArray(data.images)) {
    const firstImage = data.images.find(
      (value): value is string =>
        typeof value === "string" && !!value.trim()
    );

    if (firstImage) return firstImage.trim();
  }

  return "";
}

function getStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value.filter(
    (item): item is string =>
      typeof item === "string" && !!item.trim()
  );
}

function normalizeProduct(
  id: string,
  data: Record<string, unknown>
): Product {
  // Put the primary/legacy image first, then append all additional gallery images.
  const primaryImage = getProductImage(data);
  const images = Array.from(
    new Set([primaryImage, ...getStringArray(data.images)].filter(Boolean))
  ).slice(0, 4);
  const price = Number(data.price ?? 0);
  const stock = Number(data.stock ?? 0);

  return {
    id,
    name:
      typeof data.name === "string" && data.name.trim()
        ? data.name.trim()
        : "Unnamed Product",
    category:
      typeof data.category === "string" && data.category.trim()
        ? data.category.trim()
        : "Other",
    price: Number.isFinite(price) ? Math.max(0, price) : 0,
    stock: Number.isFinite(stock)
      ? Math.floor(Math.max(0, stock))
      : 0,
    description:
      typeof data.description === "string"
        ? data.description
        : "",
    image: images[0] ?? "",
    images,
    colors: getStringArray(data.colors),
    sizes: getStringArray(data.sizes),
  };
}

function productUrl(id: string) {
  return `/store/product/${encodeURIComponent(id)}`;
}

function StockStatus({ stock }: { stock: number }) {
  if (stock <= 0) {
    return (
      <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">
        Out of Stock
      </span>
    );
  }

  if (stock <= 10) {
    return (
      <span className="inline-flex items-center rounded-full bg-[#F8E9C9] px-2.5 py-1 text-xs font-semibold text-[#805B19]">
        Low Stock · {stock} left
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full bg-[#E7EFE6] px-2.5 py-1 text-xs font-semibold text-[#315C43]">
      In Stock · {stock} available
    </span>
  );
}

/* =========================================================
   STORE PAGE
========================================================= */

export default function StorePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartLoaded, setCartLoaded] = useState(false);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [customerEmail, setCustomerEmail] = useState("");

  const [form, setForm] = useState<CustomerForm>({
    customerName: "",
    customerEmail: "",
    phone: "",
    address: "",
    paymentMethod: "COD",
    paymentType: "Mobile Number",
    paymentNumber: "",
  });

  /* =========================================================
     RESTORE CART
  ========================================================= */

  useEffect(() => {
    try {
      const saved = localStorage.getItem(CART_KEY);

      if (saved) {
        const parsed: unknown = JSON.parse(saved);

        if (Array.isArray(parsed)) {
          const validItems = parsed.filter(
            (item): item is CartItem =>
              !!item &&
              typeof item === "object" &&
              typeof item.id === "string" &&
              typeof item.name === "string" &&
              Number.isFinite(Number(item.price)) &&
              Number(item.quantity) > 0
          );

          setCart(
            validItems.map((item) => ({
              ...item,
              price: Number(item.price),
              quantity: Math.floor(Number(item.quantity)),
              stock: Math.max(0, Number(item.stock ?? 0)),
              image:
                typeof item.image === "string" ? item.image : "",
              category:
                typeof item.category === "string"
                  ? item.category
                  : "Other",
              description:
                typeof item.description === "string"
                  ? item.description
                  : "",
            }))
          );
        }
      }
    } catch (err) {
      console.error("Unable to restore shopping cart:", err);
    } finally {
      setCartLoaded(true);
    }
  }, []);

  /* =========================================================
     PERSIST CART
  ========================================================= */

  useEffect(() => {
    if (!cartLoaded) return;

    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
    } catch (err) {
      console.error("Unable to save shopping cart:", err);
    }
  }, [cart, cartLoaded]);

  /* =========================================================
     RESTORE CART / CHECKOUT FROM URL
  ========================================================= */

  useEffect(() => {
    if (!cartLoaded) return;

    const params = new URLSearchParams(window.location.search);

    if (params.get("checkout") === "1") {
      setCheckoutOpen(true);
      setCartOpen(false);
    } else if (params.get("cart") === "1") {
      setCartOpen(true);
      setCheckoutOpen(false);
    }

    if (params.has("cart") || params.has("checkout")) {
      window.history.replaceState({}, "", "/store");
    }
  }, [cartLoaded]);

  /* =========================================================
     FIREBASE AUTH PREFILL
  ========================================================= */

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      const email = user?.email ?? "";

      setCustomerEmail(email);

      setForm((current) => ({
        ...current,
        customerEmail: current.customerEmail || email,
        customerName:
          current.customerName || user?.displayName || "",
      }));
    });

    return unsubscribe;
  }, []);

  /* =========================================================
     LIVE PRODUCTS
  ========================================================= */

  useEffect(() => {
    setLoading(true);
    setError("");

    const unsubscribe = onSnapshot(
      collection(db, "products"),
      (snapshot) => {
        const rows = snapshot.docs.map((document) => {
          const data = document.data() as Record<string, unknown>;
          return normalizeProduct(document.id, data);
        });

        setProducts(
          rows.filter(
            (product) =>
              !!product.id &&
              Number.isFinite(product.price) &&
              Number.isFinite(product.stock)
          )
        );

        setLoading(false);
      },
      (err) => {
        console.error("Store products error:", err);

        setError(
          "Unable to load products. Please check your Firestore permissions and try again."
        );

        setLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  /* =========================================================
     FILTERS AND TOTALS
  ========================================================= */

  const categories = useMemo(
    () => [
      "All",
      ...Array.from(
        new Set(products.map((product) => product.category))
      ).sort(),
    ],
    [products]
  );

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();

    return products.filter((product) => {
      const matchesCategory =
        category === "All" || product.category === category;

      const matchesSearch =
        !term ||
        product.name.toLowerCase().includes(term) ||
        product.category.toLowerCase().includes(term) ||
        product.description.toLowerCase().includes(term);

      return matchesCategory && matchesSearch;
    });
  }, [products, search, category]);

  const cartCount = cart.reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  const subtotal = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  /* =========================================================
     CART ACTIONS
  ========================================================= */

  function addToCart(product: Product) {
    setNotice("");
    setError("");

    if (product.stock < 1) {
      setNotice("This product is currently out of stock.");
      return;
    }

    const existing = cart.find(
      (item) =>
        item.id === product.id &&
        !item.selectedColor &&
        !item.selectedSize
    );

    if (existing && existing.quantity >= product.stock) {
      setNotice("You have reached the available stock limit.");
      return;
    }

    setCart((current) => {
      const index = current.findIndex(
        (item) =>
          item.id === product.id &&
          !item.selectedColor &&
          !item.selectedSize
      );

      if (index !== -1) {
        return current.map((item, itemIndex) =>
          itemIndex === index
            ? {
                ...item,
                ...product,
                quantity: Math.min(
                  product.stock,
                  item.quantity + 1
                ),
              }
            : item
        );
      }

      return [...current, { ...product, quantity: 1 }];
    });

    setNotice(`${product.name} has been added to your cart.`);
  }

  function changeQuantity(
    id: string,
    change: number,
    selectedColor?: string,
    selectedSize?: string
  ) {
    setCart((current) =>
      current
        .map((item) => {
          if (
            item.id !== id ||
            item.selectedColor !== selectedColor ||
            item.selectedSize !== selectedSize
          ) {
            return item;
          }

          const latestProduct = products.find(
            (product) => product.id === id
          );

          const stock = latestProduct?.stock ?? item.stock;
          const quantity = Math.min(
            stock,
            item.quantity + change
          );

          return {
            ...item,
            ...(latestProduct ?? {}),
            stock,
            quantity,
          };
        })
        .filter((item) => item.quantity > 0)
    );
  }

  function removeFromCart(
    id: string,
    selectedColor?: string,
    selectedSize?: string
  ) {
    setCart((current) =>
      current.filter(
        (item) =>
          !(
            item.id === id &&
            item.selectedColor === selectedColor &&
            item.selectedSize === selectedSize
          )
      )
    );
  }

  function updateForm<K extends keyof CustomerForm>(
    key: K,
    value: CustomerForm[K]
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function backToShopping() {
    setCheckoutOpen(false);
    setCartOpen(false);
    setError("");
    setNotice("");

    window.setTimeout(() => {
      document.getElementById("products")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 50);
  }

  /* =========================================================
     PLACE ORDER
  ========================================================= */

  async function placeOrder(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (cart.length === 0) {
      setError("Your cart is empty.");
      return;
    }

    if (
      !form.customerName.trim() ||
      !form.customerEmail.trim() ||
      !form.phone.trim() ||
      !form.address.trim()
    ) {
      setError("Please complete all required customer details.");
      return;
    }

    // Delivery phone is always a Pakistani mobile number.
    if (!isValidPakistanPhone(form.phone)) {
      setError(
        "Please enter a valid delivery mobile number: 03001234567 or +923001234567."
      );
      return;
    }

    // Validate the payment field according to the selected type.
    let normalizedPaymentNumber = "";

    if (form.paymentMethod === "Online") {
      if (!form.paymentNumber.trim()) {
        setError(
          form.paymentType === "Bank Account Number"
            ? "Please enter your Pakistani bank IBAN."
            : "Please enter your mobile payment number."
        );
        return;
      }

      if (form.paymentType === "Mobile Number") {
        if (!isValidPakistanPhone(form.paymentNumber)) {
          setError(
            "Please enter a valid Pakistani payment number."
          );
          return;
        }

        normalizedPaymentNumber = normalizePakistanPhone(
          form.paymentNumber
        );
      } else {
        const ibanResult = validatePakistanIban(
          form.paymentNumber
        );

        if (!ibanResult.valid) {
          setError(ibanResult.message);
          return;
        }

        normalizedPaymentNumber = normalizePakistanIban(
          form.paymentNumber
        );
      }
    }

    // Check the latest product stock before submitting the order.
    for (const item of cart) {
      const latest = products.find(
        (product) => product.id === item.id
      );

      if (!latest || latest.stock < item.quantity) {
        setError(
          `The available stock for ${item.name} has changed. Please review your cart and try again.`
        );
        return;
      }
    }

    setSubmitting(true);

    try {
      const isOnline = form.paymentMethod === "Online";

      const paymentType = isOnline
        ? form.paymentType
        : "";

      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customerName: form.customerName.trim(),
          customerEmail: form.customerEmail
            .trim()
            .toLowerCase(),
          phone: normalizePakistanPhone(form.phone),
          address: form.address.trim(),

          items: cart.map((item) => ({
            productId: item.id,
            id: item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            image: item.image,
            category: item.category,
            selectedColor: item.selectedColor ?? "",
            selectedSize: item.selectedSize ?? "",
          })),

          totalAmount: subtotal,
          total: subtotal,

          // Match the product details page's API fields.
          paymentMethod: form.paymentMethod,
          paymentType,
          paymentNumber: isOnline
            ? normalizedPaymentNumber
            : "",

          payment: {
            method: isOnline ? "Online Payment" : "COD",
            paymentType,
            payerName: form.customerName.trim(),
            paymentNumber: isOnline
              ? normalizedPaymentNumber
              : "",
            amount: subtotal,
            status: "Pending",
          },

          paymentStatus: "Paid",
          status: "Processing",
          source: "store",
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          result.error ||
            result.message ||
            "Unable to place your order. Please try again."
        );
      }

      // Clear the cart only after a successful API response.
      setCart([]);
      setCheckoutOpen(false);
      setCartOpen(false);

      setForm((current) => ({
        ...current,
        phone: "",
        address: "",
        paymentNumber: "",
      }));

      setNotice(
        result.message ||
          "Your order has been submitted successfully."
      );

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "An error occurred while submitting your order."
      );
    } finally {
      setSubmitting(false);
    }
  }

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <main className="min-h-screen bg-[#F7F5EF] text-[#20251F]">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-[#E4E2D8] bg-[#F7F5EF]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/store" className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#315C43] text-white">
              <Store size={23} />
            </span>

            <span>
              <span className="block text-lg font-bold tracking-tight">
                PrimeCart
              </span>
              <span className="block text-xs text-[#77796F]">
                Everyday shopping, made simple
              </span>
            </span>
          </Link>

          <button
            type="button"
            onClick={() => {
              setError("");
              setCartOpen(true);
              setCheckoutOpen(false);
            }}
            className="relative flex items-center gap-2 rounded-xl bg-[#315C43] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#254832]"
          >
            <ShoppingCart size={19} />
            <span className="hidden sm:inline">My Cart</span>
            <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-[#E9DDBD] px-1 text-xs font-bold text-[#20251F]">
              {cartCount}
            </span>
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 pb-8 pt-8 sm:px-6 lg:px-8 lg:pt-12">
        {/* Hero */}
        <div className="overflow-hidden rounded-3xl bg-[#315C43] px-6 py-10 text-white sm:px-10 sm:py-14">
          <div className="max-w-2xl">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-[#E9DDBD]">
              Welcome to PrimeCart
            </p>

            <h1 className="text-3xl font-bold leading-tight sm:text-5xl">
              Find something
              <br />
              you will love.
            </h1>

            <p className="mt-4 max-w-lg text-sm leading-6 text-white/80 sm:text-base">
              Explore our collection and discover products
              selected for your everyday needs.
            </p>

            <a
              href="#products"
              className="mt-7 inline-flex items-center gap-2 rounded-xl bg-[#E9DDBD] px-5 py-3 text-sm font-bold text-[#20251F] transition hover:bg-white"
            >
              <ShoppingBag size={18} />
              Explore Products
            </a>
          </div>
        </div>

        {/* Notifications */}
        {notice && (
          <div className="mt-5 flex items-start gap-2 rounded-xl border border-[#C8DDCA] bg-[#EDF5EC] p-4 text-sm text-[#315C43]">
            <CheckCircle2 size={19} className="mt-0.5 shrink-0" />
            <p>{notice}</p>
            <button
              type="button"
              aria-label="Dismiss message"
              onClick={() => setNotice("")}
              className="ml-auto"
            >
              <X size={17} />
            </button>
          </div>
        )}

        {error && !cartOpen && !checkoutOpen && (
          <div className="mt-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle size={19} className="mt-0.5 shrink-0" />
            <p>{error}</p>
            <button
              type="button"
              aria-label="Dismiss error"
              onClick={() => setError("")}
              className="ml-auto"
            >
              <X size={17} />
            </button>
          </div>
        )}

        {/* Product listing */}
        <section id="products" className="scroll-mt-24 pt-10">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#66806B]">
                Our collection
              </p>

              <h2 className="mt-2 text-2xl font-bold sm:text-3xl">
                Shop Products
              </h2>

              <p className="mt-2 text-sm text-[#77796F]">
                Select a product to view its full details.
              </p>
            </div>

            <div className="relative w-full sm:max-w-sm">
              <Search
                size={19}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-[#85877C]"
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search products..."
                aria-label="Search products"
                className="w-full rounded-xl border border-[#E0DED3] bg-white py-3 pl-11 pr-4 text-sm outline-none transition focus:border-[#315C43] focus:ring-2 focus:ring-[#315C43]/10"
              />
            </div>
          </div>

          {/* Category filters */}
          <div className="mt-6 flex gap-2 overflow-x-auto pb-2">
            {categories.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setCategory(item)}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
                  category === item
                    ? "bg-[#315C43] text-white"
                    : "border border-[#E0DED3] bg-white text-[#5D6259] hover:border-[#315C43]"
                }`}
              >
                {item}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex min-h-64 items-center justify-center gap-3 text-sm text-[#77796F]">
              <Loader2 size={22} className="animate-spin" />
              Loading products...
            </div>
          ) : error && products.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
              {error}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-[#E0DED3] bg-white p-10 text-center">
              <ShoppingBag
                size={35}
                className="mx-auto text-[#85877C]"
              />
              <h3 className="mt-4 font-bold">No products found</h3>
              <p className="mt-2 text-sm text-[#77796F]">
                Try a different search or category.
              </p>
            </div>
          ) : (
            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {filteredProducts.map((product) => (
                <Link
                  key={product.id}
                  href={productUrl(product.id)}
                  aria-label={`View details for ${product.name}`}
                  className="group overflow-hidden rounded-2xl border border-[#E7E4DA] bg-white transition duration-200 hover:-translate-y-1 hover:border-[#B9CBB9] hover:shadow-lg"
                >
                  <div className="flex h-44 items-center justify-center overflow-hidden bg-[#F0EEE5] sm:h-60">
                    {product.image ? (
                      <img
                        src={product.image}
                        alt={product.name}
                        loading="lazy"
                        className="h-full w-full object-contain p-3 transition duration-300 group-hover:scale-105 sm:p-5"
                        onError={(event) => {
                          event.currentTarget.style.display = "none";
                        }}
                      />
                    ) : (
                      <ShoppingBag
                        size={42}
                        strokeWidth={1.2}
                        className="text-[#A5A79A]"
                      />
                    )}
                  </div>

                  <div className="p-3 sm:p-5">
                    <h3 className="line-clamp-2 min-h-10 text-sm font-semibold text-[#20251F] sm:text-base">
                      {product.name}
                    </h3>

                    <p className="mt-2 text-base font-bold text-[#315C43] sm:text-lg">
                      {formatPrice(product.price)}
                    </p>

                    <div className="mt-3">
                      <StockStatus stock={product.stock} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </section>

      {/* Footer */}
      <footer className="mt-12 border-t border-[#E4E2D8] bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-7 text-sm text-[#77796F] sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p className="font-semibold text-[#315C43]">PrimeCart</p>
          <p>Thank you for shopping with us.</p>
        </div>
      </footer>

      {/* Shopping cart drawer */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
          <button
            type="button"
            aria-label="Close cart"
            className="absolute inset-0 cursor-default"
            onClick={() => setCartOpen(false)}
          />

          <aside className="relative flex h-full w-full max-w-md flex-col bg-[#F7F5EF] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#E4E2D8] px-5 py-5">
              <div>
                <h2 className="text-xl font-bold">Your Cart</h2>
                <p className="mt-1 text-sm text-[#77796F]">
                  {cartCount} item(s)
                </p>
              </div>

              <button
                type="button"
                onClick={() => setCartOpen(false)}
                className="rounded-lg p-2 hover:bg-[#E9E6DC]"
                aria-label="Close cart"
              >
                <X size={21} />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              {cart.length === 0 ? (
                <div className="py-16 text-center">
                  <ShoppingCart
                    size={42}
                    className="mx-auto text-[#9B9D91]"
                  />
                  <p className="mt-4 font-semibold">
                    Your cart is empty
                  </p>
                  <p className="mt-2 text-sm text-[#77796F]">
                    Add a product to get started.
                  </p>

                  <button
                    type="button"
                    onClick={backToShopping}
                    className="mt-5 rounded-xl bg-[#315C43] px-4 py-3 text-sm font-semibold text-white hover:bg-[#254832]"
                  >
                    Continue Shopping
                  </button>
                </div>
              ) : (
                cart.map((item) => (
                  <div
                    key={`${item.id}-${item.selectedColor ?? ""}-${item.selectedSize ?? ""}`}
                    className="flex gap-3 rounded-2xl border border-[#E4E2D8] bg-white p-3"
                  >
                    <Link
                      href={productUrl(item.id)}
                      onClick={() => setCartOpen(false)}
                      className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#F0EEE5]"
                    >
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.name}
                          className="h-full w-full object-contain p-1"
                        />
                      ) : (
                        <ShoppingBag
                          size={28}
                          className="text-[#9B9D91]"
                        />
                      )}
                    </Link>

                    <div className="min-w-0 flex-1">
                      <Link
                        href={productUrl(item.id)}
                        onClick={() => setCartOpen(false)}
                        className="truncate text-sm font-bold hover:text-[#315C43]"
                      >
                        {item.name}
                      </Link>

                      {item.selectedColor && (
                        <p className="mt-1 text-xs text-[#77796F]">
                          Color: {item.selectedColor}
                        </p>
                      )}

                      {item.selectedSize && (
                        <p className="mt-1 text-xs text-[#77796F]">
                          Size: {item.selectedSize}
                        </p>
                      )}

                      <p className="mt-1 text-sm font-semibold text-[#315C43]">
                        {formatPrice(item.price)}
                      </p>

                      <div className="mt-3 flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            changeQuantity(
                              item.id,
                              -1,
                              item.selectedColor,
                              item.selectedSize
                            )
                          }
                          className="rounded-md border border-[#E0DED3] p-1"
                          aria-label="Decrease quantity"
                        >
                          <Minus size={14} />
                        </button>

                        <span className="min-w-4 text-center text-sm font-semibold">
                          {item.quantity}
                        </span>

                        <button
                          type="button"
                          disabled={item.quantity >= item.stock}
                          onClick={() =>
                            changeQuantity(
                              item.id,
                              1,
                              item.selectedColor,
                              item.selectedSize
                            )
                          }
                          className="rounded-md border border-[#E0DED3] p-1 disabled:opacity-40"
                          aria-label="Increase quantity"
                        >
                          <Plus size={14} />
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            removeFromCart(
                              item.id,
                              item.selectedColor,
                              item.selectedSize
                            )
                          }
                          className="ml-auto rounded-md p-1 text-red-600 hover:bg-red-50"
                          aria-label="Remove product"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="border-t border-[#E4E2D8] bg-white p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#77796F]">
                  Subtotal
                </span>
                <span className="text-xl font-bold">
                  {formatPrice(subtotal)}
                </span>
              </div>

              <p className="mt-2 text-xs text-[#77796F]">
                Delivery charges, if any, are confirmed during order processing.
              </p>

              <button
                type="button"
                disabled={cart.length === 0}
                onClick={() => {
                  setError("");
                  setCartOpen(false);
                  setCheckoutOpen(true);
                }}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#315C43] px-4 py-3.5 font-semibold text-white transition hover:bg-[#254832] disabled:cursor-not-allowed disabled:bg-[#B8BBAF]"
              >
                Proceed to Checkout
                <ArrowRight size={18} />
              </button>

              <button
                type="button"
                onClick={backToShopping}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-[#E0DED3] px-4 py-3 text-sm font-semibold text-[#315C43] transition hover:bg-[#F7F5EF]"
              >
                <ArrowLeft size={17} />
                Continue Shopping
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Checkout */}
      {checkoutOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/50 p-4">
          <section className="my-auto w-full max-w-xl rounded-3xl bg-[#F7F5EF] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#E4E2D8] px-6 py-5">
              <div>
                <h2 className="text-xl font-bold">Checkout</h2>
                <p className="mt-1 text-sm text-[#77796F]">
                  Review your order and enter your delivery details.
                </p>
              </div>

              <button
                type="button"
                onClick={backToShopping}
                className="rounded-lg p-2 hover:bg-[#E9E6DC]"
                aria-label="Close checkout"
              >
                <X size={21} />
              </button>
            </div>

            <form onSubmit={placeOrder} className="space-y-4 p-6">
              {error && (
                <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  <AlertCircle size={18} className="mt-0.5 shrink-0" />
                  <p>{error}</p>
                </div>
              )}

              {/* Order summary */}
              <div className="rounded-xl border border-[#E4E2D8] bg-white p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="font-bold">Order Summary</h3>
                  <button
                    type="button"
                    onClick={backToShopping}
                    className="inline-flex items-center gap-1 text-sm font-semibold text-[#315C43] hover:underline"
                  >
                    <ArrowLeft size={15} />
                    Add More Products
                  </button>
                </div>

                <div className="max-h-36 space-y-2 overflow-y-auto">
                  {cart.map((item) => (
                    <div
                      key={`${item.id}-${item.selectedColor ?? ""}-${item.selectedSize ?? ""}`}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="min-w-0 truncate text-[#62665C]">
                        {item.name}
                        {item.selectedColor
                          ? ` · ${item.selectedColor}`
                          : ""}
                        {item.selectedSize
                          ? ` · ${item.selectedSize}`
                          : ""}{" "}
                        × {item.quantity}
                      </span>

                      <span className="shrink-0 font-semibold">
                        {formatPrice(item.price * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-[#E4E2D8] pt-3">
                  <span className="text-sm text-[#62665C]">
                    Subtotal
                  </span>
                  <span className="text-lg font-bold text-[#315C43]">
                    {formatPrice(subtotal)}
                  </span>
                </div>
              </div>

              {/* Customer details */}
              <div>
                <label className="mb-1.5 block text-sm font-semibold">
                  Full Name
                </label>
                <input
                  required
                  autoComplete="name"
                  value={form.customerName}
                  onChange={(event) =>
                    updateForm("customerName", event.target.value)
                  }
                  className="w-full rounded-xl border border-[#E0DED3] bg-white px-4 py-3 text-sm outline-none focus:border-[#315C43]"
                  placeholder="Enter your full name"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold">
                  Email Address
                </label>
                <input
                  required
                  type="email"
                  autoComplete="email"
                  value={form.customerEmail}
                  onChange={(event) =>
                    updateForm("customerEmail", event.target.value)
                  }
                  className="w-full rounded-xl border border-[#E0DED3] bg-white px-4 py-3 text-sm outline-none focus:border-[#315C43]"
                  placeholder="you@example.com"
                />

                {customerEmail && (
                  <p className="mt-1 text-xs text-[#77796F]">
                    Your signed-in account email is available to use.
                  </p>
                )}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold">
                  Delivery Phone Number
                </label>
                <input
                  required
                  type="tel"
                  autoComplete="tel"
                  value={form.phone}
                  onChange={(event) =>
                    updateForm("phone", event.target.value)
                  }
                  className="w-full rounded-xl border border-[#E0DED3] bg-white px-4 py-3 text-sm outline-none focus:border-[#315C43]"
                  placeholder="03001234567 or +923001234567"
                />
                <p className="mt-1 text-xs text-[#77796F]">
                  Enter your Pakistani mobile number.
                </p>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold">
                  Delivery Address
                </label>
                <textarea
                  required
                  rows={3}
                  autoComplete="street-address"
                  value={form.address}
                  onChange={(event) =>
                    updateForm("address", event.target.value)
                  }
                  className="w-full resize-y rounded-xl border border-[#E0DED3] bg-white px-4 py-3 text-sm outline-none focus:border-[#315C43]"
                  placeholder="Enter your house, street, and city"
                />
              </div>

              {/* Payment method */}
              <div>
                <label className="mb-2 block text-sm font-semibold">
                  Payment Method
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      updateForm("paymentMethod", "COD");
                      setError("");
                    }}
                    className={`rounded-xl border p-3 text-sm font-semibold transition ${
                      form.paymentMethod === "COD"
                        ? "border-[#315C43] bg-[#E7EFE6] text-[#315C43]"
                        : "border-[#E0DED3] bg-white hover:border-[#315C43]"
                    }`}
                  >
                    Cash on Delivery
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      updateForm("paymentMethod", "Online");
                      setError("");
                    }}
                    className={`rounded-xl border p-3 text-sm font-semibold transition ${
                      form.paymentMethod === "Online"
                        ? "border-[#315C43] bg-[#E7EFE6] text-[#315C43]"
                        : "border-[#E0DED3] bg-white hover:border-[#315C43]"
                    }`}
                  >
                    Online Payment
                  </button>
                </div>
              </div>

              {/* Online payment options */}
              {form.paymentMethod === "Online" && (
                <div className="space-y-4 rounded-xl border border-[#D8E3D5] bg-white p-4">
                  <div>
                    <label className="mb-2 block text-sm font-semibold">
                      Payment Type
                    </label>

                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          updateForm("paymentType", "Mobile Number");
                          updateForm("paymentNumber", "");
                          setError("");
                        }}
                        className={`rounded-xl border p-3 text-sm font-semibold transition ${
                          form.paymentType === "Mobile Number"
                            ? "border-[#315C43] bg-[#E7EFE6] text-[#315C43]"
                            : "border-[#E0DED3] bg-white hover:border-[#315C43]"
                        }`}
                      >
                        Mobile Number
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          updateForm(
                            "paymentType",
                            "Bank Account Number"
                          );
                          updateForm("paymentNumber", "");
                          setError("");
                        }}
                        className={`rounded-xl border p-3 text-sm font-semibold transition ${
                          form.paymentType === "Bank Account Number"
                            ? "border-[#315C43] bg-[#E7EFE6] text-[#315C43]"
                            : "border-[#E0DED3] bg-white hover:border-[#315C43]"
                        }`}
                      >
                        Bank Account Number
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-semibold">
                      {form.paymentType === "Mobile Number"
                        ? "Mobile Payment Number"
                        : "Bank IBAN"}
                    </label>

                    <input
                      required={form.paymentMethod === "Online"}
                      type="text"
                      autoComplete="off"
                      value={form.paymentNumber}
                      onChange={(event) =>
                        updateForm(
                          "paymentNumber",
                          event.target.value
                        )
                      }
                      className="w-full rounded-xl border border-[#E0DED3] bg-white px-4 py-3 text-sm uppercase outline-none transition focus:border-[#315C43] focus:ring-2 focus:ring-[#315C43]/10"
                      placeholder={
                        form.paymentType === "Mobile Number"
                          ? "03001234567 or +923001234567"
                          : "PK36SCBL0000001123456702"
                      }
                    />

                    <p className="mt-2 text-xs leading-5 text-[#77796F]">
                      {form.paymentType === "Mobile Number"
                        ? "Enter the Pakistani mobile number linked to your payment account."
                        : "Enter your complete 24-character Pakistani IBAN. Spaces are allowed."}
                    </p>
                  </div>

                  <div className="rounded-lg bg-[#F7F5EF] p-3 text-xs leading-5 text-[#62665C]">
                    <p className="font-semibold text-[#315C43]">
                      Payment information
                    </p>
                    <p className="mt-1">
                      Your selected payment type and number will be saved
                      with your order.
                    </p>
                  </div>
                </div>
              )}

              {/* Order total */}
              <div className="rounded-xl bg-[#EAE8DE] p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#62665C]">
                    Order Total
                  </span>
                  <span className="text-xl font-bold">
                    {formatPrice(subtotal)}
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting || cart.length === 0}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#315C43] px-4 py-3.5 font-semibold text-white transition hover:bg-[#254832] disabled:cursor-not-allowed disabled:bg-[#B8BBAF]"
              >
                {submitting ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Submitting Order...
                  </>
                ) : (
                  <>
                    <ShoppingBag size={18} />
                    Place Order
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={submitting}
                onClick={backToShopping}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#D8D7CC] bg-white px-4 py-3 text-sm font-semibold text-[#315C43] transition hover:bg-[#EAE8DE] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ArrowLeft size={18} />
                Back to Shopping
              </button>

              <p className="text-center text-xs text-[#77796F]">
                Your cart and entered checkout details will be kept
                when you return to shopping.
              </p>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}