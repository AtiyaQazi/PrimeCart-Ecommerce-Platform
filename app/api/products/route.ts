import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "../../../lib/firebase-admin";

const MAX_IMAGES = 20;

type UnknownRecord = Record<string, unknown>;

interface ColorStock {
  color: string;
  stock: number;
}

interface ProductPayload extends UnknownRecord {
  id?: unknown;
  name?: unknown;
  category?: unknown;
  price?: unknown;
  stock?: unknown;
  description?: unknown;
  image?: unknown;
  images?: unknown;
  colors?: unknown;
  colorStocks?: unknown;
}

function normalizeImagePath(value: unknown): string {
  if (typeof value !== "string") return "";

  let path = value.trim();
  if (!path) return "";

  if (path.startsWith("products/")) {
    path = `/${path}`;
  }

  return path;
}

function cleanImages(value: unknown): string[] {
  let source: unknown[] = [];

  if (Array.isArray(value)) {
    source = value;
  } else if (typeof value === "string" && value.trim()) {
    try {
      const parsed: unknown = JSON.parse(value);
      source = Array.isArray(parsed) ? parsed : [value];
    } catch {
      source = value.includes("\n")
        ? value.split(/\r?\n/)
        : value.split(",");
    }
  }

  const unique = new Set<string>();

  for (const item of source) {
    const record =
      typeof item === "object" && item !== null
        ? (item as UnknownRecord)
        : null;

    const path = normalizeImagePath(
      record ? record.url ?? record.src ?? record.image : item
    );

    if (path) unique.add(path);
    if (unique.size >= MAX_IMAGES) break;
  }

  return [...unique];
}

function validImagePath(path: string): boolean {
  if (path.startsWith("/")) {
    return !path.startsWith("//") && !path.includes(" ");
  }

  try {
    const url = new URL(path);

    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return false;
    }

    const pathname = url.pathname.toLowerCase();

    return (
      /\.(jpg|jpeg|png|webp)$/.test(pathname) ||
      !/\.[a-z0-9]+$/i.test(pathname)
    );
  } catch {
    return false;
  }
}

function normalizeColorStocks(value: unknown): ColorStock[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const result: ColorStock[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object") continue;

    const entry = item as Record<string, unknown>;
    const color = String(entry.color ?? "").trim();
    const stock = Number(entry.stock ?? 0);

    if (!color) continue;

    if (!Number.isSafeInteger(stock) || stock < 0) {
      continue;
    }

    const key = color.toLowerCase();

    // Prevent duplicate color entries.
    if (seen.has(key)) continue;

    seen.add(key);
    result.push({ color, stock });
  }

  return result;
}

function validateProduct(body: ProductPayload) {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const category =
    typeof body.category === "string" ? body.category.trim() : "";
  const description =
    typeof body.description === "string" ? body.description.trim() : "";

  const submittedImages = cleanImages(body.images);
  const legacyImage = normalizeImagePath(body.image);

  const images = submittedImages.length
    ? submittedImages
    : legacyImage
      ? [legacyImage]
      : [];

  const price = Number(body.price);

  if (!name) {
    return { valid: false as const, error: "Product name is required." };
  }

  if (!category) {
    return {
      valid: false as const,
      error: "Product category is required.",
    };
  }

  if (!Number.isFinite(price) || !Number.isInteger(price) || price < 0) {
    return {
      valid: false as const,
      error: "Please enter a valid whole-number price.",
    };
  }

  const colorStocks = normalizeColorStocks(body.colorStocks);

  if (colorStocks.length === 0) {
    return {
      valid: false as const,
      error:
        "Add at least one color with a name and a non-negative whole-number stock quantity. Color names must be unique.",
    };
  }

  // Never trust a client-provided aggregate stock value. Calculate it
  // from the individual color quantities on the server.
  const stock = colorStocks.reduce(
    (total, entry) => total + entry.stock,
    0
  );

  if (!Number.isSafeInteger(stock)) {
    return {
      valid: false as const,
      error: "The combined stock quantity is too large.",
    };
  }

  if (images.length === 0) {
    return {
      valid: false as const,
      error: "Please add at least one product image before saving.",
    };
  }

  if (images.length > MAX_IMAGES) {
    return {
      valid: false as const,
      error: `You can add a maximum of ${MAX_IMAGES} images per product.`,
    };
  }

  const invalidImage = images.find((path) => !validImagePath(path));

  if (invalidImage) {
    return {
      valid: false as const,
      error:
        "Please provide valid local image paths or HTTP/HTTPS image URLs.",
    };
  }

  return {
    valid: true as const,
    data: {
      name,
      category,
      price,
      stock,
      colorStocks,
      colors: colorStocks.map((entry) => entry.color),
      description,
      image: images[0],
      images,
    },
  };
}

