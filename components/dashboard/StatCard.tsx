interface StatCardProps {
  title: string;
  value: string;
  change: string;
  trend: string;
}

export default function StatCard({
  title,
  value,
  change,
  trend,
}: StatCardProps) {
  return (
    <div className="rounded-2xl border border-[#ded4c3] bg-[#fbf8f2] p-5 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-md">
      <p className="text-sm font-medium text-[#6c675f]">{title}</p>

      <div className="mt-3 flex items-end justify-between gap-3">
        <h3 className="text-2xl font-bold text-[#2f4f3e]">{value}</h3>

        <span
          className={`text-sm font-semibold ${
            trend === "up" ? "text-[#4d7655]" : "text-red-600"
          }`}
        >
          {trend === "up" ? "↑" : "↓"} {change}
        </span>
      </div>

      <p className="mt-2 text-xs text-[#8b857c]">
        Compared to last month
      </p>
    </div>
  );
}