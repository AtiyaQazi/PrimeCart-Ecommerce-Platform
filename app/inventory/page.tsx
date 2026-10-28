"use client";

import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "../../components/layout/DashboardLayout";

import {
  collection,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";

import { db } from "../../lib/firestore";
import { getProductImage } from "../../lib/productImages";

import {
  AlertTriangle,
  Package,
  Search,
  Warehouse,
  XCircle,
} from "lucide-react";

interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  description: string;
  image: string;
  createdAt?: unknown;
}

function formatPrice(price: number) {
  return `Rs. ${Math.round(price).toLocaleString("en-PK")}`;
}

function ProductImage({
  src,
  alt,
}: {
  src?: string;
  alt: string;
}) {
  const [imageError, setImageError] =
    useState(false);

  useEffect(() => {
    setImageError(false);
  }, [src]);

  if (!src || imageError) {
    return (
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#F1EEE7] text-[#8A8D89]">
        <Package size={23} />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      onError={() => setImageError(true)}
      className="h-14 w-14 shrink-0 rounded-xl object-cover"
    />
  );
}

export default function InventoryPage() {
  const [products, setProducts] =
    useState<Product[]>([]);

  const [search, setSearch] =
    useState("");

  const [categoryFilter, setCategoryFilter] =
    useState("All");

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  /*
  |--------------------------------------------------------------------------
  | LOAD PRODUCTS
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    const productsQuery = query(
      collection(db, "products"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      productsQuery,
      (snapshot) => {
        const productData: Product[] =
          snapshot.docs.map((productDoc) => {
            const data =
              productDoc.data();

            const name = String(
              data.name ?? ""
            ).trim();

            const firestoreImage =
              String(
                data.image ?? ""
              ).trim();

            return {
              id: productDoc.id,

              name,

              category: String(
                data.category ?? ""
              ),

              price: Number(
                data.price ?? 0
              ),

              stock: Number(
                data.stock ?? 0
              ),

              description: String(
                data.description ?? ""
              ),

              /*
              IMPORTANT:
              Firestore image first.
              Local mapped image as fallback.
              */
              image: getProductImage(
                name,
                firestoreImage
              ),

              createdAt:
                data.createdAt,
            };
          });

        setProducts(productData);
        setLoading(false);
        setError("");
      },
      (snapshotError) => {
        console.error(
          "Inventory error:",
          snapshotError
        );

        setError(
          "Unable to load inventory."
        );

        setLoading(false);
      }
    );

    return () =>
      unsubscribe();
  }, []);

  /*
  |--------------------------------------------------------------------------
  | CATEGORIES
  |--------------------------------------------------------------------------
  */

  const categories = useMemo(() => {
    const values = Array.from(
      new Set(
        products
          .map((product) =>
            product.category.trim()
          )
          .filter(Boolean)
      )
    );

    return ["All", ...values];
  }, [products]);

  /*
  |--------------------------------------------------------------------------
  | FILTER
  |--------------------------------------------------------------------------
  */

  const filteredProducts =
    useMemo(() => {
      const searchValue =
        search
          .trim()
          .toLowerCase();

      return products.filter(
        (product) => {
          const matchesCategory =
            categoryFilter ===
              "All" ||
            product.category
              .toLowerCase() ===
              categoryFilter.toLowerCase();

          if (!matchesCategory) {
            return false;
          }

          if (!searchValue) {
            return true;
          }

          return (
            product.name
              .toLowerCase()
              .includes(searchValue) ||
            product.category
              .toLowerCase()
              .includes(searchValue) ||
            product.description
              .toLowerCase()
              .includes(searchValue)
          );
        }
      );
    }, [
      products,
      search,
      categoryFilter,
    ]);

  /*
  |--------------------------------------------------------------------------
  | STATS
  |--------------------------------------------------------------------------
  */

  const totalProducts =
    products.length;

  const totalStock =
    products.reduce(
      (total, product) =>
        total + product.stock,
      0
    );

  const lowStockProducts =
    products.filter(
      (product) =>
        product.stock > 0 &&
        product.stock <= 10
    );

  const outOfStockProducts =
    products.filter(
      (product) =>
        product.stock <= 0
    );

  /*
  |--------------------------------------------------------------------------
  | STOCK STATUS
  |--------------------------------------------------------------------------
  */

  function getStockStatus(
    stock: number
  ) {
    if (stock <= 0) {
      return {
        label: "Out of stock",
        className:
          "bg-red-100 text-red-700",
      };
    }

    if (stock <= 10) {
      return {
        label: "Low stock",
        className:
          "bg-amber-100 text-amber-700",
      };
    }

    return {
      label: "In stock",
      className:
        "bg-[#E6F3EC] text-[#286044]",
    };
  }

  /*
  |--------------------------------------------------------------------------
  | UI
  |--------------------------------------------------------------------------
  */

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-[#F4EBDD] p-4 sm:p-6 lg:p-8">

        {/* HEADER */}

        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-[#111111]">
            Inventory
          </h1>

          <p className="mt-2 text-sm text-[#6B706C]">
            Monitor product stock levels and inventory status.
          </p>
        </div>

        {/* STATS */}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#6B706C]">
                  Total Products
                </p>

                <p className="mt-2 text-3xl font-bold text-[#111111]">
                  {totalProducts}
                </p>
              </div>

              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#E8F2EC] text-[#173F35]">
                <Package size={23} />
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#6B706C]">
                  Total Stock
                </p>

                <p className="mt-2 text-3xl font-bold text-[#111111]">
                  {totalStock}
                </p>
              </div>

              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#E8F2EC] text-[#173F35]">
                <Warehouse size={23} />
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#6B706C]">
                  Low Stock
                </p>

                <p className="mt-2 text-3xl font-bold text-[#111111]">
                  {lowStockProducts.length}
                </p>
              </div>

              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <AlertTriangle size={23} />
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#6B706C]">
                  Out of Stock
                </p>

                <p className="mt-2 text-3xl font-bold text-[#111111]">
                  {outOfStockProducts.length}
                </p>
              </div>

              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-red-600">
                <XCircle size={23} />
              </div>
            </div>
          </div>

        </div>

        {/* SEARCH */}

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
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder="Search products or categories..."
                className="w-full rounded-xl border border-[#D8D4CB] bg-[#FBF9F5] py-3 pl-11 pr-10 text-sm text-[#111111] outline-none transition placeholder:text-[#8A8D89] focus:border-[#355E4B] focus:ring-2 focus:ring-[#355E4B]/10"
              />

              {search && (
                <button
                  type="button"
                  onClick={() =>
                    setSearch("")
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-[#777C77] hover:bg-[#EEEAE1]"
                >
                  <XCircle size={18} />
                </button>
              )}

            </div>

            <select
              value={categoryFilter}
              onChange={(event) =>
                setCategoryFilter(
                  event.target.value
                )
              }
              className="rounded-xl border border-[#D8D4CB] bg-[#FBF9F5] px-4 py-3 text-sm font-medium text-[#222222] outline-none focus:border-[#355E4B] focus:ring-2 focus:ring-[#355E4B]/10"
            >
              {categories.map(
                (category) => (
                  <option
                    key={category}
                    value={category}
                  >
                    {category ===
                    "All"
                      ? "All Categories"
                      : category}
                  </option>
                )
              )}
            </select>

          </div>
        </div>

        {/* TABLE */}

        <div className="mt-6 overflow-hidden rounded-2xl bg-white shadow-sm">

          <div className="border-b border-[#ECE7DE] px-5 py-5">
            <h2 className="text-lg font-bold text-[#111111]">
              Stock Overview
            </h2>

            <p className="mt-1 text-sm text-[#727771]">
              {filteredProducts.length}{" "}
              product
              {filteredProducts.length !==
              1
                ? "s"
                : ""}{" "}
              found
            </p>
          </div>

          {loading ? (
            <div className="flex min-h-64 items-center justify-center">
              <div className="flex items-center gap-3 text-sm font-medium text-[#68706A]">
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#D8D4CB] border-t-[#355E4B]" />
                Loading inventory...
              </div>
            </div>
          ) : error ? (
            <div className="flex min-h-64 items-center justify-center px-6 text-center">
              <div>
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-500">
                  <XCircle size={25} />
                </div>

                <p className="mt-4 font-semibold text-red-600">
                  {error}
                </p>

                <p className="mt-2 text-sm text-[#777C77]">
                  Please refresh the page and try again.
                </p>
              </div>
            </div>
          ) : filteredProducts.length ===
            0 ? (
            <div className="flex min-h-64 items-center justify-center px-6 text-center">
              <div>
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#F1EEE7] text-[#6C746D]">
                  <Package size={25} />
                </div>

                <h3 className="mt-4 font-semibold text-[#222222]">
                  No inventory found
                </h3>

                <p className="mt-2 text-sm text-[#777C77]">
                  Try changing your search or category filter.
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">

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
                      Stock
                    </th>

                    <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide text-[#777C77]">
                      Status
                    </th>

                  </tr>
                </thead>

                <tbody>

                  {filteredProducts.map(
                    (product) => {
                      const stockStatus =
                        getStockStatus(
                          product.stock
                        );

                      const image =
                        getProductImage(
                          product.name,
                          product.image
                        );

                      return (
                        <tr
                          key={product.id}
                          className="border-b border-[#F0ECE4] last:border-b-0 hover:bg-[#FCFAF6]"
                        >

                          <td className="px-5 py-4">

                            <div className="flex items-center gap-4">

                              <ProductImage
                                src={image}
                                alt={
                                  product.name
                                }
                              />

                              <div className="min-w-0">

                                <p className="font-semibold text-[#222222]">
                                  {
                                    product.name
                                  }
                                </p>

                                {product.description && (
                                  <p className="mt-1 max-w-xs truncate text-xs text-[#818681]">
                                    {
                                      product.description
                                    }
                                  </p>
                                )}

                              </div>

                            </div>

                          </td>

                          <td className="px-5 py-4 text-sm text-[#555C56]">
                            {product.category ||
                              "—"}
                          </td>

                          <td className="px-5 py-4">
                            <span className="text-sm font-bold text-[#222222]">
                              {formatPrice(
                                product.price
                              )}
                            </span>
                          </td>

                          <td className="px-5 py-4">

                            <div className="flex items-center gap-2">

                              <span
                                className={`text-sm font-bold ${
                                  product.stock <=
                                  0
                                    ? "text-red-600"
                                    : product.stock <=
                                      10
                                    ? "text-amber-600"
                                    : "text-[#286044]"
                                }`}
                              >
                                {
                                  product.stock
                                }
                              </span>

                              <span className="text-xs text-[#8A8D89]">
                                units
                              </span>

                            </div>

                          </td>

                          <td className="px-5 py-4">

                            <span
                              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${stockStatus.className}`}
                            >
                              {
                                stockStatus.label
                              }
                            </span>

                          </td>

                        </tr>
                      );
                    }
                  )}

                </tbody>

              </table>
            </div>
          )}

        </div>

      </div>
    </DashboardLayout>
  );
}