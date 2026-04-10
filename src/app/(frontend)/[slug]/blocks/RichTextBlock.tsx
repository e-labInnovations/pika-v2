import { RichText } from '@payloadcms/richtext-lexical/react'
import React from 'react'

type Props = {
  content: Parameters<typeof RichText>[0]['data']
}

export function RichTextBlockRenderer({ content }: Props) {
  return (
    <div className="prose prose-neutral dark:prose-invert max-w-none">
      <RichText data={content} />
    </div>
  )
}
