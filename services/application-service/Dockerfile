FROM node:20-alpine

WORKDIR /app

COPY packages/shared /app/packages/shared
WORKDIR /app/packages/shared
RUN npm install --omit=dev --no-audit --no-fund

COPY services/application-service /app/services/application-service
WORKDIR /app/services/application-service
RUN npm install --omit=dev --no-audit --no-fund

EXPOSE 5004

CMD ["npm", "start"]
