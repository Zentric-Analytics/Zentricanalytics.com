import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react';

type CardVariant = 'standard' | 'capability' | 'featured';

type DesignSystemCardProps<T extends ElementType> = {
  as?: T;
  variant?: CardVariant;
  interactive?: boolean;
  className?: string;
  children: ReactNode;
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'className' | 'children'>;

const variantClasses: Record<CardVariant, string> = {
  standard:
    'rounded-[20px] p-5 shadow-[0_8px_24px_rgba(11,31,58,0.06)] sm:p-6 lg:p-7',
  capability:
    'rounded-[20px] p-5 shadow-[0_8px_24px_rgba(11,31,58,0.06)] sm:p-6 lg:p-7',
  featured:
    'rounded-[20px] p-5 shadow-[0_12px_30px_rgba(11,31,58,0.08)] sm:p-6 lg:p-8',
};

export function DesignSystemCard<T extends ElementType = 'article'>({
  as,
  variant = 'standard',
  interactive = false,
  className = '',
  children,
  ...props
}: DesignSystemCardProps<T>) {
  const Component = as ?? 'article';
  const interactiveClasses = interactive
    ? 'cursor-pointer transition-[border-color,box-shadow,transform] duration-200 ease-out motion-safe:hover:-translate-y-0.5 hover:border-[#10B981]/55 hover:shadow-[0_16px_36px_rgba(11,31,58,0.10)] focus-visible:border-[#10B981]/70 focus-visible:shadow-[0_16px_36px_rgba(11,31,58,0.10)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#10B981]'
    : '';

  return (
    <Component
      className={`group flex h-full min-w-0 flex-col border border-[#E5E7EB] bg-white ${variantClasses[variant]} ${interactiveClasses} ${className}`}
      {...props}
    >
      {children}
    </Component>
  );
}
