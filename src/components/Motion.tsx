import { Children, cloneElement, isValidElement, type AnchorHTMLAttributes, type ButtonHTMLAttributes, type CSSProperties, type ElementType, type HTMLAttributes } from 'react';
import { cx, getMotionStyle, motionHoverEffects, motionRevealVariants, type MotionHoverEffect, type MotionRevealVariant } from '@/lib/motion';

type MotionElementProps<T extends HTMLElement> = HTMLAttributes<T> & {
  as?: ElementType;
};

type RevealProps<T extends HTMLElement = HTMLDivElement> = MotionElementProps<T> & {
  variant?: MotionRevealVariant;
  delay?: number;
  duration?: number;
  once?: boolean;
  disabled?: boolean;
  threshold?: number | number[];
  rootMargin?: string;
};

export function Reveal<T extends HTMLElement = HTMLDivElement>({
  as: Component = 'div',
  children,
  className,
  delay = 0,
  duration,
  once = true,
  disabled = false,
  threshold,
  rootMargin,
  variant = 'up',
  style,
  ...props
}: RevealProps<T>) {
  return (
    <Component
      className={cx('za-reveal', motionRevealVariants[variant], 'is-visible', className)}
      style={{ ...getMotionStyle({ delay, duration }), ...style } as CSSProperties}
      {...props}
    >
      {children}
    </Component>
  );
}

type StaggerProps<T extends HTMLElement = HTMLDivElement> = MotionElementProps<T> & {
  childClassName?: string;
  delay?: number;
  staggerDelay?: number;
  duration?: number;
  once?: boolean;
  disabled?: boolean;
  threshold?: number | number[];
  rootMargin?: string;
  variant?: MotionRevealVariant;
};

export function Stagger<T extends HTMLElement = HTMLDivElement>({
  as: Component = 'div',
  children,
  childClassName,
  className,
  delay = 0,
  staggerDelay = 80,
  duration,
  once = true,
  disabled = false,
  threshold,
  rootMargin,
  variant = 'up',
  ...props
}: StaggerProps<T>) {
  return (
    <Component className={cx('za-stagger', 'is-visible', className)} {...props}>
      {Children.map(children, (child, index) => {
        const style = getMotionStyle({ delay, duration, staggerDelay, staggerIndex: index });
        const itemClassName = cx('za-stagger__item', motionRevealVariants[variant], childClassName);

        if (!isValidElement<{ className?: string; style?: CSSProperties }>(child)) {
          return (
            <div className={itemClassName} style={style}>
              {child}
            </div>
          );
        }

        return cloneElement(child, {
          className: cx(child.props.className, itemClassName),
          style: { ...style, ...child.props.style },
        });
      })}
    </Component>
  );
}

type HoverProps<T extends HTMLElement = HTMLDivElement> = MotionElementProps<T> & {
  effect?: MotionHoverEffect;
};

export function HoverMotion<T extends HTMLElement = HTMLDivElement>({
  as: Component = 'div',
  children,
  className,
  effect = 'lift',
  ...props
}: HoverProps<T>) {
  return (
    <Component className={cx('za-hover', motionHoverEffects[effect], className)} {...props}>
      {children}
    </Component>
  );
}

type MotionButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

export function MotionButton({ children, className, ...props }: MotionButtonProps) {
  return (
    <button className={cx('za-button-motion', className)} {...props}>
      {children}
    </button>
  );
}

export function MotionLink({ children, className, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  return (
    <a className={cx('za-button-motion', className)} {...props}>
      {children}
    </a>
  );
}
