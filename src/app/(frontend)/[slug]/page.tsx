import type { Metadata } from 'next'
import { getPayload } from 'payload'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import React from 'react'
import config from '@/payload.config'
import { RenderBlocks } from './blocks/RenderBlocks'
import { ChevronLeft } from 'lucide-react'

type Args = {
  params: Promise<{ slug: string }>
}

async function getPage(slug: string) {
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })
  const result = await payload.find({
    collection: 'pages',
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 1,
  })
  return result.docs?.[0] ?? null
}

export async function generateStaticParams() {
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })
  const pages = await payload.find({ collection: 'pages', limit: 1000, depth: 0 })
  return pages.docs.map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const { slug } = await params
  const page = await getPage(slug)
  if (!page) return {}
  return {
    title: page.title,
    description: page.description ?? undefined,
  }
}

export default async function PageRoute({ params }: Args) {
  const { slug } = await params
  const page = await getPage(slug)

  if (!page) notFound()

  const publishedDate = page.publishedAt
    ? new Date(page.publishedAt).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : null

  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="fixed top-0 inset-x-0 z-50 flex items-center px-6 py-4 border-b border-border bg-background/80 backdrop-blur-sm">
        <Link href="/" className="flex items-center gap-2 text-sm font-semibold">
          <Image src="/icon.svg" alt="Pika" width={24} height={24} />
          Pika
        </Link>
      </nav>

      <main className="max-w-2xl mx-auto px-4 pt-28 pb-20">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ChevronLeft size={13} />
          Back
        </Link>

        <h1 className="text-3xl font-bold tracking-tight mb-2">{page.title}</h1>

        {publishedDate && (
          <p className="text-xs text-muted-foreground mb-6 pb-6 border-b border-border">
            Updated {publishedDate}
          </p>
        )}

        {page.description && (
          <p className="text-muted-foreground text-base leading-relaxed mb-8">{page.description}</p>
        )}

        <RenderBlocks
          blocks={(page.layout ?? []) as Parameters<typeof RenderBlocks>[0]['blocks']}
        />
      </main>

      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Pika (e-lab innovations)
      </footer>
    </div>
  )
}
