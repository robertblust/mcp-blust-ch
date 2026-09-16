FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --chown=node:node snapshot.json ./snapshot.json
EXPOSE 8080
USER node
CMD ["node", "node_modules/.bin/companygraph-mcp-http", "--snapshot", "snapshot.json"]
