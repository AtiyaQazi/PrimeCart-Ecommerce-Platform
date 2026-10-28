"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import DashboardLayout from "../../components/layout/DashboardLayout";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import {
  AlertTriangle,
  Check,
  Edit3,
  ImageIcon,
  Package,
  Plus,
  Search,
  Trash2,
  Warehouse,
  X,
  XCircle,
} from "lucide-react";
import { db } from "../../lib/firestore";

interface ColorStock {
  color: string;
  stock: number;
}

interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  description: string;
  image?: string;
  images?: string[];
  colors?: string[];
  colorStocks?: ColorStock[];
  createdAt?: unknown;
}

interface ProductForm {
  name: string;
  category: string;
  price: string;
  description: string;
  images: string[];
  colorStocks: ColorStock[];
}

const MAX_IMAGES = 20;

const categories = [
  "Electronics",
  "Accessories",
  "Clothing",
  "Home Decor",
  "Beauty",
  "Other",
];

const emptyForm: ProductForm = {
  name: "",
  category: "Electronics",
  price: "",
  description: "",
  images: [""],
  colorStocks: [{ color: "", stock: 0 }],
};

function formatPrice(price: number) {
  return `Rs. ${Math.round(price).toLocaleString("en-PK")}`;
}

function getTotalColorStock(colorStocks: ColorStock[]) {
  return colorStocks.reduce(
    (total, item) => total + Math.max(0, Number(item.stock) || 0),
    0
  );
}

function normalizeColorStocks(value: unknown): ColorStock[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item) => item && typeof item === "object")
    .map((item) => {
      const entry = item as Record<string, unknown>;

      return {
        color: String(entry.color ?? "").trim(),
        stock: Math.max(0, Math.floor(Number(entry.stock) || 0)),
      };
    })
    .filter((item) => item.color.length > 0);
}

const productImageMap: Record<string, string> = {
  "Portable Mini Fan": "/products/portable-mini-fan.jpg",
  "Pearl Drop Earrings": "/products/pearl-drop-earrings.jpeg",
  "Makeup Brush Set": "/products/makeup-brush-set.jpg",
  "Decorative Vase": "/products/decorative-vase.jpeg",
  "Sports Tracksuit": "/products/sports-tracksuit.jpeg",
  "USB-C Charger": "/products/usb-c-charger.jpg",
  "Classic Sunglasses": "/products/classic-sunglasses.jpeg",
  "Lip Balm": "/products/lip-balm.jpeg",
  "Keychain Set": "/products/keychain-set.jpeg",
  "Artificial Plant": "/products/artificial-plant.jpeg",
  "Tablet Stand": "/products/tablet-stand.jpeg",
  "Travel Organizer": "/products/travel-organizer.jpeg",
  "Fashion Handbag": "/products/fashion-handbag.jpeg",
  "Rose Face Toner": "/products/rose-face-toner.jpg",
  "Reusable Shopping Bag": "/products/reusable-shopping-bag.jpeg",
  "Lunch Box": "/products/lunch-box.jpg",
  "Linen Trousers": "/products/linen-trousers.jpeg",
  "Linen Trousers (Men)": "/products/linen-trousers.jpeg",
  "Power Bank": "/products/power-bank.jpeg",
  "Decorative Mirror": "/products/decorative-mirror.jpeg",
  "Desk Calendar": "/products/desk-calendar.jpeg",
  "Stationery Set": "/products/stationery-set.jpeg",
  "Notebook Set": "/products/notebook-set.jpeg",
  "Perfume Mist": "/products/perfume-mist.jpeg",
  "Hair Serum": "/products/hair-serum.jpeg",
  "Hooded Sweatshirt": "/products/hooded-sweatshirt.jpeg",
  "Smart Watch": "/products/smart-watch.jpeg",
  "Photo Frame": "/products/photo-frame.jpeg",
  "Cushion Cover Set": "/products/cushion-cover-set.jpeg",
  "Travel Mug": "/products/travel-mug.jpeg",
  "Gift Box": "/products/gift-box.jpeg",
  "Travel Pillow": "/products/travel-pillow.jpeg",
  "Bluetooth Speaker": "/products/bluetooth-speaker.jpeg",
  "Scented Candle": "/products/scented-candle.jpeg",
  "Wall Clock": "/products/wall-clock.jpeg",
  "Wireless Mouse": "/products/wireless-mouse.jpeg",
  "Cotton Hoodie": "/products/cotton-hoodie.jpeg",
  "Casual Polo Shirt": "/products/casual-polo-shirt.jpeg",
  "Casual Polo Shirt1": "/products/casual-polo-shirt1.jpeg",
  "Hair Conditioner": "/products/hair-conditioner.jpeg",
  "Laptop Sleeve": "/products/laptop-sleeve.jpeg",
  "Canvas Backpack": "/products/canvas-backpack.jpeg",
  "Travel Pouch": "/products/travel-pouch.jpeg",
  "Analog Wrist Watch": "/products/analog-wrist-watch.jpeg",
  "Hair Clip Set": "/products/hair-clip-set.jpeg",
  "Formal Shirt": "/products/formal-shirt.jpeg",
  "Summer Dress": "/products/summer-dress.jpeg",
  "Gentle Face Cleanser": "/products/gentle-face-cleanser.jpeg",
  "Hydrating Face Cream": "/products/hydrating-face-cream.jpeg",
  "USB Flash Drive": "/products/usb-flash-drive.jpeg",
  "Smart LED Bulb": "/products/smart-led-bulb.jpeg",
  "Mechanical Keyboard": "/products/mechanical-keyboard.jpeg",
  "Face Mask": "/products/face-mask.jpeg",
  "Vitamin C Serum": "/products/vitamin-c-serum.jpeg",
  "Laundry Basket": "/products/laundry-basket.jpeg",
  "Denim Jeans": "/products/denim-jeans.jpeg",
  "Winter Jacket": "/products/winter-jacket.jpeg",
  "Classic Cotton T-Shirt": "/products/classic-cotton-t-shirt.jpeg",
  "Leather Wallet": "/products/leather-wallet.jpeg",
  "Glass Water Bottle": "/products/glass-water-bottle.jpeg",
  "Ceramic Coffee Mug": "/products/ceramic-coffee-mug.jpeg",
  "Wireless Headphones": "/products/wireless-headphones.jpeg",
};

