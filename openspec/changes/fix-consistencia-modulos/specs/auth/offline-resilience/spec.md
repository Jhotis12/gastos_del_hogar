# Spec Delta

## MODIFIED Requirements

### Requirement: Criterio único de error de red

El sistema SHALL centralizar la detección de errores de red en dos capas:
`isPureNetworkError(err)`, clasificador puro que solo inspecciona el error
(`TypeError` de fetch, mensajes `fetch failed`/`Network request failed`/
`ERR_INTERNET_DISCONNECTED`) y NO lee `navigator`; y el wrapper
`isNetworkError(err)` = `isPureNetworkError(err) || !navigator.onLine`, que es
el criterio para tratar un flujo como transitorio. Ese criterio, junto con
`isAuthRetryableFetchError` de `@supabase/supabase-js`, SHALL usarse en
`useAuth`, `supabase.ts` (`offlineAwareFetch`) y `offline/sync.ts`.

#### Scenario: WiFi conectado sin internet se trata como offline

- **WHEN** `navigator.onLine===true` pero `fetch` a Supabase rechaza con `TypeError: Failed to fetch` o respuesta no-JSON de portal cautivo
- **THEN** `isNetworkError` retorna `true` y el flujo se clasifica como transitorio (no logout, encola en outbox)

#### Scenario: Error retryable de auth también reintenta el drenado

- **WHEN** `offline/sync.ts` recibe `isAuthRetryableFetchError` al reproducir una operación encolada
- **THEN** el drenado se detiene con `retry` (no descarta el ítem) y el heartbeat lo reintenta

#### Scenario: El clasificador puro no depende del navegador

- **WHEN** se llama `isPureNetworkError` con un error que no es de red y `navigator.onLine===false`
- **THEN** retorna `false`: el estado del navegador lo aporta únicamente el wrapper `isNetworkError`
