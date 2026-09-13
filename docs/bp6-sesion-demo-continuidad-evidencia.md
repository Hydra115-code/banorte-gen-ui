# BP6 · Sesión demo y continuidad

Estado: **cerrada y validada en vivo para la demo local el 12 de septiembre de 2026**.

## Cambios

- La ruta principal comprueba la sesión contra Supabase antes de mostrar información financiera. El login normal usa Supabase; no hay bypass de RLS.
- La entrada demo es opcional y sólo opera con credenciales de servidor y una cuenta Supabase normal. Está apagada por defecto; se habilitó para desarrollo local con `.env.development.local` ignorado por Git. El despliegue debe configurar sus propias variables de servidor si se desea el botón.
- El `refresh_token` rota cookies HttpOnly. Una consulta READ que recibe 401 del agente se reintenta una sola vez antes de abrir el stream; la recuperación del snapshot también contempla 401.
- Ante autenticación fallida, el frontend conserva la pregunta escrita y muestra el acceso. Al cambiar de usuario, descarta el archivo local anterior. El archivo de sesión se vincula a una identidad derivada en servidor y se valida al restaurar.
- El encabezado incluye «Salir». El backend y los contratos compartidos no se modificaron en BP6.
- La ruta de sesión de ElevenLabs ya no acepta `AGENT_API_TOKEN` ni `SUPABASE_ACCESS_TOKEN` como respaldo de una cookie faltante; también renueva el JWT del usuario cuando corresponde.

## Evidencia disponible

- `pnpm build`: compilación de producción correcta.
- `pnpm session:verify`: 7/7, incluida restauración rechazada para otra identidad.
- `pnpm protocol:verify`: 5/5.
- `pnpm banking:verify`: 12/12.
- `pnpm integration:data:verify`: 6/6.
- `pnpm integration:streaming-ui:verify`: 5/5.
- `pnpm integration:ui-interaction:verify`: 5/5.
- `pnpm quality:verify`: 8/8, incluida la prohibición de token estático en voz.
- Navegador local: con autorización explícita del usuario, «Salir» abrió el acceso, mostró «Entrar a demostración» y eliminó el análisis anterior. La demo entró como sesión protegida sin contraseña en la UI.
- Petición sin cookies a `/api/auth/session`: `authenticated=false`, `demoAvailable=false`, sin tokens en la respuesta. `POST /api/auth/demo` devolvió 404 con el modo demo apagado.
- Con el modo demo local activo: `POST /api/auth/demo` devolvió 200; sesión posterior autenticada y dos cookies HttpOnly/SameSite Strict.
- Andrea, Bruno y Carla iniciaron sesión real por HTTP en tres contextos de cookies aislados. Sus claves de propietario fueron distintas y sus resúmenes bancarios respondieron 200.
- RLS real en Supabase usando los JWT emitidos: Andrea vio sólo sus 3 cuentas, Bruno sólo la suya y Carla sólo la suya; las consultas por `user_id` ajeno devolvieron cero filas en los tres casos.
- Con sólo el refresh token, `/api/auth/session` restauró a la misma identidad y rotó dos cookies. Un refresh inválido devolvió sesión no autenticada y dos cookies eliminadas.
- Consulta READ real a `/api/agent` con JWT alterado y refresh válido: respuesta 200, dos cookies rotadas, evento UI generado y ningún error de autenticación. Esto ejercitó el rechazo 401 seguido de un único reintento.
- En navegador, una consulta compleja de comparación julio/agosto generó respuesta, métricas y tabla sin perder la sesión; el análisis siguió visible después de solicitar recarga.
- Bajo la sesión demo visual, «Compara mis gastos de julio y agosto» generó conclusión, métricas y tabla. La sesión y el análisis siguieron visibles tras solicitar recarga/navegar otra vez a `/`.
- `POST /api/transcription/realtime-session` sin cookies devolvió 401 incluso con demo local activo.

## Gate de BP6

Cumplido para la demo local: sesión real de Supabase, refresh server-side, cookies rotadas, reintento READ, rechazo de refresh inválido, RLS de las tres identidades, restauración vinculada al propietario y entrada demo visual. No se modificaron backend ni contratos.

La cuenta demo sólo está configurada en `.env.development.local`, ignorado por Git. En BP7, el entorno de entrega deberá recibir las variables demo como secretos del servidor; sin ellas el producto sigue ofreciendo login normal. La limpieza de la marca textual `OBSERVED` y la profundidad de algunas respuestas comparativas pertenecen al ensayo de calidad de la UI, no al gate de sesión.
