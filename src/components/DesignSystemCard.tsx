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
  standard: 'za-card',
  capability: 'za-card',
  featured: 'za-panel p-5 sm:p-6 lg:p-8',
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
    ? 'cursor-pointer transition-[border-color,box-shadow,transform] duration-200 ease-out motion-safe:hover:-translate-y-0.5 hover:border-accent/55 hover:shadow-elevated focus-visible:border-accent/70 focus-visible:shadow-elevated'
    : '';

  return (
    <Component
      className={`group flex h-full min-w-0 flex-col ${variantClasses[variant]} ${interactiveClasses} ${className}`}
      {...props}
    >
      {children}
    </Component>
  );
}
