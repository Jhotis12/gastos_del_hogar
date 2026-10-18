## Qué cambia

<!-- Resumen claro del cambio. Si hay migración, incluir el nombre del archivo. -->

## Cómo se probó

- [ ] `pnpm build`
- [ ] `pnpm lint`
- [ ] Suite e2e local (`node tests/e2e-flow.mjs`) o CI en verde
- [ ] Si toca BD: `supabase db reset --local` / `supabase migration up --local` y e2e local

## Checklist

- [ ] Sin secretos ni datos reales en el diff
- [ ] No se tocó producción a mano (Vercel/Supabase remoto)
- [ ] Si es migración: probada en local y `supabase db push --dry-run` revisado

<!-- La aceptación/merge la hace @Jhotis12. No mergear con checks en rojo. -->
