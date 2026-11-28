FROM node:24.22.3-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY scripts/build.mjs scripts/build.mjs
COPY src/ src/
RUN npm run build

FROM node:24.22.3-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production PORT=8080 B2C_BIND_HOST=0.0.0.0
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules/ node_modules/
COPY --from=build /app/dist/ dist/
COPY src/ src/
COPY server/ server/
COPY db/ db/
USER node
EXPOSE 8080
CMD ["node", "server/start.mts"]
