FROM nginx:1.27-alpine

# Cloud Run надає порт через $PORT (за замовчуванням 8080).
# Підставляємо його в конфіг nginx при старті.
ENV PORT=8080

WORKDIR /usr/share/nginx/html

# Чистимо дефолтний контент і копіюємо сайт
RUN rm -rf ./*
COPY index.html styles.css app.js guides-data.js r8-data.js ./
COPY assets/ ./assets/

# Шаблон конфіга nginx (порт підставиться через envsubst)
COPY nginx.conf /etc/nginx/templates/default.conf.template

EXPOSE 8080
