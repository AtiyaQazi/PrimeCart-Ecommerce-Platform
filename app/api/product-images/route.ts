import { NextRequest, NextResponse } from "next/server";
import { readdir } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif"]);
const MAX_IMAGES = 20;

function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function GET(request: NextRequest) {
  const name = (request.nextUrl.searchParams.get("name") ?? "").slice(0, 180);
  const id = (request.nextUrl.searchParams.get("id") ?? "").slice(0, 180);
  if (!name && !id) {
    return NextResponse.json({ images: [] }, { status: 400 });
  }

  try {
    const directory = path.join(process.cwd(), "public", "products");
    const files = await readdir(directory, { withFileTypes: true });
    const validFiles = files
      .filter((file) => file.isFile() && IMAGE_EXTENSIONS.has(path.extname(file.name).toLowerCase()))
      .map((file) => file.name);

    const wanted = [slugify(name), slugify(id)].filter(Boolean);
    const ranked = validFiles
      .map((file) => {
        const stem = slugify(file);
        let rank = Number.POSITIVE_INFINITY;
        for (const base of wanted) {
          if (stem === base) rank = Math.min(rank, 0);
          else if (new RegExp(`^${base}-(?:[2-5]|0?[1-5])$`).test(stem)) rank = Math.min(rank, 1 + Number(stem.match(/(\d+)$/)?.[1] ?? 1));
          else if (new RegExp(`^${base}(?:[1-5])$`).test(stem)) rank = Math.min(rank, 1 + Number(stem.match(/(\d+)$/)?.[1] ?? 1));
        }
        return { file, rank };
      })
      .filter((item) => Number.isFinite(item.rank))
      .sort((a, b) => a.rank - b.rank || a.file.localeCompare(b.file, undefined, { numeric: true }));

    const images = Array.from(new Set(ranked.map(({ file }) => `/products/${file}`))).slice(0, MAX_IMAGES);
    return NextResponse.json({ images }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Unable to scan public/products:", error);
    return NextResponse.json({ images: [] }, { status: 200 });
  }
}
