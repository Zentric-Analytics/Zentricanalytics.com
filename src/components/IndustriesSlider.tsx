"use client";

import {
  memo,
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

const AUTOPLAY_DELAY = 7000;
const RESUME_DELAY = 3000;
const TRANSITION_DURATION = 600;
const carouselIndustries = [...industries, ...industries, ...industries];

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function easeInOutCubic(progress: number) {
  return progress < 0.5
    ? 4 * progress * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 3) / 2;
}

const IndustryCard = memo(function IndustryCard({
  industry,
  isClone,
}: {
  industry: Industry;
  isClone: boolean;
}) {
  return (
    <article
      aria-hidden={isClone}
      className="group flex min-w-[84vw] snap-start flex-col rounded-2xl border border-[#E5E7EB] bg-white p-5 text-left transition-[border-color] duration-200 ease-out hover:border-[#10B981]/55 focus-within:border-[#10B981]/70 sm:min-w-[calc((100%-18px)/2)] md:min-w-[calc((100%-36px)/3)] lg:min-w-[320px] lg:max-w-[320px]"
      data-industry-card=""
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
  );
});

export function IndustriesSlider() {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const autoplayTimeoutRef = useRef<number | null>(null);
  const resumeTimeoutRef = useRef<number | null>(null);
  const isVisibleRef = useRef(false);
  const isInteractingRef = useRef(false);
  const reducedMotionRef = useRef(false);
  const [canScrollPrevious, setCanScrollPrevious] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(true);

  const getCardStep = useCallback(() => {
    const scroller = scrollerRef.current;

    if (!scroller) {
      return 0;
    }

    const firstCard = scroller.querySelector<HTMLElement>(
      "[data-industry-card]",
    );
    const columnGap = Number.parseFloat(getComputedStyle(scroller).columnGap);
    const gap = Number.isNaN(columnGap) ? 18 : columnGap;

    return firstCard ? firstCard.offsetWidth + gap : scroller.clientWidth * 0.8;
  }, []);

  const stopAnimation = useCallback(() => {
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  const clearTimers = useCallback(() => {
    if (autoplayTimeoutRef.current !== null) {
      window.clearTimeout(autoplayTimeoutRef.current);
      autoplayTimeoutRef.current = null;
    }

    if (resumeTimeoutRef.current !== null) {
      window.clearTimeout(resumeTimeoutRef.current);
      resumeTimeoutRef.current = null;
    }
  }, []);

  const normalizeScrollPosition = useCallback(() => {
    const scroller = scrollerRef.current;
    const step = getCardStep();

    if (!scroller || step === 0) {
      return;
    }

    const setWidth = step * industries.length;
    const lowerBoundary = setWidth * 0.5;
    const upperBoundary = setWidth * 1.5;

    if (scroller.scrollLeft < lowerBoundary) {
      scroller.scrollLeft += setWidth;
    } else if (scroller.scrollLeft >= upperBoundary) {
      scroller.scrollLeft -= setWidth;
    }
  }, [getCardStep]);

  const updateScrollState = useCallback(() => {
    const scroller = scrollerRef.current;

    if (!scroller) {
      return;
    }

    const canScroll = scroller.scrollWidth > scroller.clientWidth + 2;
    setCanScrollPrevious(canScroll);
    setCanScrollNext(canScroll);
  }, []);

  const animateTo = useCallback(
    (targetScrollLeft: number, onComplete?: () => void) => {
      const scroller = scrollerRef.current;

      if (!scroller) {
        return;
      }

      stopAnimation();

      if (prefersReducedMotion()) {
        scroller.scrollLeft = targetScrollLeft;
        onComplete?.();
        return;
      }

      const startScrollLeft = scroller.scrollLeft;
      const distance = targetScrollLeft - startScrollLeft;
      const startTime = performance.now();
      const previousScrollBehavior = scroller.style.scrollBehavior;
      scroller.style.scrollBehavior = "auto";

      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / TRANSITION_DURATION, 1);
        scroller.scrollLeft =
          startScrollLeft + distance * easeInOutCubic(progress);

        if (progress < 1) {
          animationFrameRef.current = window.requestAnimationFrame(animate);
          return;
        }

        animationFrameRef.current = null;
        scroller.style.scrollBehavior = previousScrollBehavior;
        onComplete?.();
      };

      animationFrameRef.current = window.requestAnimationFrame(animate);
    },
    [stopAnimation],
  );

  const scrollIndustries = useCallback(
    (direction: "previous" | "next") => {
      const scroller = scrollerRef.current;
      const step = getCardStep();

      if (!scroller || step === 0) {
        return;
      }

      clearTimers();
      normalizeScrollPosition();

      const targetScrollLeft =
        scroller.scrollLeft + (direction === "next" ? step : -step);

      animateTo(targetScrollLeft, normalizeScrollPosition);
    },
    [animateTo, clearTimers, getCardStep, normalizeScrollPosition],
  );

  const scheduleAutoplay = useCallback(() => {
    clearTimers();

    if (
      reducedMotionRef.current ||
      !isVisibleRef.current ||
      isInteractingRef.current
    ) {
      return;
    }

    autoplayTimeoutRef.current = window.setTimeout(() => {
      scrollIndustries("next");
      scheduleAutoplay();
    }, AUTOPLAY_DELAY);
  }, [clearTimers, scrollIndustries]);

  const pauseAutoplay = useCallback(() => {
    isInteractingRef.current = true;
    clearTimers();
    stopAnimation();
  }, [clearTimers, stopAnimation]);

  const resumeAutoplay = useCallback(() => {
    isInteractingRef.current = false;
    clearTimers();

    if (reducedMotionRef.current || !isVisibleRef.current) {
      return;
    }

    resumeTimeoutRef.current = window.setTimeout(scheduleAutoplay, RESUME_DELAY);
  }, [clearTimers, scheduleAutoplay]);

  useEffect(() => {
    const scroller = scrollerRef.current;

    if (!scroller) {
      return;
    }

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleMotionChange = () => {
      reducedMotionRef.current = motionQuery.matches;
      if (motionQuery.matches) {
        clearTimers();
        stopAnimation();
      } else {
        scheduleAutoplay();
      }
    };

    reducedMotionRef.current = motionQuery.matches;
    scroller.scrollLeft = getCardStep() * industries.length;
    updateScrollState();

    const observer = new IntersectionObserver(
      ([entry]) => {
        isVisibleRef.current = entry.isIntersecting;
        if (entry.isIntersecting) {
          scheduleAutoplay();
        } else {
          clearTimers();
          stopAnimation();
        }
      },
      { threshold: 0.35 },
    );

    const handleScroll = () => {
      updateScrollState();
      if (animationFrameRef.current === null) {
        normalizeScrollPosition();
      }
    };

    const handleResize = () => {
      scroller.scrollLeft = getCardStep() * industries.length;
      updateScrollState();
    };

    observer.observe(scroller);
    scroller.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleResize);
    motionQuery.addEventListener("change", handleMotionChange);

    return () => {
      observer.disconnect();
      scroller.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
      motionQuery.removeEventListener("change", handleMotionChange);
      clearTimers();
      stopAnimation();
    };
  }, [
    clearTimers,
    getCardStep,
    normalizeScrollPosition,
    scheduleAutoplay,
    stopAnimation,
    updateScrollState,
  ]);

  return (
    <div className="relative mt-6 overflow-hidden">
      <div className="absolute right-0 top-0 z-10 flex justify-end gap-2">
        <button
          aria-label="Previous industries"
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#CBD5E1] bg-white px-3 text-sm font-semibold text-[#0B1F3A] transition-colors duration-200 ease-out hover:border-[#94A3B8] hover:bg-[#F8FAFC] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#10B981] disabled:cursor-not-allowed disabled:border-[#E5E7EB] disabled:text-[#94A3B8] disabled:hover:bg-white"
          disabled={!canScrollPrevious}
          onClick={() => {
            pauseAutoplay();
            scrollIndustries("previous");
            resumeAutoplay();
          }}
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
          onClick={() => {
            pauseAutoplay();
            scrollIndustries("next");
            resumeAutoplay();
          }}
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
        onMouseEnter={pauseAutoplay}
        onMouseLeave={resumeAutoplay}
        onPointerCancel={resumeAutoplay}
        onPointerDown={pauseAutoplay}
        onPointerUp={resumeAutoplay}
        ref={scrollerRef}
        role="region"
      >
        {carouselIndustries.map((industry, index) => (
          <IndustryCard
            industry={industry}
            isClone={
              index < industries.length || index >= industries.length * 2
            }
            key={`${industry.title}-${index}`}
          />
        ))}
      </div>
    </div>
  );
}
