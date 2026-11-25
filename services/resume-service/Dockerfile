FROM node:20-alpine

WORKDIR /app

COPY packages/shared /app/packages/shared
WORKDIR /app/packages/shared
RUN npm install --omit=dev --no-audit --no-fund

COPY services/resume-service /app/services/resume-service
WORKDIR /app/services/resume-service
RUN npm install --omit=dev --no-audit --no-fund

EXPOSE 5002

CMD ["npm", "start"]
