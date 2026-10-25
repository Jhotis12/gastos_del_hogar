# Spec Delta

## Purpose

Permite dictar un gasto por voz y convertirlo en un borrador editable, con
confirmación humana y privacidad, para reducir la fricción de registrar gastos.

## ADDED Requirements

### Requirement: Función detrás de una bandera

La captura por voz SHALL estar deshabilitada por defecto y SHALL activarse con
una bandera de configuración. Cuando esté deshabilitada, el botón de micrófono
SHALL NOT aparecer y el flujo manual de gasto SHALL funcionar igual.

#### Scenario: Bandera apagada

- **WHEN** la bandera de voz está deshabilitada
- **THEN** el formulario de gasto no muestra el micrófono y no hay llamadas a la función de audio

#### Scenario: Bandera encendida

- **WHEN** la bandera está habilitada y el usuario tiene sesión y hogar
- **THEN** el formulario ofrece la opción de dictar un gasto

### Requirement: Grabación de audio controlada

El usuario SHALL poder iniciar, detener y cancelar una grabación desde la app.
La grabación SHALL tener un límite de duración y tamaño, SHALL pedir permiso de
micrófono y SHALL mostrar un estado visible de grabación. Sin permiso o sin
micrófono, SHALL mostrar un mensaje claro y ofrecer el formulario manual.

#### Scenario: Grabar y detener

- **WHEN** el usuario toca el micrófono, habla y detiene la grabación
- **THEN** ve el audio listo para analizar y puede cancelarlo antes de enviarlo

#### Scenario: Cancelar

- **WHEN** el usuario cancela durante la grabación o antes del análisis
- **THEN** no se envía audio y no se crea ningún gasto

#### Scenario: Sin permiso de micrófono

- **WHEN** el navegador niega el permiso de micrófono
- **THEN** la app explica cómo habilitarlo y deja el formulario manual disponible

#### Scenario: Límite de duración

- **WHEN** la grabación alcanza el máximo configurado
- **THEN** se detiene automáticamente y se informa el límite

### Requirement: Compatibilidad con el formato del navegador

La app SHALL normalizar el MIME que agrega `MediaRecorder` (`audio/webm;codecs=opus`
→ `audio/webm`) y SHALL quitar el prefijo `data:...;base64,` antes de enviar el
audio. La Edge Function SHALL aceptar también clientes viejos que envían el data
URL completo, sin fallar en `atob`.

#### Scenario: Chrome con codecs

- **WHEN** Chrome graba `audio/webm;codecs=opus` y `FileReader` devuelve `data:audio/webm;codecs=opus;base64,...`
- **THEN** la función recibe `mime_type = audio/webm` y `audio_base64` sin el prefijo

#### Scenario: Cliente viejo con data URL

- **WHEN** un cliente ya desplegado envía el data URL completo en `audio_base64`
- **THEN** la función lo limpia antes de decodificar y el análisis continúa

#### Scenario: Error de formato

- **WHEN** el MIME no es de audio o el base64 está vacío
- **THEN** la función responde 400 con un mensaje claro y la app ofrece el formulario manual

### Requirement: Extracción estructurada del gasto

La función de análisis SHALL recibir el audio y devolver un borrador
estructurado con monto, descripción, fecha, categoría sugerida y pagador
sugerido. El monto SHALL interpretarse en pesos colombianos. Si el audio no
alcanza para determinar el monto, la función SHALL devolver un error de
comprensión y SHALL NOT inventar un valor.

#### Scenario: Audio claro

- **WHEN** el usuario dice “gasté cincuenta mil en el mercado de ayer”
- **THEN** el borrador propone monto 50.000, descripción relacionada con mercado y fecha de ayer

#### Scenario: Audio ambiguo

- **WHEN** el audio no permite determinar el monto
- **THEN** la app muestra que no pudo entender el gasto y ofrece completar el formulario manual

#### Scenario: Categoría sugerida inválida

- **WHEN** la IA sugiere una categoría que no existe en el hogar
- **THEN** el borrador deja la categoría vacía y el usuario puede elegir una válida

### Requirement: Confirmación humana antes de crear

La app SHALL mostrar el borrador en un formulario editable y SHALL crear el
gasto solo cuando el usuario confirme. SHALL NOT crear un gasto definitivo de
forma silenciosa a partir del audio. El pagador por defecto SHALL ser el usuario
actual y SHALL poder cambiarse a otro miembro. La fecha por defecto SHALL ser
hoy si la IA no propone una fecha válida.

#### Scenario: Confirmar borrador

- **WHEN** el usuario revisa el borrador y toca “Crear gasto”
- **THEN** se crea un gasto normal con pagador, fecha y categoría confirmados, y aparece en los totales correspondientes

#### Scenario: Editar antes de crear

- **WHEN** el usuario corrige el monto o la descripción del borrador
- **THEN** el gasto creado usa los valores corregidos y no los de la IA

