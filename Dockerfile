# albyhub-admin-mcp — container image for Glama's introspection check (stdio MCP server).
#
# Glama starts this and sends MCP `initialize` + `tools/list`. The PLACEHOLDER Alby Hub
# URL + token below let config validate and the server list all its tools WITHOUT a real
# node — the Hub is only contacted when a tool is *called* (introspection never calls
# tools), so no real secrets are needed.
FROM node:22-slim AS build
WORKDIR /app
COPY package.json tsconfig.json ./
RUN npm install
COPY src ./src
RUN npm run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
ENV ALBYHUB_URL="http://localhost:8080"
ENV ALBYHUB_TOKEN="placeholder-introspection-only"
ENV ALBYHUB_READ_ONLY="true"
COPY package.json ./
RUN npm install --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
ENTRYPOINT ["node", "dist/index.js"]
