FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

COPY . .
RUN npx prisma generate && npm run build

EXPOSE 4000
CMD ["sh", "./docker-entrypoint.sh"]
