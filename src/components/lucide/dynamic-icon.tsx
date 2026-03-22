'use client'
import React, { forwardRef } from 'react'
import { type IconName, resolveIconName } from './lucide'

interface DynamicIconProps extends React.SVGProps<SVGSVGElement> {
  /**
   * The name of the Lucide icon to render
   */
  name: IconName
  /**
   * The size of the icon (width and height)
   * @default 24
   */
  size?: string | number
  /**
   * The color of the icon
   * @default 'currentColor'
   */
  color?: string
  /**
   * The stroke width of the icon
   * @default 2
   */
  strokeWidth?: string | number
  /**
   * Whether to use absolute stroke width
   * @default false
   */
  absoluteStrokeWidth?: boolean
}

/**
 * Dynamic Lucide icon component that renders icons from the SVG sprite
 *
 * @example
 * ```tsx
 * <DynamicIcon name="database" size={24} />
 * <DynamicIcon name="user" color="#3b82f6" strokeWidth={1.5} />
 * ```
 */
const DynamicIcon = forwardRef<SVGSVGElement, DynamicIconProps>(
  (
    {
      name,
      size = 24,
      color = 'currentColor',
      strokeWidth = 1.5,
      absoluteStrokeWidth = false,
      className,
      style,
      ...props
    },
    ref,
  ) => {
    const normalized = name.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase() as IconName
    const resolvedName = resolveIconName(normalized)
    return (
      <svg
        ref={ref}
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth={
          absoluteStrokeWidth ? Number(strokeWidth) : `${(24 / Number(size)) * Number(strokeWidth)}`
        }
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        style={style}
        {...props}
      >
        <use href={`#${resolvedName}`} />
      </svg>
    )
  },
)

DynamicIcon.displayName = 'DynamicIcon'

export default DynamicIcon
export type { DynamicIconProps }
