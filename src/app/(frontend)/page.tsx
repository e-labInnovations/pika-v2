import { headers as getHeaders } from 'next/headers.js'
import { getPayload } from 'payload'
import React from 'react'

import config from '@/payload.config'
import './styles.css'
import TestColorPicker from '@/components/test-color-picker'

export default async function HomePage() {
  const headers = await getHeaders()
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })
  const { user } = await payload.auth({ headers })

  return (
    <div>
       {!user && <h1>Welcome to your new project.</h1>}
       {user && <h1>Welcome back, {(user as any).email}</h1>}

       <TestColorPicker />
    </div>
  )
}
