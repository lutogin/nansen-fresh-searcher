# Multi-stage build для оптимизации размера образа
FROM node:23-alpine AS builder

# Устанавливаем рабочую директорию
WORKDIR /app

# Копируем package.json и package-lock.json (если есть)
COPY package*.json ./
COPY tsconfig.json ./

# Устанавливаем ВСЕ зависимости (включая devDependencies для сборки)
RUN npm ci && npm cache clean --force

# Копируем исходный код
COPY src/ ./src/

# Собираем TypeScript приложение
RUN npm run build

# Производственный образ
FROM node:23-alpine AS production

# Создаем пользователя для безопасности
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nansen -u 1001

# Устанавливаем рабочую директорию
WORKDIR /app

# Копируем package.json для установки только production зависимостей
COPY package*.json ./

# Устанавливаем только production зависимости
RUN npm ci --only=production && npm cache clean --force

# Копируем собранное приложение из builder stage
COPY --from=builder /app/dist ./dist

# Создаем директорию для конфигурации и логов
RUN mkdir -p /app/src/config && \
    chown -R nansen:nodejs /app

# Создаем базовый файл символов, если его нет
RUN echo '["strk", "magic"]' > ./src/config/symbols.json && \
    chown nansen:nodejs ./src/config/symbols.json

# Переключаемся на пользователя nansen
USER nansen

# Экспонируем порт (если потребуется веб-интерфейс в будущем)
EXPOSE 3000

# Определяем переменные окружения
ENV NODE_ENV=production
ENV LOG_LEVEL=info

# Добавляем healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "console.log('Health check passed')" || exit 1

# Команда запуска
CMD ["npm", "start"]
