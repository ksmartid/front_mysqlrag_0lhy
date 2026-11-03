# ---------- 1단계: 빌드 ----------
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

ENV VITE_API_BASE=/api

RUN npm run build \
    && if [ -d dist ]; then mv dist /app/out; else mv build /app/out; fi

# ---------- 2단계: 실행 (Nginx) ----------
FROM nginx:1.27-alpine
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/out /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
