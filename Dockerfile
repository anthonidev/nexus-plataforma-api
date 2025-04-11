# Etapa base
FROM node:20-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Etapa de construcción
FROM base AS builder
WORKDIR /app
# RUN --mount=type=cache,id=pnpm,target=/pnpm/store 
COPY . .
RUN pnpm build

# Etapa de producción
FROM node:20-slim AS runner
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable  # Asegúrate de habilitar corepack en la etapa runner
WORKDIR /usr/src/app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile
COPY --from=builder /app/dist ./dist
CMD [ "node", "dist/main" ]