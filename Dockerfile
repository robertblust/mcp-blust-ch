FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --chown=node:node snapshot.json ./snapshot.json
COPY --chown=node:node page.css ./page.css
COPY --chown=node:node favicon.svg ./favicon.svg
COPY --chown=node:node brand.html ./brand.html
EXPOSE 8080
USER node
CMD ["node", "node_modules/.bin/companygraph-mcp-http", "--snapshot", "snapshot.json", "--page-css", "page.css", "--page-icon", "favicon.svg", "--page-brand", "brand.html"]
