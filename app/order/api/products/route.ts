import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "../../../lib/firebase-admin";

interface ProductPayload {
  name?: unknown;
  category?: unknown;
  price?: unknown;
  stock?: unknown;
  description?: unknown;
  image?: unknown;
  images?: unknown;
}

const MAX_IMAGES = 20;

function cleanImages(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    )
  ).slice(0, MAX_IMAGES);
}

function isValidImageReference(value: string): boolean {
  // Accept hosted image URLs (including CDN URLs without a file extension)
  // and local public paths such as /products/example.jpg.
  if (!value || /\s/.test(value)) return false;
  if (value.startsWith("/")) return !value.startsWith("//");
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function validateProduct(body: ProductPayload) {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const category = typeof body.category === "string" ? body.category.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const legacyImage = typeof body.image === "string" ? body.image.trim() : "";
  const submittedImages = cleanImages(body.images);
  // Preserve compatibility with older clients that only send `image`.
  const images = Array.from(new Set([legacyImage, ...submittedImages].filter(Boolean))).slice(0, MAX_IMAGES);
  const image = images[0] ?? legacyImage;
  const price = Number(body.price);
  const stock = Number(body.stock);

  if (!name) return { valid: false as const, error: "Product name is required." };
  if (!category) return { valid: false as const, error: "Product category is required." };
  if (!Number.isFinite(price) || price < 0) return { valid: false as const, error: "Please enter a valid price." };
  if (!Number.isInteger(stock) || stock < 0) return { valid: false as const, error: "Stock must be a whole number and cannot be negative." };

  const allSubmittedImages = Array.from(new Set(
    [legacyImage, ...(Array.isArray(body.images) ? body.images : [])]
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean)
  ));
  if (allSubmittedImages.length > MAX_IMAGES) {
    return { valid: false as const, error: "You can add a maximum of 4 images per product." };
  }
  const invalidImage = allSubmittedImages.find((item) => !isValidImageReference(item));
  if (invalidImage) {
    return { valid: false as const, error: "Please enter a valid http(s) image URL or a local public image path." };
  }

  return {
    valid: true as const,
    data: { name, category, price, stock, description, image, images },
  };
}

// ======================================================
// GET PRODUCTS
// ======================================================

export async function GET() {
  try {
    const snapshot = await adminDb
      .collection("products")
      .orderBy("createdAt", "desc")
      .get();

    const products = snapshot.docs.map((productDoc) => {
      const data = productDoc.data();

      return {
        id: productDoc.id,
        name: String(data.name ?? ""),
        category: String(data.category ?? ""),
        price: Number(data.price ?? 0),
        stock: Number(data.stock ?? 0),
        description: String(data.description ?? ""),
        image: String(data.image ?? (Array.isArray(data.images) ? data.images[0] : "") ?? ""),
        images: cleanImages(data.images).length ? cleanImages(data.images) : (typeof data.image === "string" && data.image.trim() ? [data.image.trim()] : []),
        createdAt: data.createdAt?.toDate
          ? data.createdAt.toDate().toISOString()
          : null,
        updatedAt: data.updatedAt?.toDate
          ? data.updatedAt.toDate().toISOString()
          : null,
      };
    });

    return NextResponse.json({
      success: true,
      products,
    });
  } catch (error) {
    console.error("GET /api/products error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Unable to load products.",
      },
      { status: 500 }
    );
  }
}

// ======================================================
// CREATE PRODUCT
// ======================================================

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ProductPayload;

    const validation = validateProduct(body);

    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error,
        },
        { status: 400 }
      );
    }

    const productData = validation.data!;

    const productRef = await adminDb
      .collection("products")
      .add({
        ...productData,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

    return NextResponse.json(
      {
        success: true,
        message: "Product created successfully.",
        product: {
          id: productRef.id,
          ...productData,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/products error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Unable to create product.",
      },
      { status: 500 }
    );
  }
}

// ======================================================
// UPDATE PRODUCT
// ======================================================

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as ProductPayload & {
      id?: unknown;
    };

    const productId =
      typeof body.id === "string"
        ? body.id.trim()
        : "";

    if (!productId) {
      return NextResponse.json(
        {
          success: false,
          error: "Product ID is required.",
        },
        { status: 400 }
      );
    }

    const validation = validateProduct(body);

    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error,
        },
        { status: 400 }
      );
    }

    const productRef = adminDb
      .collection("products")
      .doc(productId);

    const productSnapshot = await productRef.get();

    if (!productSnapshot.exists) {
      return NextResponse.json(
        {
          success: false,
          error: "Product not found.",
        },
        { status: 404 }
      );
    }

    const productData = validation.data!;

    await productRef.update({
      ...productData,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      message: "Product updated successfully.",
      product: {
        id: productId,
        ...productData,
      },
    });
  } catch (error) {
    console.error("PUT /api/products error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Unable to update product.",
      },
      { status: 500 }
    );
  }
}

// ======================================================
// DELETE PRODUCT
// ======================================================

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const productId =
      searchParams.get("id")?.trim() ?? "";

    if (!productId) {
      return NextResponse.json(
        {
          success: false,
          error: "Product ID is required.",
        },
        { status: 400 }
      );
    }

    const productRef = adminDb
      .collection("products")
      .doc(productId);

    const productSnapshot = await productRef.get();

    if (!productSnapshot.exists) {
      return NextResponse.json(
        {
          success: false,
          error: "Product not found.",
        },
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
      {
        success: false,
        error: "Unable to delete product.",
      },
      { status: 500 }
    );
  }
}