function getProductImage(name: string) {
  const cleanName = name.trim();

  if (productImageMap[cleanName]) {
    return productImageMap[cleanName];
  }

  const normalize = (value: string) =>
    value
      .toLowerCase()
      .replace(/\(.*?\)/g, "")
      .replace(/[-_]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const matchingKey = Object.keys(productImageMap).find(
    (key) => normalize(key) === normalize(cleanName)
  );

  return matchingKey ? productImageMap[matchingKey] : "";
}

function cleanImages(values: unknown): string[] {
  if (!Array.isArray(values)) return [];

  return Array.from(
    new Set(
      values
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean)
    )
  ).slice(0, MAX_IMAGES);
}

function getImagesFromProduct(product: Product): string[] {
  const images = cleanImages(product.images);
  const legacyImage = product.image?.trim();

  if (legacyImage && !images.includes(legacyImage)) {
    images.unshift(legacyImage);
  }

  if (images.length > 0) {
    return images.slice(0, MAX_IMAGES);
  }

  const localImage = getProductImage(product.name);
  return localImage ? [localImage] : [];
}

function isAllowedImagePath(value: string): boolean {
  const cleanPath = value.split("?")[0].split("#")[0].toLowerCase();

  return cleanPath.endsWith(".jpg") || cleanPath.endsWith(".jpeg");
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
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return (
      <div
        className={`flex items-center justify-center rounded-xl bg-[#F1EEE7] text-[#8A8D89] ${className}`}
      >
        <Package className="h-7 w-7" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={`object-cover ${className}`}
      onError={() => setFailed(true)}
    />
  );
}

