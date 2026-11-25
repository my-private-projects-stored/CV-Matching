FROM node:20-alpine

WORKDIR /app

COPY packages/shared /app/packages/shared
WORKDIR /app/packages/shared
RUN npm install --omit=dev --no-audit --no-fund

COPY services/job-service /app/services/job-service
WORKDIR /app/services/job-service
RUN npm install --omit=dev --no-audit --no-fund

EXPOSE 5003

CMD ["npm", "start"]
