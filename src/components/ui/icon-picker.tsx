'use client'

import * as React from 'react'
import { useState, useMemo, useCallback, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { iconsData } from './icons-data'
import { useVirtualizer, type VirtualItem } from '@tanstack/react-virtual'
import { Skeleton } from '@/components/ui/skeleton'
import Fuse from 'fuse.js'
import { useDebounceValue } from 'usehooks-ts'
import { useMediaQuery } from '@/hooks/use-media-query'
import { DynamicIcon, type IconName } from '@/components/lucide'
import type { DynamicIconProps } from '../lucide/dynamic-icon'

export type IconData = (typeof iconsData)[number]

interface IconPickerProps {
  value?: IconName
  defaultValue?: IconName
  onValueChange?: (value: IconName) => void
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  children?: React.ReactNode
  searchable?: boolean
  searchPlaceholder?: string
  triggerPlaceholder?: string
  iconsList?: IconData[]
  categorized?: boolean
}

const IconRenderer = React.memo(({ name }: { name: IconName }) => {
  return <Icon name={name} />
})
IconRenderer.displayName = 'IconRenderer'

const IconsColumnSkeleton = () => {
  return (
    <div className="flex w-full flex-col gap-2">
      <Skeleton className="h-4 w-1/2 rounded-md" />
      <div className="grid w-full grid-cols-8 gap-2">
        {Array.from({ length: 40 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-10 rounded-md" />
        ))}
      </div>
    </div>
  )
}

const useIconsData = () => {
  const [icons, setIcons] = useState<IconData[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    const loadIcons = async () => {
      setIsLoading(true)
      const { iconsData } = await import('./icons-data')
      if (isMounted) {
        setIcons(iconsData)
        setIsLoading(false)
      }
    }

    loadIcons()

    return () => {
      isMounted = false
    }
  }, [])

  return { icons, isLoading }
}

