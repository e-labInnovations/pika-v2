import type { Block } from 'payload'

export const CodeBlock: Block = {
  slug: 'code',
  labels: { singular: 'Code Block', plural: 'Code Blocks' },
  fields: [
    {
      name: 'language',
      type: 'select',
      defaultValue: 'bash',
      options: [
        { label: 'Bash / Shell', value: 'bash' },
        { label: 'JSON', value: 'json' },
        { label: 'JavaScript', value: 'javascript' },
        { label: 'TypeScript', value: 'typescript' },
        { label: 'CSS', value: 'css' },
        { label: 'Plain Text', value: 'text' },
      ],
    },
    {
      name: 'caption',
      type: 'text',
      admin: { description: 'Optional label shown above the code block' },
    },
    {
      name: 'code',
      type: 'code',
      required: true,
      admin: { language: 'javascript' },
    },
  ],
}
