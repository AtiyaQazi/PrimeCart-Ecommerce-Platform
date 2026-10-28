interface StatusBadgeProps {
  status: string;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  let badgeClass = "";

  if (status === "Completed") {
    badgeClass = "bg-[#dce9dc] text-[#2f4f3e]";
  } else if (status === "Processing") {
    badgeClass = "bg-[#e5eadf] text-[#536b55]";
  } else if (status === "Pending") {
    badgeClass = "bg-[#f2e4c9] text-[#8a672e]";
  } else {
    badgeClass = "bg-[#e8e3da] text-[#55504a]";
  }

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${badgeClass}`}
    >
      {status}
    </span>
  );
}