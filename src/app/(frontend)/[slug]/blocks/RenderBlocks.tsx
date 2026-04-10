import React, { Fragment } from 'react'
import { RichTextBlockRenderer } from './RichTextBlock'
import { BannerBlockRenderer } from './BannerBlock'
import { CodeBlockRenderer } from './CodeBlock'

type Block =
  | { blockType: 'richText'; content: unknown }
  | { blockType: 'banner'; style: 'info' | 'warning' | 'success' | 'error'; content: string }
  | { blockType: 'code'; code: string; language?: string; caption?: string }

export function RenderBlocks({ blocks }: { blocks: Block[] }) {
  if (!blocks?.length) return null

  return (
    <Fragment>
      {blocks.map((block, index) => {
        if (block.blockType === 'richText') {
          return <RichTextBlockRenderer key={index} content={block.content as Parameters<typeof RichTextBlockRenderer>[0]['content']} />
        }
        if (block.blockType === 'banner') {
          return <BannerBlockRenderer key={index} style={block.style} content={block.content} />
        }
        if (block.blockType === 'code') {
          return <CodeBlockRenderer key={index} code={block.code} language={block.language} caption={block.caption} />
        }
        return null
      })}
    </Fragment>
  )
}
