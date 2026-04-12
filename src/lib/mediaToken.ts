import jwt from 'jsonwebtoken'

const TOKEN_EXPIRY = '1h'

interface MediaTokenPayload {
  id: string
  filename: string
}

export function signMediaToken({
  id,
  filename,
  secret,
}: MediaTokenPayload & { secret: string }): string {
  return jwt.sign({ id, filename }, secret, { expiresIn: TOKEN_EXPIRY })
}

export function verifyMediaToken(token: string, secret: string): MediaTokenPayload | null {
  try {
    const decoded = jwt.verify(token, secret) as MediaTokenPayload
    return { id: decoded.id, filename: decoded.filename }
  } catch {
    return null
  }
}
