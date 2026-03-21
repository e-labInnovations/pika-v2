import React from 'react'
import LucideSprite from './LucideSprite'

export const LucideSpriteProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    <>
      <LucideSprite />
      {children}
    </>
  )
}

export default LucideSpriteProvider