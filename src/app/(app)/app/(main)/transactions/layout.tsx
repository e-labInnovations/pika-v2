import React from 'react'

/** The list, plus a slot where a transaction opens as a side panel. */
export default function TransactionsLayout({ children, panel }: { children: React.ReactNode; panel: React.ReactNode }) {
  return (
    <>
      {children}
      {panel}
    </>
  )
}
