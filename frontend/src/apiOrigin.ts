/// <reference types="vite/client" />
export const hosted = import.meta.env.VITE_HOSTED === '1'
const target = import.meta.env.VITE_API_ORIGIN ?? ''
if (hosted && !/^https:\/\/[a-z0-9][a-z0-9-]{0,62}\.up\.railway\.app$/.test(target)) {
  throw new Error('The hosted build requires an exact Railway API origin.')
}
export const apiOrigin = hosted ? target : ''