function serializeProduct(id: string, data: UnknownRecord) {
  const savedImages = cleanImages(data.images);
  const legacyImage = normalizeImagePath(data.image);

  const images = (
    savedImages.length > 0
      ? savedImages
      : legacyImage
        ? [legacyImage]
        : []
  ).slice(0, MAX_IMAGES);

  const savedColorStocks = normalizeColorStocks(data.colorStocks);

  // Legacy products are still returned with a usable stock value.
  // Their color assignment can be set when editing the product.
   const colorStocks =
  savedColorStocks.length > 0
    ? savedColorStocks
    : (() => {
      const legacyStock = Math.max(
        0,
        Math.floor(Number(data.stock ?? 0) || 0)
      );

      const legacyColors = Array.isArray(data.colors)
        ? data.colors.filter(
            (color): color is string =>
              typeof color === "string" && color.trim().length > 0
          )
        : [];

      if (legacyColors.length === 0) {
        return [{ color: "", stock: legacyStock }];
      }

      return [
        {
          color: legacyColors[0].trim(),
          stock: legacyStock,
        },
      ];
    })();

  const stock = colorStocks.reduce(
    (total, entry) => total + entry.stock,
    0
  );

  const createdAt = data.createdAt as
    | { toDate?: () => Date }
    | undefined;

  const updatedAt = data.updatedAt as
    | { toDate?: () => Date }
    | undefined;

  return {
    id,
    name: String(data.name ?? ""),
    category: String(data.category ?? ""),
    price: Number(data.price ?? 0),
    stock,
    colorStocks,
    colors: colorStocks
      .map((entry) => entry.color)
      .filter(Boolean),
    description: String(data.description ?? ""),
    image: images[0] ?? "",
    images,
    createdAt: createdAt?.toDate
      ? createdAt.toDate().toISOString()
      : null,
    updatedAt: updatedAt?.toDate
      ? updatedAt.toDate().toISOString()
      : null,
  };
}

export async function GET() {
  try {
    const snapshot = await adminDb
      .collection("products")
      .orderBy("createdAt", "desc")
      .get();

    const products = snapshot.docs.map((productDoc) =>
      serializeProduct(
        productDoc.id,
        productDoc.data() as UnknownRecord
      )
    );

    return NextResponse.json({ success: true, products });
  } catch (error) {
    console.error("GET /api/products error:", error);

    return NextResponse.json(
      { success: false, error: "Unable to load products." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ProductPayload;
    const validation = validateProduct(body);

    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }

    const productData = validation.data;

    const productRef = await adminDb.collection("products").add({
      ...productData,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json(
      {
        success: true,
        message: "Product created successfully.",
        product: { id: productRef.id, ...productData },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/products error:", error);

    return NextResponse.json(
      { success: false, error: "Unable to create product." },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as ProductPayload;
    const productId =
      typeof body.id === "string" ? body.id.trim() : "";

    if (!productId) {
      return NextResponse.json(
        { success: false, error: "Product ID is required." },
        { status: 400 }
      );
    }

    const validation = validateProduct(body);

    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }

    const productRef = adminDb.collection("products").doc(productId);
    const productSnapshot = await productRef.get();

    if (!productSnapshot.exists) {
      return NextResponse.json(
        { success: false, error: "Product not found." },
        { status: 404 }
      );
    }

    const productData = validation.data;

    await productRef.update({
      ...productData,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      message: "Product updated successfully.",
      product: { id: productId, ...productData },
    });
  } catch (error) {
    console.error("PUT /api/products error:", error);

    return NextResponse.json(
      { success: false, error: "Unable to update product." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("id")?.trim() ?? "";

    if (!productId) {
      return NextResponse.json(
        { success: false, error: "Product ID is required." },
        { status: 400 }
      );
    }

    const productRef = adminDb.collection("products").doc(productId);
    const productSnapshot = await productRef.get();

    if (!productSnapshot.exists) {
      return NextResponse.json(
        { success: false, error: "Product not found." },
        { status: 404 }
      );
    }

    await productRef.delete();

    return NextResponse.json({
      success: true,
      message: "Product deleted successfully.",
    });
  } catch (error) {
    console.error("DELETE /api/products error:", error);

    return NextResponse.json(
      { success: false, error: "Unable to delete product." },
      { status: 500 }
    );
  }
}