"use client"

import React from "react"
import { TooltipProvider } from "@/components/ui/tooltip"

export default function AdminTooltipProvider({ children }: { children: React.ReactNode }) {
  return <TooltipProvider>{children}</TooltipProvider>
}
