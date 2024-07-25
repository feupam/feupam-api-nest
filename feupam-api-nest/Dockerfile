FROM node:21-slim

WORKDIR /home/node/app

RUN apt update && apt install -y openssl procps

COPY package*.json ./

RUN npm install -g @nestjs/cli
RUN npm install -g prisma

COPY . .

RUN npx prisma generate

USER node

CMD tail -f /dev/null