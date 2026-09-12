# Moc Front

Frontend Next.js para interfaces financieras generadas dinámicamente por un agente.

## Requisitos

- Node.js 20.9 o superior
- pnpm 11 o superior
- Una instancia compatible del backend del agente

## Configuración

```bash
pnpm install --frozen-lockfile
cp .env.example .env
```

Configura `AGENT_API_URL` con el endpoint `/api/agent` del backend. Si el backend exige autenticación, usa el mismo valor de `AGENT_API_TOKEN` en ambos servicios.

## Desarrollo

```bash
pnpm dev
```

La aplicación queda disponible en `http://127.0.0.1:3000`.

## Build y ejecución

```bash
pnpm build
pnpm start
```

El navegador nunca se conecta directamente al proveedor del modelo ni recibe sus API keys. Las consultas pasan por las rutas server-side de Next.js hacia el backend configurado.
