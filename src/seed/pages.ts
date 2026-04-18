import type { Payload } from 'payload'

type PageSeed = {
  title: string
  slug: string
  description: string
  layout: object[]
}

const PAGES: PageSeed[] = [
  {
    title: 'Terms & Conditions',
    slug: 'terms',
    description: 'Terms and conditions for using the Pika app.',
    layout: [
      {
        blockType: 'richText',
        content: {
          root: {
            type: 'root',
            children: [
              { type: 'heading', tag: 'h2', children: [{ type: 'text', text: 'Terms & Conditions' }] },
              { type: 'paragraph', children: [{ type: 'text', text: 'Last updated: ' + new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) }] },
              { type: 'heading', tag: 'h3', children: [{ type: 'text', text: '1. Acceptance of Terms' }] },
              { type: 'paragraph', children: [{ type: 'text', text: 'By accessing or using Pika, you agree to be bound by these Terms & Conditions. If you do not agree, please do not use the app.' }] },
              { type: 'heading', tag: 'h3', children: [{ type: 'text', text: '2. Use of Service' }] },
              { type: 'paragraph', children: [{ type: 'text', text: 'Pika is a personal finance management application. You are responsible for maintaining the confidentiality of your account credentials and for all activities under your account.' }] },
              { type: 'heading', tag: 'h3', children: [{ type: 'text', text: '3. Data' }] },
              { type: 'paragraph', children: [{ type: 'text', text: 'All financial data you enter is stored securely and is never shared with third parties without your consent. You retain full ownership of your data.' }] },
              { type: 'heading', tag: 'h3', children: [{ type: 'text', text: '4. Limitation of Liability' }] },
              { type: 'paragraph', children: [{ type: 'text', text: 'Pika is provided "as is" without warranties of any kind. We are not liable for any financial decisions made based on information within the app.' }] },
              { type: 'heading', tag: 'h3', children: [{ type: 'text', text: '5. Changes to Terms' }] },
              { type: 'paragraph', children: [{ type: 'text', text: 'We reserve the right to update these terms at any time. Continued use of the app after changes constitutes acceptance of the new terms.' }] },
            ],
            direction: 'ltr',
            format: '',
            indent: 0,
            version: 1,
          },
        },
      },
    ],
  },
  {
    title: 'Privacy Policy',
    slug: 'privacy-policy',
    description: 'How Pika collects, uses, and protects your personal data.',
    layout: [
      {
        blockType: 'richText',
        content: {
          root: {
            type: 'root',
            children: [
              { type: 'heading', tag: 'h2', children: [{ type: 'text', text: 'Privacy Policy' }] },
              { type: 'paragraph', children: [{ type: 'text', text: 'Last updated: ' + new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) }] },
              { type: 'heading', tag: 'h3', children: [{ type: 'text', text: '1. Information We Collect' }] },
              { type: 'paragraph', children: [{ type: 'text', text: 'We collect information you provide directly: name, email address, and financial data you enter. We also collect usage data to improve the app experience.' }] },
              { type: 'heading', tag: 'h3', children: [{ type: 'text', text: '2. How We Use Your Information' }] },
              { type: 'paragraph', children: [{ type: 'text', text: 'Your data is used solely to provide and improve the Pika service. We do not sell, trade, or share your personal data with third parties for marketing purposes.' }] },
              { type: 'heading', tag: 'h3', children: [{ type: 'text', text: '3. Data Storage & Security' }] },
              { type: 'paragraph', children: [{ type: 'text', text: 'All data is stored on secure servers. We use industry-standard encryption for data in transit and at rest. Access to your data is restricted to authorised personnel only.' }] },
              { type: 'heading', tag: 'h3', children: [{ type: 'text', text: '4. Third-Party Services' }] },
              { type: 'paragraph', children: [{ type: 'text', text: 'Pika uses Google OAuth for authentication. When you sign in with Google, Google\'s privacy policy applies to the data shared during that process.' }] },
              { type: 'heading', tag: 'h3', children: [{ type: 'text', text: '5. Your Rights' }] },
              { type: 'paragraph', children: [{ type: 'text', text: 'You have the right to access, correct, or delete your personal data at any time. Contact us through the app settings to exercise these rights.' }] },
              { type: 'heading', tag: 'h3', children: [{ type: 'text', text: '6. Contact' }] },
              { type: 'paragraph', children: [{ type: 'text', text: 'If you have any questions about this Privacy Policy, please contact us through the Pika app.' }] },
            ],
            direction: 'ltr',
            format: '',
            indent: 0,
            version: 1,
          },
        },
      },
    ],
  },
  {
    title: 'MCP Setup Guide',
    slug: 'mcp-setup',
    description: 'How to connect AI assistants like Claude and Cursor to your Pika account via MCP.',
    layout: [
      {
        blockType: 'richText',
        content: {
          root: {
            type: 'root',
            children: [
              { type: 'heading', tag: 'h2', children: [{ type: 'text', text: 'Connect AI Assistants via MCP' }] },
              { type: 'paragraph', children: [{ type: 'text', text: 'Pika supports the Model Context Protocol (MCP), which lets AI assistants like Claude and Cursor read and manage your financial data directly.' }] },
              { type: 'heading', tag: 'h3', children: [{ type: 'text', text: 'What You Can Do' }] },
              { type: 'paragraph', children: [{ type: 'text', text: 'Once connected, your AI assistant can: view transactions and accounts, create new transactions, query spending by category or tag, check your dashboard summary, and manage reminders.' }] },
            ],
            direction: 'ltr',
            format: '',
            indent: 0,
            version: 1,
          },
        },
      },
      {
        blockType: 'banner',
        style: 'info',
        content: 'Your AI assistant connects using OAuth — no API key copying required. The connection is secure and you can revoke access anytime from Settings → Connected Apps.',
      },
      {
        blockType: 'richText',
        content: {
          root: {
            type: 'root',
            children: [
              { type: 'heading', tag: 'h3', children: [{ type: 'text', text: 'Option 1: Claude Desktop (Recommended)' }] },
              { type: 'paragraph', children: [{ type: 'text', text: 'Add the following to your Claude Desktop config file (claude_desktop_config.json):' }] },
            ],
            direction: 'ltr',
            format: '',
            indent: 0,
            version: 1,
          },
        },
      },
      {
        blockType: 'code',
        language: 'json',
        caption: 'claude_desktop_config.json',
        code: `{
  "mcpServers": {
    "pika": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://your-pika-server.com/api/mcp"
      ]
    }
  }
}`,
      },
      {
        blockType: 'richText',
        content: {
          root: {
            type: 'root',
            children: [
              { type: 'heading', tag: 'h3', children: [{ type: 'text', text: 'Option 2: Cursor' }] },
              { type: 'paragraph', children: [{ type: 'text', text: 'In Cursor, go to Settings → MCP Servers and add a new server with the URL of your Pika instance. Cursor will automatically open a browser to complete OAuth sign-in.' }] },
              { type: 'heading', tag: 'h3', children: [{ type: 'text', text: 'Option 3: Manual API Key' }] },
              { type: 'paragraph', children: [{ type: 'text', text: 'If your client does not support OAuth, you can generate an API key from the Pika admin panel under MCP → API Keys and use it as a Bearer token.' }] },
            ],
            direction: 'ltr',
            format: '',
            indent: 0,
            version: 1,
          },
        },
      },
      {
        blockType: 'code',
        language: 'bash',
        caption: 'Test your connection',
        code: `curl -H "Authorization: Bearer <your-api-key>" https://your-pika-server.com/api/mcp`,
      },
    ],
  },
  {
    title: 'Get Your Gemini API Key',
    slug: 'gemini-api-key',
    description: 'How to generate a personal Google Gemini API key for Pika AI features.',
    layout: [
      {
        blockType: 'richText',
        content: {
          root: {
            type: 'root',
            children: [
              { type: 'heading', tag: 'h2', children: [{ type: 'text', text: 'Get Your Gemini API Key' }] },
              { type: 'paragraph', children: [{ type: 'text', text: 'Pika uses Google Gemini to power AI features like transaction parsing from text/receipts and smart category suggestions. You can use a personal Gemini API key to avoid shared rate limits and keep your usage under your own Google account.' }] },
              { type: 'heading', tag: 'h3', children: [{ type: 'text', text: 'Step 1: Sign in to Google AI Studio' }] },
              { type: 'paragraph', children: [{ type: 'text', text: 'Open Google AI Studio and sign in with any Google account.' }] },
            ],
            direction: 'ltr',
            format: '',
            indent: 0,
            version: 1,
          },
        },
      },
      {
        blockType: 'banner',
        style: 'info',
        content: 'Google AI Studio: https://aistudio.google.com/app/apikey — this is where you manage your Gemini API keys.',
      },
      {
        blockType: 'richText',
        content: {
          root: {
            type: 'root',
            children: [
              { type: 'heading', tag: 'h3', children: [{ type: 'text', text: 'Step 2: Create an API Key' }] },
              { type: 'paragraph', children: [{ type: 'text', text: 'Click "Create API key", optionally select a Google Cloud project (a default will be used if you skip this), and copy the generated key. It starts with "AIzaSy...".' }] },
              { type: 'heading', tag: 'h3', children: [{ type: 'text', text: 'Step 3: Paste the key into Pika' }] },
              { type: 'paragraph', children: [{ type: 'text', text: 'Open Pika → Settings → AI and paste your key into the Gemini API Key field, then tap Save. Your key is stored securely on your account and is never shared with other users.' }] },
              { type: 'heading', tag: 'h3', children: [{ type: 'text', text: 'Pricing & Rate Limits' }] },
              { type: 'paragraph', children: [{ type: 'text', text: 'The Gemini free tier includes generous daily quota for the gemini-2.5-flash model that Pika uses by default. If you exceed it, Pika will show a clear rate-limit message and retry is possible after the cooldown. See Google\'s pricing page for the latest limits.' }] },
              { type: 'heading', tag: 'h3', children: [{ type: 'text', text: 'Revoking or rotating your key' }] },
              { type: 'paragraph', children: [{ type: 'text', text: 'You can delete or rotate the key anytime from Google AI Studio. After rotating, paste the new key into Pika Settings and save.' }] },
            ],
            direction: 'ltr',
            format: '',
            indent: 0,
            version: 1,
          },
        },
      },
    ],
  },
]

export const seedPages = async (payload: Payload): Promise<void> => {
  for (const page of PAGES) {
    const existing = await payload.find({
      collection: 'pages',
      where: { slug: { equals: page.slug } },
      limit: 1,
      depth: 0,
    })

    if (existing.totalDocs > 0) {
      console.log(`⏭️  Page already exists: ${page.slug}`)
      continue
    }

    await payload.create({
      collection: 'pages',
      data: {
        title: page.title,
        slug: page.slug,
        description: page.description,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        layout: page.layout as any,
        publishedAt: new Date().toISOString(),
      },
      overrideAccess: true,
    })

    console.log(`✅ Created page: ${page.slug}`)
  }
}
