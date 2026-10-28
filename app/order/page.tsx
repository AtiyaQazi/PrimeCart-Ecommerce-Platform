"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronLeft,
  CreditCard,
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
import {
  collection,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  description: string;
  image?: string;
}

interface CartItem {
  product: Product;
  quantity: number;
}

type ViewMode =
  | "catalog"
  | "details"
  | "cart"
  | "checkout"
  | "success";

type PaymentMethod = "COD" | "Online Payment";

const LOCAL_PRODUCT_IMAGES: Record<string, string> = {
  "analog wrist watch": "/products/analog-wrist-watch.jpeg",
  "artificial plant": "/products/artificial-plant.jpeg",
  "bluetooth speaker": "/products/bluetooth-speaker.jpeg",
  "canvas backpack": "/products/canvas-backpack.jpeg",
  "casual polo shirt": "/products/casual-polo-shirt.jpeg",
  "ceramic coffee mug": "/products/ceramic-coffee-mug.jpeg",
  chain: "/products/chain.jpeg",
  "classic cotton t-shirt": "/products/classic-cotton-t-shirt.jpeg",
  "classic sunglasses": "/products/classic-sunglasses.jpeg",
  "cotton hoodie": "/products/cotton-hoodie.jpeg",
  "cushion cover set": "/products/cushion-cover-set.jpeg",
  "decorative mirror": "/products/decorative-mirror.jpeg",
  "decorative vase": "/products/decorative-vase.jpeg",
  "denim jeans": "/products/denim-jeans.jpeg",
  "desk calendar": "/products/desk-calendar.jpeg",
  "face mask": "/products/face-mask.jpeg",
  "fashion handbag": "/products/fashion-handbag.jpeg",
  "formal shirt": "/products/formal-shirt.jpeg",
  "gentle face cleanser": "/products/gentle-face-cleanser.jpeg",
  "gift box": "/products/gift-box.jpeg",
  "glass water bottle": "/products/glass-water-bottle.jpeg",
  "hair clip set": "/products/hair-clip-set.jpeg",
  "hair conditioner": "/products/hair-conditioner.jpeg",
  "hair serum": "/products/hair-serum.jpeg",
  "hooded sweatshirt": "/products/hooded-sweatshirt.jpeg",
  "hydrating face cream": "/products/hydrating-face-cream.jpeg",
  "keychain set": "/products/keychain-set.jpeg",
  "laptop sleeve": "/products/laptop-sleeve.jpeg",
  "laundry basket": "/products/laundry-basket.jpeg",
  "leather wallet": "/products/leather-wallet.jpeg",
  "linen trousers": "/products/linen-trousers.jpeg",
  "lip balm": "/products/lip-balm.jpeg",
  "lunch box": "/products/lunch-box.jpg",
  "makeup brush set": "/products/makeup-brush-set.jpg",
  "mechanical keyboard": "/products/mechanical-keyboard.jpeg",
  "notebook set": "/products/notebook-set.jpeg",
  "pearl drop earrings": "/products/pearl-drop-earrings.jpeg",
  "perfume mist": "/products/perfume-mist.jpeg",
  "photo frame": "/products/photo-frame.jpeg",
  "portable mini fan": "/products/portable-mini-fan.jpg",
  "power bank": "/products/power-bank.jpeg",
  "reusable shopping bag": "/products/reusable-shopping-bag.jpeg",
  ring: "/products/ring.jpeg",
  "rose face toner": "/products/rose-face-toner.jpg",
  "scented candle": "/products/scented-candle.jpeg",
  shawl: "/products/shawl.jpg",
  "smart led bulb": "/products/smart-led-bulb.jpeg",
  "smart watch": "/products/smart-watch.jpeg",
  "sports tracksuit": "/products/sports-tracksuit.jpeg",
  "stationery set": "/products/stationery-set.jpeg",
  "summer dress": "/products/summer-dress.jpeg",
  "tablet stand": "/products/tablet-stand.jpeg",
  "travel mug": "/products/travel-mug.jpeg",
  "travel organizer": "/products/travel-organizer.jpeg",
  "travel pillow": "/products/travel-pillow.jpeg",
  "travel pouch": "/products/travel-pouch.jpeg",
  "usb c charger": "/products/usb-c-charger.jpg",
  "usb flash drive": "/products/usb-flash-drive.jpeg",
  "vitamin c serum": "/products/vitamin-c-serum.jpeg",
  "wall clock": "/products/wall-clock.jpeg",
  "wall hanging shelf": "/products/wall-hanging-shelf.jpg",
  "winter jacket": "/products/winter-jacket.jpeg",
  "wireless headphones": "/products/wireless-headphones.jpeg",
  "wireless mouse": "/products/wireless-mouse.jpeg",
};

function normalizeProductName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function getProductImage(name: string) {
  return LOCAL_PRODUCT_IMAGES[normalizeProductName(name)] || "";
}

function formatPrice(price: number) {
  return `Rs. ${Math.round(price || 0).toLocaleString("en-PK")}`;
}

function ProductImage({
  src,
  alt,
  className = "",
}: {
  src?: string;
  alt: string;
  className?: string;
}) {
  const [imageError, setImageError] = useState(false);

  if (!src || imageError) {
    return (
      <div
        className={`flex items-center justify-center bg-[#F1EEE7] ${className}`}
      >
        <ShoppingBag className="h-10 w-10 text-[#8A8D89]" />
      </div>
    );
  }

  return (
    <div
      className={`flex items-center justify-center overflow-hidden bg-[#F1EEE7] ${className}`}
    >
      <img
        src={src}
        alt={alt}
        onError={() => setImageError(true)}
        className="block max-h-full max-w-full object-contain"
      />
    </div>
  );
}

