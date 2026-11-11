import { decode, encode } from 'he'

export interface EncodeEntitiesOptions {
  named?: boolean
  encodeAll?: boolean
}

export function encodeHtmlEntities(text: string, options: EncodeEntitiesOptions = {}): string {
  return encode(text, {
    useNamedReferences: options.named ?? true,
    encodeEverything: options.encodeAll ?? false
  })
}

export function decodeHtmlEntities(text: string): string {
  return decode(text, { strict: false })
}
