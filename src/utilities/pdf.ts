import { extractText, getDocumentProxy } from 'unpdf'

export class PdfPasswordError extends Error {
  constructor(public readonly wrong: boolean) {
    super(wrong ? 'Wrong PDF password.' : 'This PDF is password protected.')
  }
}

/**
 * drizzle-kit (loaded by Payload's schema push) adds an enumerable Array.prototype.random,
 * and pdf.js refuses to load while arrays have enumerable extras. Hide it before pdf.js is
 * first imported (unpdf imports it lazily on first use).
 */
function hideArrayPrototypeExtras() {
  for (const key of Object.keys(Array.prototype)) {
    const d = Object.getOwnPropertyDescriptor(Array.prototype, key)
    if (d?.configurable) Object.defineProperty(Array.prototype, key, { ...d, enumerable: false })
  }
}

/** Text of each page of a PDF (base64 or bytes). Scanned PDFs come back empty. */
export async function pdfPages(data: string | Uint8Array, password?: string): Promise<string[]> {
  const bytes = typeof data === 'string' ? new Uint8Array(Buffer.from(data, 'base64')) : data
  hideArrayPrototypeExtras()
  try {
    const pdf = await getDocumentProxy(bytes, password ? { password } : {})
    const { text } = await extractText(pdf, { mergePages: false })
    return text
  } catch (e) {
    // pdf.js PasswordException: code 1 = password needed, 2 = wrong password
    if ((e as { name?: string }).name === 'PasswordException') {
      throw new PdfPasswordError((e as { code?: number }).code === 2)
    }
    throw e
  }
}
