FROM node:20-alpine

WORKDIR /app

COPY packages/shared /app/packages/shared
WORKDIR /app/packages/shared
RUN npm install --omit=dev --no-audit --no-fund

COPY services/auth-service /app/services/auth-service
WORKDIR /app/services/auth-service
RUN npm install --omit=dev --no-audit --no-fund

EXPOSE 5001

CMD ["npm", "start"]
