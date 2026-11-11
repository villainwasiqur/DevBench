import { describe, expect, it } from 'vitest'
import { decodeHtmlEntities, encodeHtmlEntities } from './htmlEntities'

describe('encodeHtmlEntities', () => {
  it('escapes HTML-significant characters', () => {
    expect(encodeHtmlEntities('<div class="x">Tom & Jerry</div>')).toBe(
      '&lt;div class=&quot;x&quot;&gt;Tom &amp; Jerry&lt;/div&gt;'
    )
  })

  it('uses named references for accented and typographic characters', () => {
    expect(encodeHtmlEntities('café — “quoted”')).toBe(
      'caf&eacute; &mdash; &ldquo;quoted&rdquo;'
    )
  })

  it('can encode every character', () => {
    const encoded = encodeHtmlEntities('a b', { encodeAll: true })
    expect(encoded).toBe('&#x61;&#x20;&#x62;')
  })

  it('can fall back to numeric references', () => {
    expect(encodeHtmlEntities('©', { named: false })).toBe('&#xA9;')
  })

  it('leaves plain ASCII text untouched', () => {
    expect(encodeHtmlEntities('plain text 123')).toBe('plain text 123')
  })
})

describe('decodeHtmlEntities', () => {
  it('decodes named and numeric references', () => {
    expect(decodeHtmlEntities('&lt;p&gt;caf&eacute; &amp; &#65;&#x42;</p>')).toBe(
      '<p>café & AB</p>'
    )
  })

  it('decodes non-breaking spaces', () => {
    expect(decodeHtmlEntities('a&nbsp;b')).toBe('a\u00a0b')
  })

  it('leaves unknown references untouched', () => {
    expect(decodeHtmlEntities('&bogus; &also-bogus;')).toBe('&bogus; &also-bogus;')
  })

  it('round-trips encoded text', () => {
    const original = '<a href="?a=1&b=2">café “x”</a>'
    expect(decodeHtmlEntities(encodeHtmlEntities(original))).toBe(original)
  })
})
