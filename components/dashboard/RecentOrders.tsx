
import Link from "next/link";
import { recentOrders } from "../../data/dashboardData";
import StatusBadge from "../ui/StatusBadge";

export default function RecentOrders() {
  return (
    <div className="rounded-2xl border border-[#ded4c3] bg-[#fbf8f2] p-5 shadow-sm">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[#2f4f3e]">
            Recent Orders
          </h2>

          <p className="mt-1 text-sm text-[#6c675f]">
            Latest customer orders
          </p>
        </div>

        <Link
          href="/orders"
          className="rounded-lg px-3 py-2 text-sm font-semibold text-[#2f4f3e] transition hover:bg-[#f3eadb]"
        >
          View All
        </Link>
      </div>

      {/* DESKTOP TABLE */}

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#ded4c3] text-left">
              <th className="pb-3 text-xs font-semibold uppercase tracking-wide text-[#8b857c]">
                Order
              </th>
              <th className="pb-3 text-xs font-semibold uppercase tracking-wide text-[#8b857c]">
                Customer
              </th>
              <th className="pb-3 text-xs font-semibold uppercase tracking-wide text-[#8b857c]">
                Product
              </th>
              <th className="pb-3 text-xs font-semibold uppercase tracking-wide text-[#8b857c]">
                Amount
              </th>
              <th className="pb-3 text-xs font-semibold uppercase tracking-wide text-[#8b857c]">
                Status
              </th>
            </tr>
          </thead>

          <tbody>
            {recentOrders.map((order) => (
              <tr
                key={order.id}
                className="border-b border-[#ded4c3] last:border-0"
              >
                <td className="py-4 text-sm font-semibold text-[#2f4f3e]">
                  {order.id}
                </td>

                <td className="py-4 text-sm text-[#5f5a53]">
                  {order.customer}
                </td>

                <td className="py-4 text-sm text-[#5f5a53]">
                  {order.product}
                </td>

                <td className="py-4 text-sm font-semibold text-[#171717]">
                  {order.amount}
                </td>

                <td className="py-4">
                  <StatusBadge status={order.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MOBILE CARDS */}

      <div className="space-y-3 md:hidden">
        {recentOrders.map((order) => (
          <div
            key={order.id}
            className="rounded-xl border border-[#ded4c3] bg-[#f3eadb] p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-[#2f4f3e]">
                  {order.id}
                </p>

                <p className="mt-1 text-sm text-[#5f5a53]">
                  {order.customer}
                </p>
              </div>

              <StatusBadge status={order.status} />
            </div>

            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-xs text-[#8b857c]">
                {order.product}
              </p>

              <p className="text-sm font-bold text-[#171717]">
                {order.amount}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
