FROM node:20-alpine

WORKDIR /app

COPY packages/shared /app/packages/shared
WORKDIR /app/packages/shared
RUN npm install --omit=dev --no-audit --no-fund

COPY services/notification-service /app/services/notification-service
WORKDIR /app/services/notification-service
RUN npm install --omit=dev --no-audit --no-fund

EXPOSE 5007

CMD ["npm", "start"]
