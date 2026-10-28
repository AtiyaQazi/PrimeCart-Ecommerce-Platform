"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { salesData } from "../../data/dashboardData";

export default function SalesOverview() {
  return (
    <div className="rounded-2xl border border-[#ded4c3] bg-[#fbf8f2] p-5 shadow-sm">
      <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-lg font-bold text-[#2f4f3e]">
            Sales Overview
          </h2>

          <p className="mt-1 text-sm text-[#6c675f]">
            Monthly sales performance
          </p>
        </div>

        <select
          defaultValue="2026"
          className="rounded-lg border border-[#ded4c3] bg-[#f3eadb] px-3 py-2 text-sm text-[#171717] outline-none focus:border-[#2f4f3e]"
        >
          <option value="2026">2026</option>
          <option value="2025">2025</option>
          <option value="2024">2024</option>
        </select>
      </div>

      <div className="h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={salesData}
            margin={{
              top: 10,
              right: 10,
              left: 0,
              bottom: 0,
            }}
          >
            <defs>
              <linearGradient
                id="salesGradient"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor="#2f4f3e" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#6f8f72" stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="#ded4c3"
            />

            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12 }}
            />

            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => `$${value / 1000}k`}
            />

            <Tooltip
              contentStyle={{
                borderRadius: "12px",
                border: "1px solid #ded4c3",
                backgroundColor: "#fbf8f2",
              }}
              formatter={(value) => [
                `$${Number(value).toLocaleString()}`,
                "Sales",
              ]}
            />

            <Area
              type="monotone"
              dataKey="sales"
              stroke="#2f4f3e"
              strokeWidth={3}
              fill="url(#salesGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}