FROM node:20-alpine

WORKDIR /app

COPY packages/shared /app/packages/shared
WORKDIR /app/packages/shared
RUN npm install --omit=dev --no-audit --no-fund

COPY services/api-gateway /app/services/api-gateway
WORKDIR /app/services/api-gateway
RUN npm install --omit=dev --no-audit --no-fund

EXPOSE 3001

CMD ["npm", "start"]
