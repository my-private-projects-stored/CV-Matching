FROM node:20-alpine

WORKDIR /app

COPY packages/shared /app/packages/shared
WORKDIR /app/packages/shared
RUN npm install --omit=dev --no-audit --no-fund

COPY services/recommendation-service /app/services/recommendation-service
WORKDIR /app/services/recommendation-service
RUN npm install --omit=dev --no-audit --no-fund

EXPOSE 5005

CMD ["npm", "start"]
