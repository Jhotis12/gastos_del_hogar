# Plantillas de correo

Plantillas de los emails de Supabase Auth (GoTrue). Supabase no permite
versionarlas vía CLI/migraciones: **se pegan en el dashboard**. Este
directorio las mantiene versionadas en el repo.

## Aplicar la plantilla de confirmación (Confirm signup)

1. Dashboard de Supabase → **Authentication → Emails → Templates**.
2. En **Confirm signup**:
   - **Subject**: `Confirma tu correo · Gastos del Hogar`
   - **HTML content**: pegar el contenido de `confirm-signup.html`
     (botón "Copy" en la vista del editor / copiar el archivo).
3. Guardar y enviar una prueba ("Send test email").

Variables disponibles: `{{ .SiteURL }}`, `{{ .ConfirmationURL }}`, `{{ .Email }}`,
`{{ .Token }}`. El logo usa `{{ .SiteURL }}/icono.svg` — para que cargue,
el **Site URL** de Auth (Settings → URL Configuration) debe apuntar al
dominio real de la app (Vercel).

> ⚠️ El tema del **asunto en inglés** ("Confirm your email address") es el
> asunto por defecto de GoTrue: se corrige solo al cambiar el Subject del
> template (paso 2).

## Por qué el correo llega a Spam (y cómo arreglarlo)

El correo se envía desde el remitente por defecto de Supabase
(`no-reply@supabase.co`) **sin DKIM propio** — por eso muchos proveedores
(Gmail, Outlook) lo clasifican como spam. Opciones en orden de recomendación:

1. **Custom Email Domain (recomendado)** — Dashboard → Authentication →
   Emails → **Custom email**: Supabase envía desde `no-reply@tudominio`
   configurando automáticamente **SPF + DKIM** (registros DNS que te da el
   dashboard). Es la vía más rápida y sin costo de operación.
2. **SMTP propio (Resend / SES / SendGrid)** — Dashboard → Authentication →
   Emails → SMTP settings: host/port/usuario/clave de tu proveedor. Con
   Resend, el dominio queda firmado con DKIM en su panel (SPF y DKIM
   verificados → Gmail no lo marca como spam).

Tras cualquiera de las dos, verifica con la opción "Send test email" y
revisa en Gmail → "Ver original" que aparezcan `spf=pass` y `dkim=pass`.

## Vigencia del enlace y pantalla de expirado

- El enlace de confirmación expira según **OTP expiry** (por defecto
  **1 hora**; Dashboard → Authentication → Settings → Email OTP Expiry).
- Si el usuario abre un enlace vencido/inválido, la app lo muestra en
  `/auth/confirm` (la pantalla de `AuthConfirm.tsx`): valida el token con
  `verifyOtp` y muestra "El enlace de confirmación no es válido o ya fue
  usado" con botón a iniciar sesión. La plantilla informa la vigencia
  ("El enlace vence en 1 hora") para evitar el caso.

## Otras plantillas

Las demás (reset password, change email) pueden reutilizar el mismo shell
visual: cabecera pine + CTA flat. Crear su archivo aquí cuando se requiera.
