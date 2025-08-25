# Imagen para producción
FROM node:20-alpine

# Crear directorio de trabajo
WORKDIR /app

# Copiar manifiestos e instalar dependencias
COPY package*.json ./
RUN npm ci --only=production || npm install --only=production

# Copiar código
ARG BUILD_TAG
ENV BUILD_TAG=$BUILD_TAG
COPY . .

# Variables opcionales:
# ENV PORT=3000
# ENV API_KEY=tu_clave
# ENV DATA_DIR=/app/data

EXPOSE 3201
CMD ["npm","start"]