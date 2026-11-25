FROM node:20-alpine

WORKDIR /app

COPY packages/shared /app/packages/shared
WORKDIR /app/packages/shared
RUN npm install --omit=dev --no-audit --no-fund

COPY services/ai-enrichment-service /app/services/ai-enrichment-service
WORKDIR /app/services/ai-enrichment-service
RUN npm install --omit=dev --no-audit --no-fund

EXPOSE 5006

CMD ["npm", "start"]
