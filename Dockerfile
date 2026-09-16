FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY snapshot.json ./snapshot.json
EXPOSE 8080
CMD ["npx", "--no-install", "companygraph-mcp-http", "--snapshot", "snapshot.json"]
