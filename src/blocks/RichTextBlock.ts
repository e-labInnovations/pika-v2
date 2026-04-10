import type { Block } from 'payload'
import { lexicalEditor, HeadingFeature, BoldFeature, ItalicFeature, UnderlineFeature, OrderedListFeature, UnorderedListFeature, LinkFeature, InlineCodeFeature, HorizontalRuleFeature } from '@payloadcms/richtext-lexical'

export const RichTextBlock: Block = {
  slug: 'richText',
  labels: { singular: 'Rich Text', plural: 'Rich Text Blocks' },
  fields: [
    {
      name: 'content',
      type: 'richText',
      required: true,
      editor: lexicalEditor({
        features: [
          HeadingFeature({ enabledHeadingSizes: ['h2', 'h3', 'h4'] }),
          BoldFeature(),
          ItalicFeature(),
          UnderlineFeature(),
          OrderedListFeature(),
          UnorderedListFeature(),
          LinkFeature(),
          InlineCodeFeature(),
          HorizontalRuleFeature(),
        ],
      }),
    },
  ],
}
