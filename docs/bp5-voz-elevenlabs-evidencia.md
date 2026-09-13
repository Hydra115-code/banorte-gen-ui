# BP5 · Voz con ElevenLabs

Estado: **cerrada para la demo de banca personal**, con revisión humana obligatoria del borrador antes de enviar.

## Implementación

- El backend emite un token efímero de ElevenLabs sólo para una sesión Supabase válida; el frontend valida la respuesta y conecta `scribe_v2_realtime` en español con VAD.
- La UI diferencia conectar, escuchar, listo y error. Parciales reemplazan el parcial anterior; segmentos confirmados se acumulan en el borrador editable.
- Mientras el micrófono está activo, Enter y el botón principal sólo terminan el dictado. El botón dice «Revisar»; un segundo gesto explícito envía la consulta. Editar el texto detiene la captura para que un evento tardío no sobrescriba la corrección.
- Un identificador de intento descarta eventos o conexiones tardías después de cancelar. Errores de permiso, dispositivo o red conservan el campo de texto.
- En móvil, los estados de voz son visibles; tras dictar se advierte revisar importes y fechas.
- BP5 no cambió el backend, los contratos compartidos ni los datos.

## Pruebas

- Token efímero en vivo: HTTP 200, modelo `scribe_v2_realtime`, idioma `es`, estrategia `vad`; sin revelar API key ni token en la evidencia.
- Audio sintético local «Compara mis gastos de julio y agosto»: 3 eventos parciales y una transcripción confirmada correcta.
- Audio sintético con pausa y ruido leve, importes, meses y categoría: 12 parciales y una confirmación; Scribe reconoció el sentido, pero segmentó el importe hablado «27 mil 600» de forma ambigua. Por eso no se envía automáticamente y se exige revisión de cifras.
- Pregunta escrita y transcripción sintética de la primera frase, enviadas al agente en sesiones aisladas: ambas devolvieron UI, sin error y con los mismos importes bancarios de julio y agosto.
- Navegador con micrófono real: el campo recibió transcripción parcial/confirmada y mostró «Escuchando…» y «Revisar». La captura se detuvo. Hubo interacción concurrente en la pestaña compartida, así que no se atribuyen a la voz los envíos observados durante esa toma; la ruta de código que envía se separó explícitamente de la ruta de dictado y quedó cubierta por regresión.
- Backend detenido temporalmente: el botón mostró un error recuperable y el campo permitió escribir una consulta; el backend se volvió a levantar.
- Pruebas: `pnpm test:transcription` del backend 3/3; pruebas específicas de borrador 4/4, errores 3/3, seguridad del compositor 3/3; `pnpm quality:verify` 8/8 y `pnpm banking:verify` 12/12.
- Build de producción: correcto tras el ajuste final del aviso de voz.

## Límite conocido

La precisión numérica de STT no es infalible, especialmente con ruido. El aviso de revisión y el paso explícito «Revisar» son parte del gate de seguridad. La denegación real de permiso no se forzó en el navegador compartido; se probó la clasificación de `NotAllowedError` y se observó en vivo la alternativa escrita ante caída del servicio.

Referencia del protocolo: [Scribe client-side streaming](https://elevenlabs.io/docs/eleven-api/guides/how-to/speech-to-text/realtime/client-side-streaming) y [single-use token](https://elevenlabs.io/docs/api-reference/tokens/create).
