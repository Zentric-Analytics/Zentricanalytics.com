import Link from "next/link";
import {
  ArrowRight,
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
    <div className="mt-6">
      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-x-10 gap-y-4 md:grid-cols-2 md:gap-y-5">
        {industries.map(({ Icon, title }) => (
          <Link
            className="group flex min-h-14 cursor-pointer items-center gap-4 text-left text-[#0B1F3A] no-underline transition-colors duration-200 ease-out hover:text-[#10B981] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#10B981]"
            href="/industries"
            key={title}
          >
            <Icon
              aria-hidden="true"
              className="size-7 shrink-0 text-[#0B1F3A] transition-colors duration-200 ease-out group-hover:text-[#10B981]"
              strokeWidth={1.75}
            />
            <span className="text-lg font-bold leading-[1.2] tracking-[-0.03em] sm:text-xl">
              {title}
            </span>
            <ArrowRight
              aria-hidden="true"
              className="ml-auto size-5 shrink-0 translate-x-[-8px] text-[#10B981] opacity-0 transition-[opacity,transform] duration-200 ease-out group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100"
              strokeWidth={1.8}
            />
          </Link>
        ))}
      </div>

      <div className="mt-6 flex justify-center">
        <Link className="btn zentric-primary-cta" href="/industries">
          <span>Explore All Industries</span>
          <span className="zentric-primary-cta__arrow" aria-hidden="true">
            →
          </span>
        </Link>
      </div>
    </div>
  );
}
