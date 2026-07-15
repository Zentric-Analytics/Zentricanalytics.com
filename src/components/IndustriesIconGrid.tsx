import {
  Building2,
  Factory,
  GraduationCap,
  HeartPulse,
  Landmark,
  Truck,
  type LucideIcon,
} from "lucide-react";

const industries: Array<{ Icon: LucideIcon; title: string }> = [
  {
    title: "Healthcare",
    Icon: HeartPulse,
  },
  {
    title: "Financial Services",
    Icon: Landmark,
  },
  {
    title: "Government & Public Sector",
    Icon: Building2,
  },
  {
    title: "Education",
    Icon: GraduationCap,
  },
  {
    title: "Manufacturing",
    Icon: Factory,
  },
  {
    title: "Logistics & Supply Chain",
    Icon: Truck,
  },
];

export function IndustriesIconGrid() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:gap-5">
      {industries.map(({ Icon, title }) => (
        <div
          className="flex min-h-[104px] items-center gap-4 rounded-[16px] border border-[#DCE3EA] bg-white p-5 text-left text-[#0B1F3A]"
          key={title}
        >
          <Icon
            aria-hidden="true"
            className="size-7 shrink-0 text-[#0B1F3A]"
            strokeWidth={1.75}
          />
          <span className="text-base font-bold leading-[1.2] tracking-[-0.03em] sm:text-lg">
            {title}
          </span>
        </div>
      ))}
    </div>
  );
}
