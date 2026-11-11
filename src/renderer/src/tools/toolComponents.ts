import { lazy, type ComponentType, type LazyExoticComponent } from 'react'

export const toolComponents: Record<string, LazyExoticComponent<ComponentType>> = {
  'json-formatter': lazy(() => import('./JsonFormatter')),
  'json-yaml': lazy(() => import('./JsonYaml')),
  'sql-formatter': lazy(() => import('./SqlFormatter')),
  'diff-checker': lazy(() => import('./DiffChecker')),
  base64: lazy(() => import('./Base64Tool')),
  'url-encoder': lazy(() => import('./UrlEncoder')),
  'html-entities': lazy(() => import('./HtmlEntities')),
  'jwt-decoder': lazy(() => import('./JwtDecoder')),
  'hash-generator': lazy(() => import('./HashGenerator')),
  'regex-tester': lazy(() => import('./RegexTester')),
  'uuid-generator': lazy(() => import('./UuidGenerator')),
  'qr-generator': lazy(() => import('./QrGenerator')),
  'timestamp-converter': lazy(() => import('./TimestampConverter')),
  'cron-parser': lazy(() => import('./CronParser')),
  'color-converter': lazy(() => import('./ColorConverter'))
}
