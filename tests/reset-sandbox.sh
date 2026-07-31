#!/usr/bin/env bash
# Reinicia el usuario sandbox para que las pruebas e2e partan de cero.
# Requiere: VITE_SUPABASE_URL en .env y SUPABASE_SERVICE_ROLE en el entorno.
set -euo pipefail

URL=$(grep '^VITE_SUPABASE_URL' .env | cut -d= -f2)
SRV="${SUPABASE_SERVICE_ROLE:?Define SUPABASE_SERVICE_ROLE en el entorno}"

EMAIL="sandbox-test@test.com"
PASS="Sandbox123!"

# Eliminar usuario existente (borra en cascada hogar, gastos, salarios, etc.)
USER_JSON=$(curl -s "$URL/auth/v1/admin/users?email=$EMAIL" -H "Authorization: Bearer $SRV" -H "apikey: $SRV")
USER_ID=$(echo "$USER_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['users'][0]['id'] if d['users'] else '')")
if [ -n "$USER_ID" ]; then
  curl -s -o /dev/null -w "usuario sandbox eliminado: HTTP %{http_code}\n" \
    -X DELETE "$URL/auth/v1/admin/users/$USER_ID" -H "Authorization: Bearer $SRV" -H "apikey: $SRV"
fi

# Crear usuario nuevo con correo confirmado
curl -s -X POST "$URL/auth/v1/admin/users" \
  -H "Authorization: Bearer $SRV" -H "apikey: $SRV" -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"email_confirm\":true,\"user_metadata\":{\"full_name\":\"Sandbox Test\"}}" \
  | python3 -c "import sys,json; print('sandbox listo:', json.load(sys.stdin).get('id'))"
