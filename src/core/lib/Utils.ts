export const SECONDS_IN_YEAR = 31536000

export function getNowSeconds() {
  if (process.env.NODE_ENV === 'development' && process.env.FAKE_TIME) {
    const ts = parseInt(process.env.FAKE_TIME, 10)
    return ts
  }

  return Math.floor(new Date().getTime() / 1000)
}

export function zip<T, K>(a: T[], b: K[]) {
  return a.map((k, i) => [k, b[i]])
}
