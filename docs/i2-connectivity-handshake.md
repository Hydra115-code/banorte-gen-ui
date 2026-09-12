# Integration I2 — Handshake de conectividad

Estado: implementado y verificado; pendiente de validación humana antes de I3.

## Alcance cerrado

El frontend consulta exclusivamente `GET /api/system/status` mediante su ruta server-side. I2 no envía prompts, no llama al LLM, no consume datos financieros, no ejecuta herramientas MCP y no habilita pagos.

El handshake ahora:

- aplica timeout de 3 segundos y un único reintento ante fallas recuperables;
- propaga `X-Correlation-ID` desde el proxy de Next hacia el backend y lo devuelve al cliente;
- valida el payload con `SystemStatus` del paquete contractual común;
- exige que `contractFingerprint` coincida exactamente con `CONTRACT_FINGERPRINT`;
- no reintenta estados inválidos, contratos incompatibles ni cancelaciones del consumidor;
- distingue conexión en comprobación, conectada y desconectada;
- ofrece recuperación manual mediante `Reintentar` sin perder ni sustituir la experiencia GenUI.

## Gate automatizado

`pnpm integration:handshake:verify` ejecuta cinco casos independientes:

1. acepta el fingerprint canónico y propaga la correlación;
2. rechaza inmediatamente un fingerprint diferente;
3. recupera una falla transitoria con un solo reintento;
4. distingue el timeout de otras fallas;
5. verifica que la ruta y la barra expongan correlación y los tres estados.

## Prueba HTTP y visual real

Con frontend en `127.0.0.1:3000` y backend en `127.0.0.1:3101`:

- el endpoint real del backend respondió `200` con backend, agente y MCP en `ready`;
- el proxy del frontend respondió `200`, preservó el payload y añadió `X-Correlation-ID`;
- la barra mostró `Backend conectado`, capacidades disponibles y `Contrato v1 · d4a19c24`;
- al detener el backend, la barra cambió a `El backend no está disponible` y mostró `Reintentar`;
- tras reiniciar el backend y pulsar `Reintentar`, volvió al estado conectado;
- la consola del navegador no registró errores durante el recorrido.

La prueba no escribió información en el backend ni interactuó con el campo de consulta.

## Límite para I3

I2 sólo demuestra que el backend público está vivo y usa el contrato esperado. La sesión Supabase, el JWT por usuario y las rutas protegidas continúan pendientes. No se debe iniciar I3 hasta validar esta fase.
