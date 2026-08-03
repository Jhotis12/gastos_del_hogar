#!/usr/bin/env bash
# Reinicia el usuario sandbox para que las pruebas e2e partan de cero.
# Por defecto apunta al proyecto del .env (producción). Para el entorno
# LOCAL (supabase start) sobreescribe: 
#   SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SERVICE_ROLE=<key local> bash tests/reset-sandbox.sh
# La service role local se obtiene con `supabase status` (o se deriva del
# secret por defecto del CLI cuando config.toml no define jwt_secret).
set -euo pipefail

URL="${SUPABASE_URL:-$(grep '^VITE_SUPABASE_URL' .env | cut -d= -f2)}"
SRV="${SUPABASE_SERVICE_ROLE:?Define SUPABASE_SERVICE_ROLE en el entorno}"

EMAIL="sandbox-test@test.com"
PASS="Sandbox123!"

# Eliminar usuario existente (borra en cascada hogar, gastos, salarios, etc.)
# NOTA: NO usar ?email= en el endpoint admin (filtra mal y puede borrar a otro
# usuario); se lista todo y se filtra por email exacto en python.
USER_ID=$(curl -s "$URL/auth/v1/admin/users" -H "Authorization: Bearer $SRV" -H "apikey: $SRV" | python3 -c "
import sys, json
d = json.load(sys.stdin)
match = [u for u in d.get('users', []) if u.get('email') == '$EMAIL']
print(match[0]['id'] if match else '')
")
if [ -n "$USER_ID" ]; then
  curl -s -o /dev/null -w "usuario sandbox eliminado: HTTP %{http_code}\n" \
    -X DELETE "$URL/auth/v1/admin/users/$USER_ID" -H "Authorization: Bearer $SRV" -H "apikey: $SRV"
fi

# Crear usuario nuevo con correo confirmado
curl -s -X POST "$URL/auth/v1/admin/users" \
  -H "Authorization: Bearer $SRV" -H "apikey: $SRV" -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"email_confirm\":true,\"user_metadata\":{\"full_name\":\"Sandbox Test\"}}" \
  | python3 -c "import sys,json; print('sandbox listo:', json.load(sys.stdin).get('id'))"