function StockBadge({ stock }: { stock: number }) {
  if (stock <= 0) {
    return (
      <span className="inline-flex rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
        Out of Stock
      </span>
    );
  }

  if (stock <= 10) {
    return (
      <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
        Low: {stock}
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full bg-[#E6F3EC] px-3 py-1 text-xs font-semibold text-[#286044]">
      {stock} in stock
    </span>
  );
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const syncedImagesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const productsQuery = query(
      collection(db, "products"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      productsQuery,
      async (snapshot) => {
        const data: Product[] = snapshot.docs.map((productDoc) => {
          const item = productDoc.data();
          const name = String(item.name ?? "").trim();
          const firestoreImage = String(item.image ?? "").trim();
          const firestoreImages = cleanImages(item.images);

          const images =
            firestoreImages.length > 0
              ? firestoreImages
              : firestoreImage
                ? [firestoreImage]
                : getProductImage(name)
                  ? [getProductImage(name)]
                  : [];

          const savedColorStocks = normalizeColorStocks(item.colorStocks);
          const savedColors = Array.isArray(item.colors)
            ? item.colors
                .filter((color: unknown): color is string =>
                  typeof color === "string"
                )
                .map((color: string) => color.trim())
                .filter(Boolean)
            : [];

          // Backward compatibility for products created before color stock
          // was introduced. Existing aggregate stock is kept in an unnamed
          // entry so the admin can assign the correct color when editing.
          const colorStocks =
            savedColorStocks.length > 0
              ? savedColorStocks
              : [
                  {
                    color: savedColors[0] ?? "Default",
                    stock: Math.max(
                      0,
                      Math.floor(Number(item.stock ?? 0))
                    ),
                  },
                ];

          const stock = getTotalColorStock(colorStocks);

          return {
            id: productDoc.id,
            name,
            category: String(item.category ?? ""),
            price: Number(item.price ?? 0),
            stock,
            description: String(item.description ?? ""),
            image: firestoreImage || images[0] || "",
            images,
            colors: colorStocks
              .map((entry) => entry.color)
              .filter(Boolean),
            colorStocks,
            createdAt: item.createdAt,
          };
        });

        setProducts(data);
        setError("");

        // Preserve automatic fallback image syncing for older products.
        for (const productDoc of snapshot.docs) {
          const item = productDoc.data();
          const productId = productDoc.id;
          const productName = String(item.name ?? "").trim();
          const firestoreImage = String(item.image ?? "").trim();
          const localImage = getProductImage(productName);

          if (
            !firestoreImage &&
            localImage &&
            !syncedImagesRef.current.has(productId)
          ) {
            syncedImagesRef.current.add(productId);

           
            try {
              const existingColorStocks = normalizeColorStocks(
                item.colorStocks
              );

              const colorStocksForSync =
                existingColorStocks.length > 0
                  ? existingColorStocks
                  : [
                      {
                        color:
                          Array.isArray(item.colors) &&
                          item.colors.length > 0
                            ? String(item.colors[0]).trim() || "Default"
                            : "Default",
                        stock: Math.max(
                          0,
                          Math.floor(Number(item.stock ?? 0))
                        ),
                      },
                    ];

              const response = await fetch("/api/products", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  id: productId,
                  name: productName,
                  category: String(item.category ?? ""),
                  price: Number(item.price ?? 0),
                  stock: getTotalColorStock(colorStocksForSync),
                  description: String(item.description ?? ""),
                  image: localImage,
                  images: cleanImages(item.images).length
                    ? cleanImages(item.images)
                    : [localImage],
                  colorStocks: colorStocksForSync,
                  colors: colorStocksForSync.map(
                    (entry) => entry.color
                  ),
                }),
              });

              if (!response.ok) {
                syncedImagesRef.current.delete(productId);
                console.error(
                  "Unable to sync product image:",
                  productName
                );
              }
            } catch (syncError) {
              syncedImagesRef.current.delete(productId);
              console.error("Image sync error:", syncError);
            }

          }
        }
      },
      (snapshotError) => {
        console.error(snapshotError);
        setError(
          "Unable to load products. Please check your connection and Firestore permissions."
        );
      }
    );

    return () => unsubscribe();
  }, []);

  const filteredProducts = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();

    return products.filter((product) => {
      const matchesSearch =
        !searchTerm ||
        product.name.toLowerCase().includes(searchTerm) ||
        product.category.toLowerCase().includes(searchTerm) ||
        product.description.toLowerCase().includes(searchTerm) ||
        (product.colorStocks ?? []).some((entry) =>
          entry.color.toLowerCase().includes(searchTerm)
        );

      const matchesCategory =
        categoryFilter === "All" || product.category === categoryFilter;

      return matchesSearch && matchesCategory;
    });
  }, [products, search, categoryFilter]);

  const totalProducts = products.length;
  const lowStock = products.filter(
    (product) => product.stock > 0 && product.stock <= 10
  ).length;
  const outOfStock = products.filter((product) => product.stock <= 0).length;
  const totalStock = products.reduce(
    (total, product) => total + product.stock,
    0
  );

  function openAddModal() {
    setEditingProduct(null);
    setForm({
      ...emptyForm,
      images: [""],
      colorStocks: [{ color: "", stock: 0 }],
    });
    setError("");
    setSuccess("");
    setShowModal(true);
  }

  function openEditModal(product: Product) {
    const images = getImagesFromProduct(product);
    const colorStocks =
      product.colorStocks && product.colorStocks.length > 0
        ? product.colorStocks.map((entry) => ({
            color: entry.color,
            stock: entry.stock,
          }))
        : [{ color: "", stock: product.stock }];

    setEditingProduct(product);
    setForm({
      name: product.name,
      category: product.category || "Other",
      price: String(Math.round(product.price)),
      description: product.description,
      images: images.length ? images : [""],
      colorStocks,
    });
    setError("");
    setSuccess("");
    setShowModal(true);
  }

  function closeModal() {
    if (saving) return;

    setShowModal(false);
    setEditingProduct(null);
    setForm({
      ...emptyForm,
      images: [""],
      colorStocks: [{ color: "", stock: 0 }],
    });
    setError("");
  }

  function updateImage(index: number, value: string) {
    setForm((current) => ({
      ...current,
      images: current.images.map((image, imageIndex) =>
        imageIndex === index ? value : image
      ),
    }));
  }

  function addImageField() {
    if (form.images.length >= MAX_IMAGES) return;

    setForm((current) => ({
      ...current,
      images: [...current.images, ""],
    }));
  }

  function removeImage(index: number) {
    setForm((current) => {
      const nextImages = current.images.filter(
        (_, imageIndex) => imageIndex !== index
      );

      return {
        ...current,
        images: nextImages.length ? nextImages : [""],
      };
    });
  }

  function addColorStock() {
    setForm((current) => ({
      ...current,
      colorStocks: [...current.colorStocks, { color: "", stock: 0 }],
    }));
  }

 function updateColorStock(
  index: number,
  field: keyof ColorStock,
  value: string
) {
  setForm((current) => ({
    ...current,
    colorStocks: current.colorStocks.map((entry, entryIndex) => {
      if (entryIndex !== index) return entry;

      if (field === "color") {
        return { ...entry, color: value };
      }

      return {
        ...entry,
        stock:
          value === ""
            ? 0
            : Math.max(0, Math.floor(Number(value) || 0)),
      };
    }),
  }));
}

  function removeColorStock(index: number) {
    setForm((current) => ({
      ...current,
      colorStocks:
        current.colorStocks.length <= 1
          ? current.colorStocks
          : current.colorStocks.filter(
              (_, entryIndex) => entryIndex !== index
            ),
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const productName = form.name.trim();
      const localImage = getProductImage(productName);

      const enteredImages = cleanImages(form.images);
      const finalImages = (
        enteredImages.length
          ? enteredImages
          : localImage
            ? [localImage]
            : []
      ).slice(0, MAX_IMAGES);

      if (!productName) {
        throw new Error("Product name is required.");
      }

      if (!form.category) {
        throw new Error("Please select a category.");
      }

      const price = Number(form.price);

      if (
        !Number.isFinite(price) ||
        !Number.isInteger(price) ||
        price < 0
      ) {
        throw new Error("Price must be a whole number in rupees.");
      }

      if (form.colorStocks.length === 0) {
        throw new Error("Please add at least one color and its stock.");
      }

      const normalizedColorStocks = form.colorStocks.map((entry) => ({
        color: entry.color.trim(),
        stock: Number(entry.stock),
      }));

      for (let index = 0; index < normalizedColorStocks.length; index++) {
        const entry = normalizedColorStocks[index];

        if (!entry.color) {
          throw new Error(
            `Please enter a color name for color option ${index + 1}.`
          );
        }

        if (
          !Number.isFinite(entry.stock) ||
          !Number.isInteger(entry.stock) ||
          entry.stock < 0
        ) {
          throw new Error(
            `Stock for "${entry.color}" must be a whole number of zero or more.`
          );
        }
      }

      const colorNames = normalizedColorStocks.map((entry) =>
        entry.color.toLocaleLowerCase()
      );

      if (new Set(colorNames).size !== colorNames.length) {
        throw new Error(
          "Each color name must be unique. Please remove duplicate colors."
        );
      }

      const totalColorStock = getTotalColorStock(normalizedColorStocks);

      const enteredNonEmptyImages = form.images
        .map((image) => image.trim())
        .filter(Boolean);

      if (enteredNonEmptyImages.length > MAX_IMAGES) {
        throw new Error(
          `You can add a maximum of ${MAX_IMAGES} images per product.`
        );
      }

      const invalidImage = enteredNonEmptyImages.find(
        (image) => !isAllowedImagePath(image)
      );

      if (invalidImage) {
        throw new Error(
          "Please use JPG or JPEG image paths/URLs for all product images."
        );
      }

      const payload = {
        name: productName,
        category: form.category,
        price,
        // Aggregate stock is always calculated from the color stocks.
        stock: totalColorStock,
        colorStocks: normalizedColorStocks,
        colors: normalizedColorStocks.map((entry) => entry.color),
        description: form.description.trim(),
        image: finalImages[0] || localImage || "",
        images: finalImages,
      };

      const response = await fetch("/api/products", {
        method: editingProduct ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          editingProduct
            ? { id: editingProduct.id, ...payload }
            : payload
        ),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.error || "Unable to save product.");
      }

      if (editingProduct) {
        syncedImagesRef.current.delete(editingProduct.id);
      }

      setSuccess(
        editingProduct
          ? "Product updated successfully."
          : "Product added successfully."
      );

      setShowModal(false);
      setEditingProduct(null);
      setForm({
        ...emptyForm,
        images: [""],
        colorStocks: [{ color: "", stock: 0 }],
      });
    } catch (submitError) {
      console.error(submitError);
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Something went wrong."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(product: Product) {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${product.name}"?`
    );

    if (!confirmed) return;

    setDeletingId(product.id);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        `/api/products?id=${encodeURIComponent(product.id)}`,
        { method: "DELETE" }
      );

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.error || "Unable to delete product.");
      }

      syncedImagesRef.current.delete(product.id);
      setSuccess("Product deleted successfully.");
    } catch (deleteError) {
      console.error(deleteError);
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Unable to delete product."
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-[#F4EBDD] p-4 sm:p-6 lg:p-8">
        <div className="mb-8">
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-[#111111]">
            Products
          </h1>
          <p className="mt-2 text-sm text-[#6B706C]">
            Manage your products, prices, color-wise stock and images.
          </p>
        </div>

        {success && (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-[#C9DDD1] bg-[#E8F2EC] px-4 py-3 text-sm font-medium text-[#286044]">
            <Check className="h-5 w-5" />
            <span>{success}</span>
            <button
              type="button"
              onClick={() => setSuccess("")}
              className="ml-auto rounded-lg p-1 text-[#52705F] hover:bg-[#DCEBE2]"
              aria-label="Dismiss success message"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {error && !showModal && (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            <AlertTriangle className="h-5 w-5" />
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError("")}
              className="ml-auto"
              aria-label="Dismiss error message"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              label: "Total Products",
              value: totalProducts,
              icon: <Package size={23} />,
              color: "bg-[#E8F2EC] text-[#173F35]",
            },
            {
              label: "Total Stock",
              value: totalStock,
              icon: <Warehouse size={23} />,
              color: "bg-[#E8F2EC] text-[#173F35]",
            },
            {
              label: "Low Stock",
              value: lowStock,
              icon: <AlertTriangle size={23} />,
              color: "bg-amber-50 text-amber-600",
            },
            {
              label: "Out of Stock",
              value: outOfStock,
              icon: <XCircle size={23} />,
              color: "bg-red-50 text-red-600",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl bg-white p-5 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[#6B706C]">{stat.label}</p>
                  <p className="mt-2 text-3xl font-bold text-[#111111]">
                    {stat.value}
                  </p>
                </div>
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-xl ${stat.color}`}
                >
                  {stat.icon}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Search and category filter */}
        <div className="mt-8 rounded-2xl bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-md">
              <Search
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8A8D89]"
              />
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search products, colors or categories..."
                className="w-full rounded-xl border border-[#D8D4CB] bg-[#FBF9F5] py-3 pl-11 pr-10 text-sm text-[#111111] outline-none transition placeholder:text-[#8A8D89] focus:border-[#355E4B] focus:ring-2 focus:ring-[#355E4B]/10"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-[#777C77] hover:bg-[#EEEAE1]"
                  aria-label="Clear search"
                >
                  <XCircle size={18} />
                </button>
              )}
            </div>

            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              className="rounded-xl border border-[#D8D4CB] bg-[#FBF9F5] px-4 py-3 text-sm font-medium text-[#222222] outline-none focus:border-[#355E4B] focus:ring-2 focus:ring-[#355E4B]/10"
            >
              <option value="All">All Categories</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Products table */}
        <div className="mt-6 overflow-hidden rounded-2xl bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-[#ECE7DE] px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-[#111111]">Products</h2>
              <p className="mt-1 text-sm text-[#727771]">
                {filteredProducts.length} product
                {filteredProducts.length !== 1 ? "s" : ""} found
              </p>
            </div>

            <button
              type="button"
              onClick={openAddModal}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#355E4B] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#2F5544]"
            >
              <Plus className="h-5 w-5" />
              Add Product
            </button>
          </div>

          {filteredProducts.length === 0 ? (
            <div className="flex min-h-64 items-center justify-center px-6 text-center">
              <div>
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#F1EEE7] text-[#6C746D]">
                  <Package size={25} />
                </div>
                <h3 className="mt-4 font-semibold text-[#222222]">
                  No products found
                </h3>
                <p className="mt-2 text-sm text-[#777C77]">
                  Try changing your search or add a new product.
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px]">
                <thead>
                  <tr className="border-b border-[#ECE7DE] bg-[#FBF9F5] text-left">
                    <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide text-[#777C77]">
                      Product
                    </th>
                    <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide text-[#777C77]">
                      Category
                    </th>
                    <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide text-[#777C77]">
                      Price
                    </th>
                    <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide text-[#777C77]">
                      Color Stock
                    </th>
                    <th className="px-5 py-4 text-right text-xs font-bold uppercase tracking-wide text-[#777C77]">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredProducts.map((product) => {
                    const images = getImagesFromProduct(product);
                    const image = images[0] || "";

                    return (
                      <tr
                        key={product.id}
                        className="border-b border-[#F0ECE4] last:border-b-0 hover:bg-[#FCFAF6]"
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-4">
                            <div className="relative">
                              <ProductImage
                                src={image}
                                alt={product.name}
                                className="h-14 w-14 shrink-0 rounded-xl"
                              />
                              {images.length > 1 && (
                                <span className="absolute -right-2 -top-2 rounded-full bg-[#355E4B] px-1.5 py-0.5 text-[10px] font-bold text-white">
                                  {images.length} photos
                                </span>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-[#222222]">
                                {product.name}
                              </p>
                              <p className="mt-1 max-w-xs truncate text-xs text-[#818681]">
                                {product.description || "No description"}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <span className="rounded-lg bg-[#E8F2EC] px-3 py-1.5 text-xs font-medium text-[#355E4B]">
                            {product.category}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <span className="text-sm font-bold text-[#222222]">
                            {formatPrice(product.price)}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <div className="space-y-2">
                            <StockBadge stock={product.stock} />
                            {(product.colorStocks ?? []).some(
                              (entry) => entry.color
                            ) && (
                              <div className="flex max-w-xs flex-wrap gap-1.5">
                                {(product.colorStocks ?? [])
                                  .filter((entry) => entry.color)
                                  .map((entry, index) => (
                                    <span
                                      key={`${entry.color}-${index}`}
                                      className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs ${
                                        entry.stock <= 0
                                          ? "border-red-200 bg-red-50 text-red-700"
                                          : "border-[#D8D4CB] bg-[#FBF9F5] text-[#555C56]"
                                      }`}
                                    >
                                      {entry.color}:{" "}
                                      <strong>{entry.stock}</strong>
                                      {entry.stock <= 0 && (
                                        <span className="font-semibold">
                                          (Out)
                                        </span>
                                      )}
                                    </span>
                                  ))}
                              </div>
                            )}
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openEditModal(product)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#D8D4CB] text-[#555C56] transition hover:border-[#BFD0C5] hover:bg-[#E8F2EC] hover:text-[#355E4B]"
                              title="Edit product"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDelete(product)}
                              disabled={deletingId === product.id}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#D8D4CB] text-[#555C56] transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                              title="Delete product"
                            >
                              {deletingId === product.id ? (
                                <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#D8D4CB] border-t-red-500" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {filteredProducts.length > 0 && (
            <div className="border-t border-[#ECE7DE] px-5 py-4 text-sm text-[#727771]">
              Showing{" "}
              <span className="font-semibold text-[#222222]">
                {filteredProducts.length}
              </span>{" "}
              of{" "}
              <span className="font-semibold text-[#222222]">
                {products.length}
              </span>{" "}
              products
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit product modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#ECE7DE] bg-white px-6 py-5">
              <div>
                <h2 className="text-xl font-bold text-[#111111]">
                  {editingProduct ? "Edit Product" : "Add Product"}
                </h2>
                <p className="mt-1 text-sm text-[#727771]">
                  Add product details, colors, individual stock and images.
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="rounded-lg p-2 text-[#8A8D89] transition hover:bg-[#EEEAE1] hover:text-[#355E4B] disabled:opacity-50"
                aria-label="Close modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 p-6">
              {error && (
                <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#555C56]">
                  Product Name
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(event) =>
                    setForm({ ...form, name: event.target.value })
                  }
                  placeholder="e.g. Wireless Headphones"
                  required
                  className="w-full rounded-xl border border-[#D8D4CB] bg-[#FBF9F5] px-4 py-3 text-sm text-[#222222] outline-none placeholder:text-[#8A8D89] focus:border-[#355E4B] focus:ring-2 focus:ring-[#355E4B]/10"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#555C56]">
                  Category
                </label>
                <select
                  value={form.category}
                  onChange={(event) =>
                    setForm({ ...form, category: event.target.value })
                  }
                  required
                  className="w-full rounded-xl border border-[#D8D4CB] bg-[#FBF9F5] px-4 py-3 text-sm text-[#222222] outline-none focus:border-[#355E4B] focus:ring-2 focus:ring-[#355E4B]/10"
                >
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#555C56]">
                  Price (Rs.)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  value={form.price}
                  onChange={(event) =>
                    setForm({ ...form, price: event.target.value })
                  }
                  placeholder="5000"
                  required
                  className="w-full rounded-xl border border-[#D8D4CB] bg-[#FBF9F5] px-4 py-3 text-sm text-[#222222] outline-none focus:border-[#355E4B] focus:ring-2 focus:ring-[#355E4B]/10"
                />
              </div>

              {/* Color-wise stock management */}
              <div className="rounded-2xl border border-[#D8D4CB] bg-[#FBF9F5] p-4 sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-base font-bold text-[#222222]">
                      Colors and Individual Stock
                    </h3>
                    <p className="mt-1 text-xs leading-5 text-[#777C77]">
                      Add as many colors as your product needs. Each color has
                      its own stock quantity.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={addColorStock}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#355E4B] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#2F5544]"
                  >
                    <Plus className="h-4 w-4" />
                    Add Color
                  </button>
                </div>

                <div className="mt-4 space-y-3">
                  {form.colorStocks.map((entry, index) => (
                    <div
                      key={`color-stock-${index}`}
                      className="grid gap-3 rounded-xl border border-[#E4DED3] bg-white p-3 sm:grid-cols-[minmax(0,1fr)_140px_40px] sm:items-end"
                    >
                      <div>
                        <label
                          className="mb-2 block text-sm font-semibold text-[#555C56]"
                          htmlFor={`product-color-${index}`}
                        >
                          Color Name
                        </label>
                        <input
                          id={`product-color-${index}`}
                          type="text"
                          value={entry.color}
                          onChange={(event) =>
                            updateColorStock(
                              index,
                              "color",
                              event.target.value
                            )
                          }
                          placeholder="e.g. Black, Navy Blue, Rose Gold"
                          required
                          className="w-full rounded-xl border border-[#D8D4CB] bg-[#FBF9F5] px-3 py-3 text-sm text-[#222222] outline-none placeholder:text-[#8A8D89] focus:border-[#355E4B] focus:ring-2 focus:ring-[#355E4B]/10"
                        />
                      </div>

                      <div>
                        <label
                          className="mb-2 block text-sm font-semibold text-[#555C56]"
                          htmlFor={`product-stock-${index}`}
                        >
                          Stock Quantity
                        </label>
                        <input
                          id={`product-stock-${index}`}
                          type="number"
                          min="0"
                          step="1"
                          inputMode="numeric"
                          value={entry.stock}
                          onChange={(event) =>
                            updateColorStock(
                              index,
                              "stock",
                              event.target.value
                            )
                          }
                          required
                          className="w-full rounded-xl border border-[#D8D4CB] bg-[#FBF9F5] px-3 py-3 text-sm text-[#222222] outline-none focus:border-[#355E4B] focus:ring-2 focus:ring-[#355E4B]/10"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => removeColorStock(index)}
                        disabled={form.colorStocks.length === 1}
                        title="Remove color"
                        aria-label={`Remove color option ${index + 1}`}
                        className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-[#D8D4CB] text-[#777C77] transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 sm:w-10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex flex-col gap-2 rounded-xl border border-[#C9DDD1] bg-[#E8F2EC] p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[#286044]">
                      Total Product Stock
                    </p>
                    <p className="mt-1 text-xs text-[#52705F]">
                      Automatically calculated from all color quantities.
                    </p>
                  </div>
                  <p className="text-2xl font-bold text-[#173F35]">
                    {getTotalColorStock(form.colorStocks)}
                  </p>
                </div>
              </div>

              {/* Multiple image URLs/paths */}
              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label className="block text-sm font-semibold text-[#555C56]">
                    Product Images
                  </label>
                  <span className="rounded-full bg-[#E8F2EC] px-3 py-1 text-xs font-semibold text-[#355E4B]">
                    {
                      form.images.filter((image) => image.trim()).length
                    }
                    /{MAX_IMAGES}
                  </span>
                </div>

                <p className="mb-4 text-xs leading-5 text-[#777C77]">
                  Add up to {MAX_IMAGES} JPG/JPEG image paths or URLs. The
                  first image remains the main product image.
                </p>

                <div className="space-y-4">
                  {form.images.map((image, index) => (
                    <div
                      key={`product-image-${index}`}
                      className="rounded-xl border border-[#ECE7DE] bg-[#FBF9F5] p-3"
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#E8F2EC] text-[#355E4B]">
                          <ImageIcon className="h-4 w-4" />
                        </div>

                        <input
                          type="text"
                          value={image}
                          onChange={(event) =>
                            updateImage(index, event.target.value)
                          }
                          placeholder="/products/product-image.jpg"
                          aria-label={`Product image ${index + 1}`}
                          className="min-w-0 flex-1 rounded-lg border border-[#D8D4CB] bg-white px-3 py-2.5 text-sm text-[#222222] outline-none placeholder:text-[#8A8D89] focus:border-[#355E4B] focus:ring-2 focus:ring-[#355E4B]/10"
                        />

                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#D8D4CB] text-[#777C77] transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                          title="Remove image"
                          aria-label={`Remove image ${index + 1}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      {image.trim() && (
                        <div className="mt-3 flex items-center gap-3">
                          <ProductImage
                            src={image.trim()}
                            alt={`Product image ${index + 1} preview`}
                            className="h-16 w-16 rounded-lg"
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-[#222222]">
                              {index === 0
                                ? "Main Image"
                                : `Image ${index + 1}`}
                            </p>
                            <p className="break-all text-xs text-[#777C77]">
                              {image.trim()}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {form.images.length < MAX_IMAGES && (
                  <button
                    type="button"
                    onClick={addImageField}
                    className="mt-3 inline-flex items-center gap-2 rounded-xl border border-dashed border-[#9BB5A4] px-4 py-2.5 text-sm font-semibold text-[#355E4B] transition hover:bg-[#E8F2EC]"
                  >
                    <Plus className="h-4 w-4" />
                    Add Another Image
                  </button>
                )}

                {form.images.length >= MAX_IMAGES && (
                  <p className="mt-3 text-xs font-medium text-[#777C77]">
                    Maximum of {MAX_IMAGES} images reached.
                  </p>
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#555C56]">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      description: event.target.value,
                    })
                  }
                  placeholder="Enter product details and description..."
                  rows={5}
                  className="w-full resize-none rounded-xl border border-[#D8D4CB] bg-[#FBF9F5] px-4 py-3 text-sm text-[#222222] outline-none placeholder:text-[#8A8D89] focus:border-[#355E4B] focus:ring-2 focus:ring-[#355E4B]/10"
                />
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-[#ECE7DE] pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="rounded-xl border border-[#D8D4CB] px-5 py-3 text-sm font-semibold text-[#555C56] transition hover:bg-[#F1EEE7] hover:text-[#355E4B] disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#355E4B] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#2F5544] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      {editingProduct ? "Update Product" : "Add Product"}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
