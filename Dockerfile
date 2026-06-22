# Stage 1: build
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: serve
FROM nginx:1.27-alpine
ENV PORT=8080
WORKDIR /usr/share/nginx/html
RUN rm -rf ./*
COPY --from=builder /app/dist ./
COPY nginx.conf /etc/nginx/templates/default.conf.template
EXPOSE 8080
