FROM node:20-alpine

WORKDIR /app

COPY packages/shared /app/packages/shared
WORKDIR /app/packages/shared
RUN npm install --omit=dev --no-audit --no-fund

COPY services/config-analytics-service /app/services/config-analytics-service
WORKDIR /app/services/config-analytics-service
RUN npm install --omit=dev --no-audit --no-fund

EXPOSE 5008

CMD ["npm", "start"]
