const SHIFTS = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9,
  14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15,
  21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21
]

const CONSTANTS = new Uint32Array(64)
for (let index = 0; index < 64; index += 1) {
  CONSTANTS[index] = Math.floor(Math.abs(Math.sin(index + 1)) * 0x100000000) >>> 0
}

function rotateLeft(value: number, bits: number): number {
  return ((value << bits) | (value >>> (32 - bits))) >>> 0
}

export function md5(input: Uint8Array): Uint8Array {
  const paddedLength = (((input.length + 8) >> 6) + 1) << 6
  const buffer = new Uint8Array(paddedLength)
  buffer.set(input)
  buffer[input.length] = 0x80

  const view = new DataView(buffer.buffer)
  const bitLength = input.length * 8
  view.setUint32(paddedLength - 8, bitLength >>> 0, true)
  view.setUint32(paddedLength - 4, Math.floor(bitLength / 0x100000000), true)

  let a0 = 0x67452301
  let b0 = 0xefcdab89
  let c0 = 0x98badcfe
  let d0 = 0x10325476

  const words = new Uint32Array(16)

  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      words[index] = view.getUint32(offset + index * 4, true)
    }

    let a = a0
    let b = b0
    let c = c0
    let d = d0

    for (let index = 0; index < 64; index += 1) {
      let mixed: number
      let word: number
      if (index < 16) {
        mixed = (b & c) | (~b & d)
        word = index
      } else if (index < 32) {
        mixed = (d & b) | (~d & c)
        word = (5 * index + 1) % 16
      } else if (index < 48) {
        mixed = b ^ c ^ d
        word = (3 * index + 5) % 16
      } else {
        mixed = c ^ (b | ~d)
        word = (7 * index) % 16
      }

      const sum = (a + mixed + CONSTANTS[index] + words[word]) >>> 0
      const rotated = (b + rotateLeft(sum, SHIFTS[index])) >>> 0
      a = d
      d = c
      c = b
      b = rotated
    }

    a0 = (a0 + a) >>> 0
    b0 = (b0 + b) >>> 0
    c0 = (c0 + c) >>> 0
    d0 = (d0 + d) >>> 0
  }

  const output = new Uint8Array(16)
  const outputView = new DataView(output.buffer)
  outputView.setUint32(0, a0, true)
  outputView.setUint32(4, b0, true)
  outputView.setUint32(8, c0, true)
  outputView.setUint32(12, d0, true)
  return output
}

export function md5Hex(input: Uint8Array): string {
  return Array.from(md5(input), (byte) => byte.toString(16).padStart(2, '0')).join('')
}