function StockBadge({
  stock,
}: {
  stock: number;
}) {
  if (stock <= 0) {
    return (
      <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-600">
        Out of Stock
      </span>
    );
  }

  if (stock <= 10) {
    return (
      <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-600">
        Only {stock} left
      </span>
    );
  }

  return (
    <span className="rounded-full bg-[#E6F3EC] px-3 py-1 text-xs font-semibold text-[#286044]">
      In Stock
    </span>
  );
}

export default function OrderPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  const [selectedProduct, setSelectedProduct] =
    useState<Product | null>(null);

  const [viewMode, setViewMode] =
    useState<ViewMode>("catalog");

  const [quantity, setQuantity] = useState(1);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [checkoutItems, setCheckoutItems] =
    useState<CartItem[]>([]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");

  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>("COD");

  // Online payment fields
  const [payerName, setPayerName] = useState("");
  const [paymentNumber, setPaymentNumber] =
    useState("");
  const [paymentReference, setPaymentReference] =
    useState("");

  const [submitting, setSubmitting] =
    useState(false);
  const [orderError, setOrderError] = useState("");

  const [completedOrderTotal, setCompletedOrderTotal] =
    useState(0);

  const [
    completedPaymentMethod,
    setCompletedPaymentMethod,
  ] = useState("");

  const [completedPayerName, setCompletedPayerName] =
    useState("");

  const [
    completedPaymentNumber,
    setCompletedPaymentNumber,
  ] = useState("");

  const [
    completedPaymentReference,
    setCompletedPaymentReference,
  ] = useState("");

  const [
    completedPaymentStatus,
    setCompletedPaymentStatus,
  ] = useState("");

  useEffect(() => {
    setLoading(true);
    setLoadError("");

    const productsQuery = query(
      collection(db, "products"),
      orderBy("name", "asc")
    );

    const unsubscribe = onSnapshot(
      productsQuery,
      (snapshot) => {
        const loadedProducts: Product[] =
          snapshot.docs.map((item) => {
            const data = item.data();

            const nameValue =
              typeof data.name === "string"
                ? data.name
                : "Unnamed Product";

            const firestoreImage =
              typeof data.image === "string"
                ? data.image
                : "";

            const localImage =
              getProductImage(nameValue);

            return {
              id: item.id,
              name: nameValue,
              category:
                typeof data.category === "string"
                  ? data.category
                  : "General",
              price:
                typeof data.price === "number"
                  ? data.price
                  : Number(data.price) || 0,
              stock:
                typeof data.stock === "number"
                  ? data.stock
                  : Number(data.stock) || 0,
              description:
                typeof data.description === "string"
                  ? data.description
                  : "",
              image:
                localImage || firestoreImage,
            };
          });

        setProducts(loadedProducts);
        setLoading(false);
      },
      (error) => {
        console.error(
          "Products loading error:",
          error
        );

        setLoadError(
          "Unable to load products. Please try again."
        );

        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    setCart((currentCart) =>
      currentCart
        .map((item) => {
          const latestProduct = products.find(
            (product) =>
              product.id === item.product.id
          );

          if (
            !latestProduct ||
            latestProduct.stock <= 0
          ) {
            return null;
          }

          return {
            product: latestProduct,
            quantity: Math.min(
              item.quantity,
              latestProduct.stock
            ),
          };
        })
        .filter(
          (item): item is CartItem =>
            item !== null
        )
    );

    setCheckoutItems((currentItems) =>
      currentItems
        .map((item) => {
          const latestProduct = products.find(
            (product) =>
              product.id === item.product.id
          );

          if (
            !latestProduct ||
            latestProduct.stock <= 0
          ) {
            return null;
          }

          return {
            product: latestProduct,
            quantity: Math.min(
              item.quantity,
              latestProduct.stock
            ),
          };
        })
        .filter(
          (item): item is CartItem =>
            item !== null
        )
    );
  }, [products]);

  const categories = useMemo(() => {
    const uniqueCategories = Array.from(
      new Set(
        products
          .map((product) => product.category)
          .filter(Boolean)
      )
    );

    return ["All", ...uniqueCategories];
  }, [products]);

  const filteredProducts = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return products.filter((product) => {
      const matchesSearch =
        !search ||
        product.name.toLowerCase().includes(search) ||
        product.category.toLowerCase().includes(search) ||
        product.description.toLowerCase().includes(search);

      const matchesCategory =
        selectedCategory === "All" ||
        product.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [
    products,
    searchTerm,
    selectedCategory,
  ]);

  const cartTotal = useMemo(() => {
    return cart.reduce(
      (sum, item) =>
        sum +
        Math.round(item.product.price || 0) *
          item.quantity,
      0
    );
  }, [cart]);

  const checkoutTotal = useMemo(() => {
    return checkoutItems.reduce(
      (sum, item) =>
        sum +
        Math.round(item.product.price || 0) *
          item.quantity,
      0
    );
  }, [checkoutItems]);

  const cartItemCount = useMemo(() => {
    return cart.reduce(
      (sum, item) => sum + item.quantity,
      0
    );
  }, [cart]);

  function openProduct(product: Product) {
    setSelectedProduct(product);
    setQuantity(1);
    setOrderError("");
    setViewMode("details");
  }

  function closeProduct() {
    setSelectedProduct(null);
    setQuantity(1);
    setOrderError("");
    setViewMode("catalog");
  }

  function addToCart(
    product: Product,
    amount = 1
  ) {
    if (product.stock <= 0) return;

    setCart((currentCart) => {
      const existing = currentCart.find(
        (item) =>
          item.product.id === product.id
      );

      if (existing) {
        return currentCart.map((item) =>
          item.product.id === product.id
            ? {
                ...item,
                product,
                quantity: Math.min(
                  item.quantity + amount,
                  product.stock
                ),
              }
            : item
        );
      }

      return [
        ...currentCart,
        {
          product,
          quantity: Math.min(
            amount,
            product.stock
          ),
        },
      ];
    });
  }

  function removeFromCart(productId: string) {
    setCart((currentCart) =>
      currentCart.filter(
        (item) =>
          item.product.id !== productId
      )
    );
  }

  function changeCartQuantity(
    productId: string,
    change: number
  ) {
    setCart((currentCart) =>
      currentCart
        .map((item) => {
          if (
            item.product.id !== productId
          ) {
            return item;
          }

          const newQuantity = Math.max(
            1,
            Math.min(
              item.quantity + change,
              item.product.stock
            )
          );

          return {
            ...item,
            quantity: newQuantity,
          };
        })
        .filter(
          (item) => item.product.stock > 0
        )
    );
  }

  function resetPaymentFields() {
    setPaymentMethod("COD");
    setPayerName("");
    setPaymentNumber("");
    setPaymentReference("");
  }

  function orderNow() {
    if (!selectedProduct) return;

    if (selectedProduct.stock <= 0) {
      setOrderError(
        "This product is currently out of stock."
      );
      return;
    }

    const safeQuantity = Math.min(
      Math.max(1, quantity),
      selectedProduct.stock
    );

    setCheckoutItems([
      {
        product: selectedProduct,
        quantity: safeQuantity,
      },
    ]);

    setQuantity(safeQuantity);
    setOrderError("");
    resetPaymentFields();
    setViewMode("checkout");
  }

  function checkoutFromCart() {
    if (cart.length === 0) return;

    const validItems = cart
      .filter(
        (item) => item.product.stock > 0
      )
      .map((item) => ({
        ...item,
        quantity: Math.min(
          item.quantity,
          item.product.stock
        ),
      }));

    if (validItems.length === 0) {
      setOrderError(
        "All products in your cart are out of stock."
      );
      return;
    }

    setCheckoutItems(validItems);
    setOrderError("");
    resetPaymentFields();
    setViewMode("checkout");
  }

  function backToDetails() {
    if (!selectedProduct) {
      setViewMode("catalog");
      return;
    }

    const checkoutIsSingleProduct =
      checkoutItems.length === 1 &&
      checkoutItems[0].product.id ===
        selectedProduct.id;

    if (checkoutIsSingleProduct) {
      setQuantity(
        checkoutItems[0].quantity
      );
      setViewMode("details");
      return;
    }

    setViewMode("cart");
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setOrderError("");

    if (checkoutItems.length === 0) {
      setOrderError("Your order is empty.");
      return;
    }

    for (const item of checkoutItems) {
      if (item.product.stock <= 0) {
        setOrderError(
          `${item.product.name} is out of stock.`
        );
        return;
      }

      if (
        item.quantity >
        item.product.stock
      ) {
        setOrderError(
          `Only ${item.product.stock} units of ${item.product.name} are available.`
        );
        return;
      }

      if (
        !Number.isInteger(item.quantity) ||
        item.quantity < 1
      ) {
        setOrderError(
          `Invalid quantity for ${item.product.name}.`
        );
        return;
      }
    }

    if (!name.trim()) {
      setOrderError(
        "Please enter your full name."
      );
      return;
    }

    if (!email.trim()) {
      setOrderError(
        "Please enter your email."
      );
      return;
    }

    if (!phone.trim()) {
      setOrderError(
        "Please enter your phone number."
      );
      return;
    }

    if (!city.trim()) {
      setOrderError(
        "Please enter your city."
      );
      return;
    }

    if (!address.trim()) {
      setOrderError(
        "Please enter your delivery address."
      );
      return;
    }

 if (paymentMethod === "Online Payment") {
  if (!payerName.trim()) {
    setOrderError(
      "Please enter the payer name."
    );
    return;
  }

  if (!paymentNumber.trim()) {
    setOrderError(
      "Please enter the payment number."
    );
    return;
  }

  // Transaction / Reference ID is optional.
  // Do not validate it here.
}

    setSubmitting(true);

    try {
      const total =
        checkoutItems.reduce(
          (sum, item) =>
            sum +
            Math.round(
              item.product.price || 0
            ) * item.quantity,
          0
        );

      const paymentStatus = "Pending";

      const requestBody = {
        items: checkoutItems.map(
          (item) => ({
            productId: item.product.id,
            productName:
              item.product.name,
            quantity: item.quantity,
            price: Math.round(
              item.product.price || 0
            ),
            image:
              item.product.image || "",
          })
        ),

        customerName: name.trim(),

        customerEmail:
          email.trim().toLowerCase(),

        customerPhone: phone.trim(),

        deliveryAddress: address.trim(),

        city: city.trim(),

        total: Math.round(total),

        paymentMethod,

        paymentStatus,

        payment:
          paymentMethod ===
          "Online Payment"
            ? {
                method: "Online Payment",

                payerName:
                  payerName.trim(),

                paymentNumber:
                  paymentNumber.trim(),

                amount:
                  Math.round(total),

                reference:
                  paymentReference.trim(),

                status: "Pending",
              }
            : {
                method:
                  "Cash on Delivery",

                payerName: "",

                paymentNumber: "",

                amount: 0,

                reference: "",

                status: "Pending",
              },
      };

      console.log(
        "Submitting order:",
        requestBody
      );

      const response = await fetch(
        "/api/orders",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify(
            requestBody
          ),
        }
      );

      const data =
        await response.json();

      console.log(
        "Order API response:",
        data
      );

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Unable to place the order."
        );
      }

      setCompletedOrderTotal(
        Math.round(total)
      );

      setCompletedPaymentMethod(
        paymentMethod
      );

      setCompletedPayerName(
        paymentMethod ===
          "Online Payment"
          ? payerName.trim()
          : ""
      );

      setCompletedPaymentNumber(
        paymentMethod ===
          "Online Payment"
          ? paymentNumber.trim()
          : ""
      );

      setCompletedPaymentReference(
        paymentMethod ===
          "Online Payment"
          ? paymentReference.trim()
          : ""
      );

      setCompletedPaymentStatus(
        paymentStatus
      );

      setCart((currentCart) =>
        currentCart
          .map((cartItem) => {
            const orderedItem =
              checkoutItems.find(
                (item) =>
                  item.product.id ===
                  cartItem.product.id
              );

            if (!orderedItem) {
              return cartItem;
            }

            const remaining =
              cartItem.quantity -
              orderedItem.quantity;

            if (remaining <= 0) {
              return null;
            }

            return {
              ...cartItem,
              quantity: remaining,
            };
          })
          .filter(
            (
              item
            ): item is CartItem =>
              item !== null
          )
      );

      setViewMode("success");
    } catch (error) {
      console.error(
        "Order submission error:",
        error
      );

      setOrderError(
        error instanceof Error
          ? error.message
          : "Unable to place your order. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  function resetAfterSuccess() {
    setSelectedProduct(null);
    setCheckoutItems([]);
    setQuantity(1);

    setName("");
    setEmail("");
    setPhone("");
    setCity("");
    setAddress("");

    setPaymentMethod("COD");
    setPayerName("");
    setPaymentNumber("");
    setPaymentReference("");

    setCompletedOrderTotal(0);
    setCompletedPaymentMethod("");
    setCompletedPayerName("");
    setCompletedPaymentNumber("");
    setCompletedPaymentReference("");
    setCompletedPaymentStatus("");

    setOrderError("");
    setViewMode("catalog");
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#F4EBDD]">
      {/* HEADER */}
      <header className="bg-[#173F35] text-white shadow-sm">
        <div className="mx-auto flex max-w-7xl min-w-0 items-center gap-2 px-3 py-3 sm:gap-4 sm:px-6 sm:py-4 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#E7EFEA] text-[#173F35] sm:h-11 sm:w-11">
              <Store className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>

            <div className="min-w-0">
              <h1 className="truncate text-base font-bold leading-tight sm:text-lg">
                PrimeCart
              </h1>

              <p className="text-xs text-white/55">
                Store
              </p>
            </div>
          </div>

          <div className="ml-auto hidden min-w-0 text-right sm:block">
            <p className="text-sm font-semibold text-white">
              Welcome to Our Store
            </p>

            <p className="text-xs text-white/55">
              Find what you need, order with ease
            </p>
          </div>

          <button
            type="button"
            onClick={() => setViewMode("cart")}
            className="relative ml-auto flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white/10 transition hover:bg-white/15 sm:ml-2 sm:h-11 sm:w-11"
            aria-label="Shopping cart"
          >
            <ShoppingCart className="h-5 w-5" />

            {cartItemCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#E6F3EC] px-1 text-[10px] font-bold text-[#173F35]">
                {cartItemCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* CATALOG */}
      {viewMode === "catalog" && (
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="mb-6 flex flex-col gap-4 rounded-2xl bg-white p-4 shadow-sm sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#8A8D89]" />

              <input
                type="text"
                value={searchTerm}
                onChange={(event) =>
                  setSearchTerm(event.target.value)
                }
                placeholder="Search products..."
                className="h-12 w-full rounded-xl border border-[#D8D4CB] bg-[#FBF9F5] pl-12 pr-4 text-sm text-[#111111] outline-none transition placeholder:text-[#8A8D89] focus:border-[#355E4B] focus:ring-2 focus:ring-[#355E4B]/10"
              />
            </div>

            <div className="sm:w-56">
              <select
                value={selectedCategory}
                onChange={(event) =>
                  setSelectedCategory(event.target.value)
                }
                className="h-12 w-full rounded-xl border border-[#D8D4CB] bg-[#FBF9F5] px-4 text-sm text-[#111111] outline-none focus:border-[#355E4B]"
              >
                {categories.map((category) => (
                  <option
                    key={category}
                    value={category}
                  >
                    {category}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loadError && (
            <div className="mb-6 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
              {loadError}
            </div>
          )}

          {loading ? (
            <div className="flex min-h-[400px] items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-[#355E4B]" />
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="rounded-2xl bg-white px-6 py-20 text-center shadow-sm">
              <ShoppingBag className="mx-auto mb-4 h-12 w-12 text-[#6C746D]" />

              <h2 className="text-lg font-semibold text-[#222222]">
                No products found
              </h2>

              <p className="mt-1 text-sm text-[#777C77]">
                Try another search or category.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {filteredProducts.map((product) => (
                <div
                  key={product.id}
                  className="overflow-hidden rounded-2xl border border-[#ECE7DE] bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <button
                    type="button"
                    onClick={() =>
                      openProduct(product)
                    }
                    className="block w-full text-left"
                  >
                    <ProductImage
                      src={product.image}
                      alt={product.name}
                      className="h-40 w-full sm:h-56"
                    />

                    <div className="p-4">
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <span className="rounded-full bg-[#E8F2EC] px-2.5 py-1 text-[10px] font-semibold text-[#52705F]">
                          {product.category}
                        </span>

                        <StockBadge
                          stock={product.stock}
                        />
                      </div>

                      <h2 className="line-clamp-2 min-h-[42px] text-sm font-semibold text-[#222222] sm:text-base">
                        {product.name}
                      </h2>

                      <p className="mt-2 text-lg font-bold text-[#173F35]">
                        {formatPrice(
                          product.price
                        )}
                      </p>
                    </div>
                  </button>

                  <div className="grid grid-cols-2 gap-2 px-4 pb-4">
                    <button
                      type="button"
                      onClick={() =>
                        openProduct(product)
                      }
                      className="rounded-xl border border-[#D8D4CB] px-3 py-2.5 text-xs font-semibold text-[#355E4B] transition hover:bg-[#FCFAF6]"
                    >
                      View Details
                    </button>

                    <button
                      type="button"
                      disabled={product.stock <= 0}
                      onClick={() =>
                        addToCart(product)
                      }
                      className="rounded-xl bg-[#355E4B] px-3 py-2.5 text-xs font-semibold text-white transition hover:bg-[#173F35] disabled:cursor-not-allowed disabled:bg-[#D8D4CB]"
                    >
                      Add to Cart
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      )}

      {/* PRODUCT DETAILS */}
      {viewMode === "details" &&
        selectedProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#173F35]/55 p-2 sm:p-6">
            <div className="relative my-2 max-h-[96vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white shadow-2xl sm:my-0 sm:rounded-3xl">
              <button
                type="button"
                onClick={closeProduct}
                className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-[#555C56] shadow-sm transition hover:bg-[#F4EBDD]"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="grid md:grid-cols-2">
                <ProductImage
                  src={selectedProduct.image}
                  alt={selectedProduct.name}
                  className="h-56 w-full rounded-t-2xl sm:h-72 md:h-full md:min-h-[520px] md:rounded-l-3xl md:rounded-tr-none"
                />

                <div className="p-4 sm:p-8">
                  <span className="rounded-full bg-[#E8F2EC] px-3 py-1.5 text-xs font-semibold text-[#52705F]">
                    {selectedProduct.category}
                  </span>

                  <h2 className="mt-4 text-2xl font-bold text-[#173F35] sm:text-3xl">
                    {selectedProduct.name}
                  </h2>

                  <p className="mt-4 text-2xl font-bold text-[#355E4B]">
                    {formatPrice(
                      selectedProduct.price
                    )}
                  </p>

                  <div className="mt-4">
                    <StockBadge
                      stock={selectedProduct.stock}
                    />
                  </div>

                  <div className="mt-6 border-t border-[#ECE7DE] pt-6">
                    <h3 className="text-sm font-semibold text-[#222222]">
                      Product Description
                    </h3>

                    <p className="mt-2 text-sm leading-6 text-[#6B706C]">
                      {selectedProduct.description ||
                        "No description available for this product."}
                    </p>
                  </div>

                  {selectedProduct.stock > 0 && (
                    <>
                      <div className="mt-6 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <span className="text-sm font-semibold text-[#555C56]">
                          Quantity
                        </span>

                        <div className="flex items-center rounded-xl border border-[#D8D4CB]">
                          <button
                            type="button"
                            onClick={() =>
                              setQuantity(
                                (current) =>
                                  Math.max(
                                    1,
                                    current - 1
                                  )
                              )
                            }
                            className="flex h-10 w-10 items-center justify-center text-[#355E4B] hover:bg-[#FCFAF6]"
                          >
                            <Minus className="h-4 w-4" />
                          </button>

                          <span className="flex h-10 w-10 items-center justify-center border-x border-[#D8D4CB] text-sm font-semibold text-[#222222]">
                            {quantity}
                          </span>

                          <button
                            type="button"
                            onClick={() =>
                              setQuantity(
                                (current) =>
                                  Math.min(
                                    selectedProduct.stock,
                                    current + 1
                                  )
                              )
                            }
                            className="flex h-10 w-10 items-center justify-center text-[#355E4B] hover:bg-[#FCFAF6]"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      <div className="mt-5 rounded-xl bg-[#FBF9F5] p-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-[#6B706C]">
                            Total
                          </span>

                          <span className="text-lg font-bold text-[#173F35]">
                            {formatPrice(
                              Math.round(
                                selectedProduct.price
                              ) * quantity
                            )}
                          </span>
                        </div>
                      </div>

                      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <button
                          type="button"
                          onClick={() =>
                            addToCart(
                              selectedProduct,
                              quantity
                            )
                          }
                          className="flex items-center justify-center gap-2 rounded-xl border border-[#355E4B] px-4 py-3 text-sm font-semibold text-[#355E4B] transition hover:bg-[#E8F2EC]"
                        >
                          <ShoppingCart className="h-4 w-4" />
                          Add to Cart
                        </button>

                        <button
                          type="button"
                          onClick={orderNow}
                          className="rounded-xl bg-[#355E4B] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#173F35]"
                        >
                          Order Now
                        </button>
                      </div>
                    </>
                  )}

                  {orderError && (
                    <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
                      {orderError}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

      {/* CART */}
      {viewMode === "cart" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#173F35]/55 p-2 sm:p-6">
          <div className="relative my-2 max-h-[96vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl sm:my-0 sm:rounded-3xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#ECE7DE] bg-white px-5 py-4 sm:px-7">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E8F2EC] text-[#355E4B]">
                  <ShoppingCart className="h-5 w-5" />
                </div>

                <div>
                  <h2 className="text-lg font-bold text-[#173F35]">
                    Your Cart
                  </h2>

                  <p className="text-xs text-[#777C77]">
                    {cartItemCount}{" "}
                    {cartItemCount === 1
                      ? "item"
                      : "items"}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setViewMode("catalog")
                }
                className="flex h-10 w-10 items-center justify-center rounded-full text-[#555C56] hover:bg-[#F4EBDD]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 sm:p-7">
              {cart.length === 0 ? (
                <div className="py-16 text-center">
                  <ShoppingCart className="mx-auto mb-4 h-14 w-14 text-[#8A8D89]" />

                  <h3 className="text-lg font-semibold text-[#222222]">
                    Your cart is empty
                  </h3>

                  <p className="mt-1 text-sm text-[#777C77]">
                    Add some products to your cart.
                  </p>

                  <button
                    type="button"
                    onClick={() =>
                      setViewMode("catalog")
                    }
                    className="mt-6 rounded-xl bg-[#355E4B] px-5 py-3 text-sm font-semibold text-white hover:bg-[#173F35]"
                  >
                    Continue Shopping
                  </button>
                </div>
              ) : (
                <>
                  <div className="space-y-4">
                    {cart.map((item) => (
                      <div
                        key={item.product.id}
                        className="flex flex-col gap-3 rounded-2xl border border-[#ECE7DE] bg-[#FBF9F5] p-3 sm:flex-row sm:gap-4 sm:p-4"
                      >
                        <ProductImage
                          src={item.product.image}
                          alt={item.product.name}
                          className="h-24 w-full flex-shrink-0 rounded-xl sm:h-28 sm:w-28"
                        />

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h3 className="line-clamp-2 text-sm font-semibold text-[#222222] sm:text-base">
                                {item.product.name}
                              </h3>

                              <p className="mt-1 text-sm font-bold text-[#355E4B]">
                                {formatPrice(
                                  item.product.price
                                )}
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                removeFromCart(
                                  item.product.id
                                )
                              }
                              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-[#B42318] hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>

                          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center rounded-lg border border-[#D8D4CB] bg-white">
                              <button
                                type="button"
                                onClick={() =>
                                  changeCartQuantity(
                                    item.product.id,
                                    -1
                                  )
                                }
                                className="flex h-9 w-9 items-center justify-center text-[#355E4B] hover:bg-[#FCFAF6]"
                              >
                                <Minus className="h-4 w-4" />
                              </button>

                              <span className="flex h-9 w-9 items-center justify-center border-x border-[#D8D4CB] text-sm font-semibold">
                                {item.quantity}
                              </span>

                              <button
                                type="button"
                                disabled={
                                  item.quantity >=
                                  item.product.stock
                                }
                                onClick={() =>
                                  changeCartQuantity(
                                    item.product.id,
                                    1
                                  )
                                }
                                className="flex h-9 w-9 items-center justify-center text-[#355E4B] hover:bg-[#FCFAF6] disabled:cursor-not-allowed disabled:text-[#B7BBB7]"
                              >
                                <Plus className="h-4 w-4" />
                              </button>
                            </div>

                            <p className="text-sm font-bold text-[#173F35]">
                              {formatPrice(
                                Math.round(
                                  item.product.price
                                ) *
                                  item.quantity
                              )}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 rounded-2xl bg-[#F4EBDD] p-5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-[#555C56]">
                        Cart Total
                      </span>

                      <span className="text-xl font-bold text-[#173F35]">
                        {formatPrice(cartTotal)}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={checkoutFromCart}
                      className="mt-4 w-full rounded-xl bg-[#355E4B] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[#173F35]"
                    >
                      Proceed to Checkout
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CHECKOUT */}
      {viewMode === "checkout" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#173F35]/55 p-3 sm:p-6">
          <div className="relative my-2 max-h-[96vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white shadow-2xl sm:my-0 sm:rounded-3xl">
            <div className="sticky top-0 z-20 flex items-center justify-between border-b border-[#ECE7DE] bg-white px-5 py-4 sm:px-7">
              <button
                type="button"
                onClick={backToDetails}
                className="flex items-center gap-2 text-sm font-semibold text-[#355E4B]"
              >
                <ChevronLeft className="h-5 w-5" />
                Back
              </button>

              <h2 className="text-lg font-bold text-[#173F35]">
                Checkout
              </h2>

              <button
                type="button"
                onClick={() =>
                  setViewMode("catalog")
                }
                className="flex h-9 w-9 items-center justify-center rounded-full text-[#555C56] hover:bg-[#F4EBDD]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="grid min-w-0 lg:grid-cols-[minmax(0,1fr)_360px]"
            >
              <div className="p-5 sm:p-7">
                <h3 className="text-base font-bold text-[#222222]">
                  Delivery Information
                </h3>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-[#555C56]">
                      Full Name
                    </label>

                    <input
                      type="text"
                      value={name}
                      onChange={(event) =>
                        setName(event.target.value)
                      }
                      placeholder="Enter your full name"
                      className="h-11 w-full rounded-xl border border-[#D8D4CB] bg-[#FBF9F5] px-4 text-sm text-[#111111] outline-none placeholder:text-[#8A8D89] focus:border-[#355E4B] focus:ring-2 focus:ring-[#355E4B]/10"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-[#555C56]">
                      Email
                    </label>

                    <input
                      type="email"
                      value={email}
                      onChange={(event) =>
                        setEmail(event.target.value)
                      }
                      placeholder="Enter your email"
                      className="h-11 w-full rounded-xl border border-[#D8D4CB] bg-[#FBF9F5] px-4 text-sm text-[#111111] outline-none placeholder:text-[#8A8D89] focus:border-[#355E4B] focus:ring-2 focus:ring-[#355E4B]/10"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-[#555C56]">
                      Phone
                    </label>

                    <input
                      type="tel"
                      value={phone}
                      onChange={(event) =>
                        setPhone(event.target.value)
                      }
                      placeholder="03XX XXXXXXX"
                      className="h-11 w-full rounded-xl border border-[#D8D4CB] bg-[#FBF9F5] px-4 text-sm text-[#111111] outline-none placeholder:text-[#8A8D89] focus:border-[#355E4B] focus:ring-2 focus:ring-[#355E4B]/10"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-[#555C56]">
                      City
                    </label>

                    <input
                      type="text"
                      value={city}
                      onChange={(event) =>
                        setCity(event.target.value)
                      }
                      placeholder="Enter your city"
                      className="h-11 w-full rounded-xl border border-[#D8D4CB] bg-[#FBF9F5] px-4 text-sm text-[#111111] outline-none placeholder:text-[#8A8D89] focus:border-[#355E4B] focus:ring-2 focus:ring-[#355E4B]/10"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-sm font-medium text-[#555C56]">
                      Delivery Address
                    </label>

                    <textarea
                      value={address}
                      onChange={(event) =>
                        setAddress(event.target.value)
                      }
                      placeholder="Enter your complete delivery address"
                      rows={4}
                      className="w-full resize-none rounded-xl border border-[#D8D4CB] bg-[#FBF9F5] px-4 py-3 text-sm text-[#111111] outline-none placeholder:text-[#8A8D89] focus:border-[#355E4B] focus:ring-2 focus:ring-[#355E4B]/10"
                    />
                  </div>
                </div>

                <div className="mt-8 border-t border-[#ECE7DE] pt-7">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-[#355E4B]" />

                    <h3 className="text-base font-bold text-[#222222]">
                      Payment Method
                    </h3>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentMethod("COD");
                        setPayerName("");
                        setPaymentNumber("");
                        setPaymentReference("");
                        setOrderError("");
                      }}
                      className={`rounded-2xl border p-4 text-left transition ${
                        paymentMethod === "COD"
                          ? "border-[#355E4B] bg-[#E8F2EC] ring-2 ring-[#355E4B]/10"
                          : "border-[#D8D4CB] bg-[#FBF9F5] hover:bg-[#FCFAF6]"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border ${
                            paymentMethod === "COD"
                              ? "border-[#355E4B]"
                              : "border-[#A8ADA8]"
                          }`}
                        >
                          {paymentMethod ===
                            "COD" && (
                            <div className="h-2.5 w-2.5 rounded-full bg-[#355E4B]" />
                          )}
                        </div>

                        <div>
                          <p className="text-sm font-semibold text-[#222222]">
                            Cash on Delivery
                          </p>

                          <p className="mt-1 text-xs text-[#777C77]">
                            Pay when your order is delivered.
                          </p>
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setPaymentMethod(
                          "Online Payment"
                        );
                        setOrderError("");
                      }}
                      className={`rounded-2xl border p-4 text-left transition ${
                        paymentMethod ===
                        "Online Payment"
                          ? "border-[#355E4B] bg-[#E8F2EC] ring-2 ring-[#355E4B]/10"
                          : "border-[#D8D4CB] bg-[#FBF9F5] hover:bg-[#FCFAF6]"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border ${
                            paymentMethod ===
                            "Online Payment"
                              ? "border-[#355E4B]"
                              : "border-[#A8ADA8]"
                          }`}
                        >
                          {paymentMethod ===
                            "Online Payment" && (
                            <div className="h-2.5 w-2.5 rounded-full bg-[#355E4B]" />
                          )}
                        </div>

                        <div>
                          <p className="text-sm font-semibold text-[#222222]">
                            Online Payment
                          </p>

                          Complete your payment details to place the order.
                        </div>
                      </div>
                    </button>
                  </div>

                  {paymentMethod ===
                    "Online Payment" && (
                    <div className="mt-4 rounded-2xl border border-[#D8D4CB] bg-[#FBF9F5] p-4 sm:p-5">
                      <div className="mb-4">
                        <div className="flex items-center gap-2">
                          <CreditCard className="h-5 w-5 text-[#355E4B]" />

                          <h4 className="text-sm font-bold text-[#173F35]">
                            Online Payment
                          </h4>
                        </div>

                        <p className="mt-1 text-xs leading-5 text-[#777C77]">
                          Enter your payment information below and confirm the payment.
                        </p>
                      </div>

                      <div className="space-y-4">
                        {/* PAYER NAME */}
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-[#555C56]">
                            Payer Name
                          </label>

                          <input
                            type="text"
                            value={payerName}
                            onChange={(event) =>
                              setPayerName(
                                event.target.value
                              )
                            }
                            placeholder="Enter payer name"
                            autoComplete="off"
                            required
                            className="h-11 w-full rounded-xl border border-[#D8D4CB] bg-white px-4 text-sm text-[#111111] outline-none placeholder:text-[#8A8D89] focus:border-[#355E4B] focus:ring-2 focus:ring-[#355E4B]/10"
                          />
                        </div>

                        {/* PAYMENT NUMBER */}
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-[#555C56]">
                            Payment Number
                          </label>

                          <input
                            type="text"
                            inputMode="numeric"
                            value={paymentNumber}
                            onChange={(event) =>
                              setPaymentNumber(
                                event.target.value
                              )
                            }
                            placeholder="Enter payment account or mobile number"
                            autoComplete="off"
                            required
                            className="h-11 w-full rounded-xl border border-[#D8D4CB] bg-white px-4 text-sm text-[#111111] outline-none placeholder:text-[#8A8D89] focus:border-[#355E4B] focus:ring-2 focus:ring-[#355E4B]/10"
                          />
                        </div>

                        {/* PAYMENT AMOUNT */}
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-[#555C56]">
                            Payment Amount
                          </label>

                          <input
                            type="text"
                            value={formatPrice(
                              checkoutTotal
                            )}
                            readOnly
                            className="h-11 w-full rounded-xl border border-[#D8D4CB] bg-[#F1EEE7] px-4 text-sm font-bold text-[#173F35] outline-none"
                          />

                          <p className="mt-1.5 text-xs text-[#777C77]">
                            The payment amount is automatically calculated from your order total.
                          </p>
                        </div>

                        {/* TRANSACTION / REFERENCE ID */}
                        <div>
  <label className="mb-1.5 block text-sm font-medium text-[#555C56]">
    Transaction / Reference ID
    <span className="ml-1 text-xs font-normal text-[#777C77]">
      (Optional)
    </span>
  </label>

  <input
    type="text"
    value={paymentReference}
    onChange={(event) =>
      setPaymentReference(
        event.target.value
      )
    }
    placeholder="Enter transaction/reference ID (optional)"
    autoComplete="off"
    className="h-11 w-full rounded-xl border border-[#D8D4CB] bg-white px-4 text-sm text-[#111111] outline-none placeholder:text-[#8A8D89] focus:border-[#355E4B] focus:ring-2 focus:ring-[#355E4B]/10"
  />

  <p className="mt-1.5 text-xs text-[#777C77]">
    You may provide a transaction/reference ID if available.
  </p>
</div>
                      </div>
                    </div>
                  )}
                </div>

                {orderError && (
                  <div className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
                    {orderError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#355E4B] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[#173F35] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Processing Order...
                    </>
                  ) : paymentMethod ===
                    "Online Payment" ? (
                    <>
                      <CreditCard className="h-5 w-5" />
Submit Online Payment
                    </>
                  ) : (
                    <>
                      <ShoppingBag className="h-5 w-5" />
                      Place Order
                    </>
                  )}
                </button>
              </div>

              {/* ORDER SUMMARY */}
              <div className="border-t border-[#ECE7DE] bg-[#FBF9F5] p-4 sm:p-7 lg:border-l lg:border-t-0">
                <h3 className="text-base font-bold text-[#222222]">
                  Order Summary
                </h3>

                <div className="mt-5 space-y-4">
                  {checkoutItems.map((item) => (
                    <div
                      key={item.product.id}
                      className="flex gap-3"
                    >
                      <ProductImage
                        src={item.product.image}
                        alt={item.product.name}
                        className="h-16 w-16 flex-shrink-0 rounded-xl"
                      />

                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm font-semibold text-[#222222]">
                          {item.product.name}
                        </p>

                        <p className="mt-1 text-xs text-[#777C77]">
                          Qty: {item.quantity}
                        </p>
                      </div>

                      <p className="flex-shrink-0 text-sm font-bold text-[#173F35]">
                        {formatPrice(
                          Math.round(
                            item.product.price
                          ) *
                            item.quantity
                        )}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="my-5 border-t border-[#D8D4CB]" />

                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#555C56]">
                    Items
                  </span>

                  <span className="text-sm font-semibold text-[#222222]">
                    {checkoutItems.reduce(
                      (sum, item) =>
                        sum + item.quantity,
                      0
                    )}
                  </span>
                </div>

                <div className="mt-3 flex items-center justify-between gap-4">
                  <span className="text-sm text-[#555C56]">
                    Payment
                  </span>

                  <span className="text-right text-sm font-semibold text-[#222222]">
                    {paymentMethod === "COD"
                      ? "Cash on Delivery"
                      : "Online Payment"}
                  </span>
                </div>

                <div className="my-5 border-t border-[#D8D4CB]" />

                <div className="flex items-center justify-between">
                  <span className="text-base font-bold text-[#222222]">
                    Total
                  </span>

                  <span className="text-xl font-bold text-[#173F35]">
                    {formatPrice(
                      checkoutTotal
                    )}
                  </span>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUCCESS */}
      {viewMode === "success" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#173F35]/55 p-3 sm:p-4">
          <div className="my-2 max-h-[96vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 text-center shadow-2xl sm:my-0 sm:rounded-3xl sm:p-10">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#E6F3EC]">
              <CheckCircle2 className="h-10 w-10 text-[#286044]" />
            </div>

            <h2 className="mt-6 text-2xl font-bold text-[#173F35]">
              Order Placed Successfully!
            </h2>

            <p className="mt-2 text-sm leading-6 text-[#6B706C]">
              Thank you for shopping with PrimeCart Store. Your order has been
              received successfully.
            </p>

            <div className="mt-6 rounded-2xl bg-[#F4EBDD] p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#555C56]">
                  Order Total
                </span>

                <span className="text-lg font-bold text-[#173F35]">
                  {formatPrice(
                    completedOrderTotal
                  )}
                </span>
              </div>

              <div className="mt-3 flex items-center justify-between gap-4">
                <span className="text-sm text-[#555C56]">
                  Payment Method
                </span>

                <span className="text-right text-sm font-semibold text-[#222222]">
                  {completedPaymentMethod}
                </span>
              </div>

              {completedPaymentMethod ===
                "Online Payment" && (
                <>
                  <div className="mt-3 flex items-center justify-between gap-4">
                    <span className="text-sm text-[#555C56]">
                      Payer Name
                    </span>

                    <span className="max-w-[220px] truncate text-right text-sm font-semibold text-[#222222]">
                      {completedPayerName}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-4">
                    <span className="text-sm text-[#555C56]">
                      Payment Number
                    </span>

                    <span className="max-w-[190px] truncate text-right text-sm font-semibold text-[#222222]">
                      {completedPaymentNumber}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-4">
                    <span className="text-sm text-[#555C56]">
                      Reference ID
                    </span>

                    <span className="max-w-[190px] truncate text-right text-sm font-semibold text-[#222222]">
                      {completedPaymentReference}
                    </span>
                  </div>
                </>
              )}

          
            </div>

            {completedPaymentMethod ===
              "Online Payment" && (
              <div className="mt-4 rounded-xl border border-[#D8D4CB] bg-[#FBF9F5] p-4 text-left">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-[#355E4B]" />

                  <p className="text-sm font-semibold text-[#355E4B]">
                    Online Payment Submitted
                  </p>
                </div>

                <p className="mt-1 text-xs leading-5 text-[#777C77]">
                  Your payment details have been recorded with this order. Payment
                  status is currently Pending.
                </p>
              </div>
            )}

            {completedPaymentMethod === "COD" && (
              <div className="mt-4 rounded-xl border border-[#D8D4CB] bg-[#FBF9F5] p-4 text-left">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4 text-[#355E4B]" />

                  <p className="text-sm font-semibold text-[#355E4B]">
                    Cash on Delivery
                  </p>
                </div>

                <p className="mt-1 text-xs leading-5 text-[#777C77]">
                  Your order has been placed. Payment will be collected when the
                  order is delivered.
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={resetAfterSuccess}
              className="mt-6 w-full rounded-xl bg-[#355E4B] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[#173F35]"
            >
              Continue Shopping
            </button>
          </div>
        </div>
      )}
    </div>
  );
}