#### Scenario: Descartar borrador

- **WHEN** el usuario cierra el borrador sin confirmar
- **THEN** no se crea ningún gasto y el audio se descarta

#### Scenario: Otro pagador

- **WHEN** el audio menciona que pagó otra persona y el usuario lo confirma
- **THEN** el gasto se crea con ese pagador y descuenta sus totales, no los del usuario que dictó

### Requirement: Errores y fallback manual

Ante audio vacío, ruido, timeout, cuota agotada, error de red o respuesta
inválida de la IA, la app SHALL mostrar un mensaje comprensible y SHALL ofrecer
el formulario manual. SHALL NOT dejar una promesa rechazada sin manejar ni un
gasto a medias.

#### Scenario: Timeout

- **WHEN** la función tarda más del límite
- **THEN** la app cancela la espera, muestra un mensaje y permite reintentar o registrar manualmente

#### Scenario: Cuota agotada

- **WHEN** la función responde 429 por límite de uso
- **THEN** la app muestra el mensaje del límite y no reintenta en bucle

#### Scenario: Sin red

- **WHEN** el usuario intenta dictar un gasto sin conexión
- **THEN** la app avisa que la voz requiere red y ofrece el formulario manual; el gasto manual sigue disponible offline

### Requirement: Privacidad y seguridad del audio

La función SHALL validar el JWT, el hogar y el límite de uso por usuario. El
audio SHALL enviarse solo a la función de análisis, SHALL NOT almacenarse de
forma permanente y SHALL descartarse después de procesarlo. Los logs SHALL NOT
contener el audio ni transcripciones completas. La app SHALL informar que el
audio se procesa con IA y SHALL pedir consentimiento antes de la primera
grabación.

#### Scenario: Sin sesión

- **WHEN** se invoca la función sin JWT válido
- **THEN** responde 401 y no procesa audio

#### Scenario: Otro hogar

- **WHEN** un usuario intenta analizar audio para un hogar al que no pertenece
- **THEN** la función rechaza la petición sin llamar a Gemini

#### Scenario: Límite de uso

- **WHEN** el usuario supera el número de análisis permitidos en la ventana definida
- **THEN** la función responde 429 y no consume cuota de Gemini

#### Scenario: Audio no persistido

- **WHEN** el análisis termina o falla
- **THEN** el archivo de audio se elimina y no queda accesible desde Storage

#### Scenario: Consentimiento

- **WHEN** el usuario usa la voz por primera vez
- **THEN** ve un aviso de procesamiento con IA y puede aceptar o usar el formulario manual

### Requirement: Accesibilidad del flujo de voz

La captura por voz SHALL tener alternativa de texto, SHALL poder iniciarse y
detenerse con teclado, SHALL anunciar el estado de grabación y análisis a
lectores de pantalla y SHALL NOT ser la única forma de registrar un gasto.

#### Scenario: Teclado

- **WHEN** el usuario navega con teclado hasta el botón de micrófono
- **THEN** puede iniciar y detener la grabación sin usar el ratón

#### Scenario: Lector de pantalla

- **WHEN** la grabación cambia de estado
- **THEN** el cambio se anuncia con un texto accesible

#### Scenario: Alternativa manual

- **WHEN** el usuario no puede o no quiere usar voz
- **THEN** el formulario manual sigue completo y accesible

### Requirement: Pruebas de la captura por voz

La funcionalidad SHALL probarse con un audio fixture, con la IA mockeada en CI,
con límites y errores, y con una prueba manual contra Gemini real antes de
cerrar la fase. Las pruebas SHALL verificar que no se crea un gasto sin
confirmación y que no se duplica al reintentar.

#### Scenario: Fixture en CI

- **WHEN** corre la suite de voz en CI con Gemini mockeado
- **THEN** el audio fixture produce un borrador esperado y la confirmación crea exactamente un gasto

#### Scenario: Reintento

- **WHEN** el usuario reintenta después de un timeout y luego confirma una sola vez
- **THEN** se crea un solo gasto

#### Scenario: Prueba real

- **WHEN** se prueba manualmente con Gemini real y un audio grabado en la app
- **THEN** el borrador es comprensible y el usuario puede corregirlo antes de crear el gasto

### Requirement: Compatibilidad con el escaneo de facturas

La captura por voz SHALL reutilizar el patrón de autenticación, validación de
hogar, rate limit y errores del escaneo de facturas sin romper el flujo
existente. Si se extraen helpers compartidos, el escaneo de facturas SHALL
seguir funcionando con sus pruebas actuales.

#### Scenario: Facturas intactas

- **WHEN** se ejecuta el flujo de escaneo de facturas después del cambio
- **THEN** la subida, el análisis y la creación del gasto siguen funcionando

#### Scenario: Errores consistentes

- **WHEN** la función de voz o la de facturas recibe un error de cuota o sesión
- **THEN** ambas devuelven mensajes comprensibles y no exponen detalles internos
