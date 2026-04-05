'use client'
import React, { useState, useEffect } from 'react'
import ColorPicker from '@/components/ui/color-picker'
import { DynamicIcon } from '@/components/lucide'

export default function TestColorPicker() {
  const [color, setColor] = useState('#0088FE')
  const [spriteLoaded, setSpriteLoaded] = useState(false)

  useEffect(() => {
    // Check if the sprite is loaded
    const spriteElement = document.getElementById('lucide-sprite')
    setSpriteLoaded(!!spriteElement)
  }, [])

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold">Icon & Color Test</h2>
      
      <div className="mb-2 text-sm">
        <span className={`inline-block px-2 py-1 rounded text-xs ${spriteLoaded ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          SVG Sprite: {spriteLoaded ? 'Loaded ✓' : 'Not Found ✗'}
        </span>
      </div>
      
      {/* Test Icons */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Icons Test:</h3>
        <div className="flex gap-4 items-center flex-wrap">
          <div className="flex flex-col items-center gap-1">
            <DynamicIcon name="house" size={24} />
            <span className="text-xs">house</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <DynamicIcon name="user" size={24} />
            <span className="text-xs">user</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <DynamicIcon name="settings" size={24} />
            <span className="text-xs">settings</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <DynamicIcon name="heart" size={24} color="red" />
            <span className="text-xs">heart</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <DynamicIcon name="star" size={24} color="gold" />
            <span className="text-xs">star</span>
          </div>
        </div>
      </div>

      {/* Color Picker */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Color Picker Test:</h3>
        <ColorPicker
          color={color}
          setColor={setColor}
        />
        <p className="text-sm">Selected color: <span className="font-mono">{color}</span></p>
      </div>
    </div>
  )
}