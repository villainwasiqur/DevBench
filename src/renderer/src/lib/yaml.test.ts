import { describe, expect, it } from 'vitest'
import { jsonToYaml, yamlToJson } from './yaml'

describe('jsonToYaml', () => {
  it('converts nested JSON to block YAML', () => {
    const result = jsonToYaml('{"a":1,"b":[true,"x"]}')
    expect(result).toEqual({ ok: true, value: 'a: 1\nb:\n  - true\n  - x\n' })
  })

  it('respects the requested indentation', () => {
    const result = jsonToYaml('{"a":{"b":1}}', { indent: 4 })
    expect(result).toEqual({ ok: true, value: 'a:\n    b: 1\n' })
  })

  it('sorts keys when requested', () => {
    const result = jsonToYaml('{"b":2,"a":1}', { sortKeys: true })
    expect(result).toEqual({ ok: true, value: 'a: 1\nb: 2\n' })
  })

  it('quotes strings that YAML would coerce', () => {
    const result = jsonToYaml('{"version":"0.2.0","enabled":"true","count":"123"}')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toContain('version: 0.2.0')
    expect(result.value).toContain('enabled: "true"')
    expect(result.value).toContain('count: "123"')
  })

  it('reports invalid JSON with a location', () => {
    const result = jsonToYaml('{\n  "a": 1,\n}')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.line).toBe(3)
    expect(result.error.column).toBe(1)
  })

  it('rejects empty input', () => {
    expect(jsonToYaml('   ')).toEqual({
      ok: false,
      error: { message: 'Paste JSON to convert.' }
    })
  })
})

describe('yamlToJson', () => {
  it('converts YAML to formatted JSON', () => {
    const result = yamlToJson('name: toolkit\nversions:\n  - 0.2\n  - 0.3\n')
    expect(result).toEqual({
      ok: true,
      value: '{\n  "name": "toolkit",\n  "versions": [\n    0.2,\n    0.3\n  ]\n}'
    })
  })

  it('ignores comments', () => {
    const result = yamlToJson('# config\na: 1 # trailing\n')
    expect(result).toEqual({ ok: true, value: '{\n  "a": 1\n}' })
  })

  it('minifies when requested', () => {
    const result = yamlToJson('a: 1\nb: 2\n', { minify: true })
    expect(result).toEqual({ ok: true, value: '{"a":1,"b":2}' })
  })

  it('keeps unquoted scalars in their YAML types', () => {
    const result = yamlToJson('date: 2020-01-01\nnum: 12\nflag: true\n')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(JSON.parse(result.value)).toEqual({ date: '2020-01-01', num: 12, flag: true })
  })

  it('combines multi-document YAML into an array', () => {
    const result = yamlToJson('a: 1\n---\nb: 2\n')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(JSON.parse(result.value)).toEqual([{ a: 1 }, { b: 2 }])
  })

  it('resolves anchors and aliases', () => {
    const result = yamlToJson('defaults: &defaults\n  retries: 3\nprod: *defaults\n')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(JSON.parse(result.value)).toEqual({
      defaults: { retries: 3 },
      prod: { retries: 3 }
    })
  })

  it('reports invalid YAML with a location', () => {
    const result = yamlToJson('a: [1, 2\nb: 3\n')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.message.length).toBeGreaterThan(0)
    expect(result.error.line).toBe(2)
    expect(result.error.column).toBe(1)
  })

  it('rejects circular aliases that JSON cannot represent', () => {
    const result = yamlToJson('a: &a\n  b: *a\n')
    expect(result).toEqual({
      ok: false,
      error: { message: 'YAML aliases create a circular reference that JSON cannot represent.' }
    })
  })

  it('rejects empty input', () => {
    expect(yamlToJson('  \n')).toEqual({
      ok: false,
      error: { message: 'Paste YAML to convert.' }
    })
  })
})
