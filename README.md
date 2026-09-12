# Moc Front

Frontend Next.js para interfaces financieras generadas dinámicamente por un agente.

## Requisitos

- Node.js 20.9 o superior
- pnpm 11 o superior
- Una instancia compatible del backend del agente

## Configuración

Para ejecutar frontend y backend juntos en otra computadora, usa Node.js 22 y
clona también [`BanorteBackend`](https://github.com/Usualldude21/BanorteBackend).
Configura primero ese repositorio siguiendo su README, aplica sus migraciones
de Supabase y arranca su API en `127.0.0.1:3101`. En el `.env` del backend,
incluye `http://127.0.0.1:3000` en `AGENT_API_ALLOWED_ORIGINS`.

```bash
pnpm install --frozen-lockfile
cp .env.example .env
```

Configura `AGENT_API_URL` con el endpoint `/api/agent` del backend y agrega `SUPABASE_URL` y `SUPABASE_PUBLISHABLE_KEY` del mismo proyecto que utiliza el backend.
No copies el `.env` de otra máquina: genera las credenciales de tu propio
entorno y mantén el fingerprint de `@banorte/contracts` sincronizado con el
backend. El contrato incluido en ambos repositorios tiene la misma versión.

La autenticación de usuario se realiza server-side contra Supabase. Next.js conserva access y refresh token en cookies `HttpOnly`, `SameSite=Strict` y `Secure` en producción. No guardes un JWT de usuario, una `service_role` key ni `SUPABASE_ACCESS_TOKEN` en el frontend. `AGENT_API_TOKEN` sólo existe para compatibilidad con backends legados y no identifica a un usuario bancario.

## Desarrollo

```bash
pnpm dev
```

La aplicación queda disponible en `http://127.0.0.1:3000`.

El checkpoint de datos I3 está disponible únicamente en desarrollo en `http://127.0.0.1:3000/dev/integration-data-harness`. Su UISpecification es un fixture fijo de integración y no forma parte de la experiencia productiva.

## Build y ejecución

```bash
pnpm build
pnpm start
```

El navegador nunca se conecta directamente al proveedor del modelo ni recibe sus API keys. Las consultas pasan por las rutas server-side de Next.js hacia el backend configurado.
