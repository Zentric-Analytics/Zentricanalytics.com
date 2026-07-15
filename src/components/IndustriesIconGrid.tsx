import Link from "next/link";
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
        <Link
          className="group flex min-h-[104px] cursor-pointer items-center gap-4 rounded-[16px] border border-[#DCE3EA] bg-white p-5 text-left text-[#0B1F3A] no-underline shadow-[0_8px_22px_rgba(11,31,58,0.04)] transition-[border-color,box-shadow,transform,color] duration-200 ease-out hover:-translate-y-0.5 hover:border-[#10B981]/45 hover:text-[#10B981] hover:shadow-[0_14px_30px_rgba(11,31,58,0.08)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#10B981] motion-reduce:hover:translate-y-0"
          href="/industries"
          key={title}
        >
          <Icon
            aria-hidden="true"
            className="size-7 shrink-0 text-[#0B1F3A] transition-colors duration-200 ease-out group-hover:text-[#10B981]"
            strokeWidth={1.75}
          />
          <span className="text-base font-bold leading-[1.2] tracking-[-0.03em] sm:text-lg">
            {title}
          </span>
        </Link>
      ))}
    </div>
  );
}