const IconPicker = React.forwardRef<HTMLButtonElement, IconPickerProps>(
  (
    {
      value,
      defaultValue,
      onValueChange,
      open,
      defaultOpen,
      onOpenChange,
      children,
      searchable = true,
      searchPlaceholder = 'Search for an icon...',
      triggerPlaceholder = 'Select an icon',
      iconsList,
      categorized = true,
    },
    ref,
  ) => {
    const [selectedIcon, setSelectedIcon] = useState<IconName | undefined>(defaultValue)
    const [isOpen, setIsOpen] = useState(defaultOpen || false)
    const [search, setSearch] = useDebounceValue('', 100)
    const [isVisible, setIsVisible] = useState(false)
    const { icons } = useIconsData()
    const [isLoading, setIsLoading] = useState(true)
    const isDesktop = useMediaQuery('(min-width: 768px)')

    const iconsToUse = useMemo(() => iconsList || icons, [iconsList, icons])

    const fuseInstance = useMemo(() => {
      return new Fuse(iconsToUse, {
        keys: ['name', 'tags', 'categories'],
        threshold: 0.3,
        ignoreLocation: true,
        includeScore: true,
      })
    }, [iconsToUse])

    const filteredIcons = useMemo(() => {
      if (search.trim() === '') return iconsToUse
      return fuseInstance.search(search.toLowerCase().trim()).map((r) => r.item)
    }, [search, iconsToUse, fuseInstance])

    const categorizedIcons = useMemo(() => {
      if (!categorized || search.trim() !== '') {
        return [{ name: 'All Icons', icons: filteredIcons }]
      }

      const categories = new Map<string, IconData[]>()

      filteredIcons.forEach((icon) => {
        if (icon.categories && icon.categories.length > 0) {
          icon.categories.forEach((category) => {
            if (!categories.has(category)) categories.set(category, [])
            categories.get(category)!.push(icon)
          })
        } else {
          if (!categories.has('Other')) categories.set('Other', [])
          categories.get('Other')!.push(icon)
        }
      })

      return Array.from(categories.entries())
        .map(([name, icons]) => ({ name, icons }))
        .sort((a, b) => a.name.localeCompare(b.name))
    }, [filteredIcons, categorized, search])

    const COLS = isDesktop ? 8 : 5

    const virtualItems = useMemo(() => {
      const items: Array<{
        type: 'category' | 'row'
        categoryIndex: number
        rowIndex?: number
        icons?: IconData[]
      }> = []

      categorizedIcons.forEach((category, categoryIndex) => {
        items.push({ type: 'category', categoryIndex })
        for (let i = 0; i < category.icons.length; i += COLS) {
          items.push({
            type: 'row',
            categoryIndex,
            rowIndex: i / COLS,
            icons: category.icons.slice(i, i + COLS),
          })
        }
      })

      return items
    }, [categorizedIcons, COLS])

    const categoryIndices = useMemo(() => {
      const indices: Record<string, number> = {}
      virtualItems.forEach((item, index) => {
        if (item.type === 'category') {
          indices[categorizedIcons[item.categoryIndex].name] = index
        }
      })
      return indices
    }, [virtualItems, categorizedIcons])

    const parentRef = React.useRef<HTMLDivElement>(null)

    const virtualizer = useVirtualizer({
      count: virtualItems.length,
      getScrollElement: () => parentRef.current,
      estimateSize: (index) => (virtualItems[index].type === 'category' ? 25 : 44),
      paddingEnd: 2,
      gap: 10,
      overscan: 5,
    })

    const handleValueChange = useCallback(
      (icon: IconName) => {
        if (value === undefined) setSelectedIcon(icon)
        onValueChange?.(icon)
      },
      [value, onValueChange],
    )

    const handleOpenChange = useCallback(
      (newOpen: boolean) => {
        setSearch('')
        if (open === undefined) setIsOpen(newOpen)
        onOpenChange?.(newOpen)
        setIsVisible(newOpen)

        if (newOpen) {
          setTimeout(() => {
            virtualizer.measure()
            setIsLoading(false)
          }, 1)
        }
      },
      [open, onOpenChange, virtualizer],
    )

    const handleIconClick = useCallback(
      (iconName: IconName) => {
        handleValueChange(iconName)
        handleOpenChange(false)
      },
      [handleValueChange, handleOpenChange],
    )

    const handleSearchChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearch(e.target.value)
        if (parentRef.current) parentRef.current.scrollTop = 0
        virtualizer.scrollToOffset(0)
      },
      [virtualizer],
    )

    const scrollToCategory = useCallback(
      (categoryName: string) => {
        const idx = categoryIndices[categoryName]
        if (idx !== undefined) {
          virtualizer.scrollToIndex(idx, { align: 'start', behavior: 'smooth' })
        }
      },
      [categoryIndices, virtualizer],
    )

    const categoryButtons = useMemo(() => {
      if (!categorized || search.trim() !== '') return null
      return categorizedIcons.map((category) => (
        <Button
          key={category.name}
          variant="outline"
          size="sm"
          className="text-xs"
          onClick={(e) => {
            e.stopPropagation()
            scrollToCategory(category.name)
          }}
        >
          {category.name.charAt(0).toUpperCase() + category.name.slice(1)}
        </Button>
      ))
    }, [categorizedIcons, scrollToCategory, categorized, search])

    const renderIcon = useCallback(
      (icon: IconData) => (
        <Tooltip key={icon.name}>
          <TooltipTrigger asChild>
            <button
              type="button"
              className={cn(
                'hover:bg-foreground/10 rounded-md border p-2 transition',
                'flex items-center justify-center',
              )}
              onClick={() => handleIconClick(icon.name as IconName)}
            >
              <IconRenderer name={icon.name as IconName} />
            </button>
          </TooltipTrigger>
          <TooltipContent>{icon.name}</TooltipContent>
        </Tooltip>
      ),
      [handleIconClick],
    )

    const renderVirtualContent = useCallback(() => {
      if (filteredIcons.length === 0) {
        return <div className="text-center text-gray-500">No icon found</div>
      }

      return (
        <div
          className="relative w-full overscroll-contain"
          style={{ height: `${virtualizer.getTotalSize()}px` }}
        >
          {virtualizer.getVirtualItems().map((virtualItem: VirtualItem) => {
            const item = virtualItems[virtualItem.index]
            if (!item) return null

            const itemStyle = {
              position: 'absolute' as const,
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualItem.size}px`,
              transform: `translateY(${virtualItem.start}px)`,
            }

            if (item.type === 'category') {
              return (
                <div key={virtualItem.key} style={itemStyle} className="bg-background z-10">
                  <h3 className="text-sm font-medium capitalize">
                    {categorizedIcons[item.categoryIndex].name}
                  </h3>
                  <div className="bg-foreground/10 h-[1px] w-full" />
                </div>
              )
            }

            return (
              <div key={virtualItem.key} data-index={virtualItem.index} style={itemStyle}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`,
                    gap: '8px',
                  }}
                >
                  {item.icons!.map(renderIcon)}
                </div>
              </div>
            )
          })}
        </div>
      )
    }, [virtualizer, virtualItems, categorizedIcons, filteredIcons, renderIcon, COLS])

    useEffect(() => {
      if (isVisible) {
        setIsLoading(true)
        const timer = setTimeout(() => {
          setIsLoading(false)
          virtualizer.measure()
        }, 10)

        const resizeObserver = new ResizeObserver(() => {
          virtualizer.measure()
        })

        if (parentRef.current) {
          resizeObserver.observe(parentRef.current)
        }

        return () => {
          clearTimeout(timer)
          resizeObserver.disconnect()
        }
      }
    }, [isVisible, virtualizer])

    const triggerButton = children || (
      <Button ref={ref} variant="outline" onClick={() => handleOpenChange(true)}>
        {value || selectedIcon ? (
          <>
            <Icon name={(value || selectedIcon)!} />
            {value || selectedIcon}
          </>
        ) : (
          triggerPlaceholder
        )}
      </Button>
    )

    const pickerContent = (
      <>
        {searchable && (
          <Input
            placeholder={searchPlaceholder}
            id="icon-picker-search"
            onChange={handleSearchChange}
            className="mb-2"
          />
        )}
        {categorized && search.trim() === '' && (
          <div className="flex flex-row gap-1 overflow-x-auto pb-1">{categoryButtons}</div>
        )}
        <div
          ref={parentRef}
          className={cn('overflow-auto', isDesktop ? 'h-96' : 'grow')}
          style={{ scrollbarWidth: 'thin' }}
        >
          {isLoading ? <IconsColumnSkeleton /> : renderVirtualContent()}
        </div>
      </>
    )

    if (isDesktop) {
      return (
        <>
          <div onClick={() => handleOpenChange(true)}>{triggerButton}</div>
          <Dialog open={open ?? isOpen} onOpenChange={handleOpenChange}>
            <DialogContent className="flex max-h-[80vh] w-full max-w-2xl flex-col gap-3 overflow-hidden">
              <DialogHeader>
                <DialogTitle>Select an Icon</DialogTitle>
              </DialogHeader>
              {pickerContent}
            </DialogContent>
          </Dialog>
        </>
      )
    }

    return (
      <>
        <div onClick={() => handleOpenChange(true)}>{triggerButton}</div>
        <Drawer open={open ?? isOpen} onOpenChange={handleOpenChange}>
          <DrawerContent className="flex h-[85%] flex-col">
            <DrawerHeader className="shrink-0 items-start">
              <DrawerTitle>Select an Icon</DrawerTitle>
            </DrawerHeader>
            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden px-4">
              {pickerContent}
            </div>
            <DrawerFooter className="shrink-0">
              <DrawerClose className={cn('w-full', buttonVariants({ variant: 'outline' }))}>
                Cancel
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </>
    )
  },
)
IconPicker.displayName = 'IconPicker'

interface IconProps extends Omit<DynamicIconProps, 'ref'> {
  name: IconName
}

const Icon = React.forwardRef<React.ComponentRef<typeof DynamicIcon>, IconProps>(
  ({ name, ...props }, ref) => {
    return <DynamicIcon name={name} {...props} ref={ref} />
  },
)
Icon.displayName = 'Icon'

export { IconPicker, Icon, type IconName }
