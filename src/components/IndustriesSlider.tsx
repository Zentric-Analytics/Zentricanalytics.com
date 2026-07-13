"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentType,
} from "react";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  Factory,
  GraduationCap,
  HeartPulse,
  Landmark,
  Truck,
  type LucideProps,
} from "lucide-react";

type Industry = {
  Icon: ComponentType<LucideProps>;
  title: string;
  description: string;
};

const industries: Industry[] = [
  {
    title: "Healthcare",
    description:
      "Reliable digital platforms, secure data systems, and intelligent healthcare technology that improve operational efficiency.",
    Icon: HeartPulse,
  },
  {
    title: "Financial Services",
    description:
      "Modern software, analytics, and secure digital solutions built for financial institutions and business operations.",
    Icon: Landmark,
  },
  {
    title: "Government & Public Sector",
    description:
      "Scalable digital platforms and technology solutions that support efficient public service delivery.",
    Icon: Building2,
  },
  {
    title: "Education",
    description:
      "Modern learning platforms, institutional systems, analytics, and digital transformation for education.",
    Icon: GraduationCap,
  },
  {
    title: "Manufacturing",
    description:
      "Engineering software and intelligent systems that improve operational visibility, automation, and productivity.",
    Icon: Factory,
  },
  {
    title: "Logistics & Supply Chain",
    description:
      "Technology solutions that optimize movement, visibility, planning, and operational decision-making.",
    Icon: Truck,
  },
];

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function IndustriesSlider() {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canScrollPrevious, setCanScrollPrevious] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(true);

  const updateScrollState = useCallback(() => {
    const scroller = scrollerRef.current;

    if (!scroller) {
      return;
    }

    const maxScrollLeft = scroller.scrollWidth - scroller.clientWidth;
    setCanScrollPrevious(scroller.scrollLeft > 2);
    setCanScrollNext(scroller.scrollLeft < maxScrollLeft - 2);
  }, []);

  const scrollIndustries = useCallback((direction: "previous" | "next") => {
    const scroller = scrollerRef.current;

    if (!scroller) {
      return;
    }

    const firstCard = scroller.querySelector<HTMLElement>(
      "[data-industry-card]",
    );
    const gap = 18;
    const scrollAmount = firstCard
      ? firstCard.offsetWidth + gap
      : scroller.clientWidth * 0.8;

    scroller.scrollBy({
      left: direction === "next" ? scrollAmount : -scrollAmount,
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  }, []);

  useEffect(() => {
    const scroller = scrollerRef.current;

    if (!scroller) {
      return;
    }

    updateScrollState();
    scroller.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);

    return () => {
      scroller.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [updateScrollState]);

  return (
    <div className="relative mt-6 overflow-hidden">
      <div className="absolute right-0 top-0 z-10 flex justify-end gap-2">
        <button
          aria-label="Previous industries"
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#CBD5E1] bg-white px-3 text-sm font-semibold text-[#0B1F3A] transition-colors duration-200 ease-out hover:border-[#94A3B8] hover:bg-[#F8FAFC] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#10B981] disabled:cursor-not-allowed disabled:border-[#E5E7EB] disabled:text-[#94A3B8] disabled:hover:bg-white"
          disabled={!canScrollPrevious}
          onClick={() => scrollIndustries("previous")}
          type="button"
        >
          <ChevronLeft
            aria-hidden="true"
            className="size-4"
            strokeWidth={1.8}
          />
          <span className="hidden sm:inline">Previous</span>
        </button>
        <button
          aria-label="Next industries"
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#CBD5E1] bg-white px-3 text-sm font-semibold text-[#0B1F3A] transition-colors duration-200 ease-out hover:border-[#94A3B8] hover:bg-[#F8FAFC] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#10B981] disabled:cursor-not-allowed disabled:border-[#E5E7EB] disabled:text-[#94A3B8] disabled:hover:bg-white"
          disabled={!canScrollNext}
          onClick={() => scrollIndustries("next")}
          type="button"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight
            aria-hidden="true"
            className="size-4"
            strokeWidth={1.8}
          />
        </button>
      </div>

      <div
        aria-label="Industries carousel"
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain scroll-smooth pb-2 pr-[12vw] [scrollbar-width:none] motion-reduce:scroll-auto sm:gap-[18px] sm:pr-[18vw] md:pr-0 [&::-webkit-scrollbar]:hidden"
        ref={scrollerRef}
        role="region"
      >
        {industries.map((industry) => (
          <article
            className="group flex min-w-[84vw] snap-start flex-col rounded-2xl border border-[#E5E7EB] bg-white p-5 text-left transition-[border-color] duration-200 ease-out hover:border-[#10B981]/55 focus-within:border-[#10B981]/70 sm:min-w-[calc((100%-18px)/2)] md:min-w-[calc((100%-36px)/3)] lg:min-w-[320px] lg:max-w-[320px]"
            data-industry-card=""
            key={industry.title}
          >
            <industry.Icon
              aria-hidden="true"
              className="size-[22px] shrink-0 text-[#0B1F3A] transition-colors duration-200 ease-out group-hover:text-[#10B981]"
              strokeWidth={1.75}
            />
            <h3 className="mt-3.5 text-[1.125rem] font-bold leading-[1.2] tracking-[-0.03em] text-[#0B1F3A] sm:text-[1.25rem]">
              {industry.title}
            </h3>
            <p className="mt-2 max-w-[34rem] text-[0.9375rem] leading-[1.55] text-[#475569] sm:text-base">
              {industry.description}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}
