FROM node:18-alpine

# Directorio de trabajo
WORKDIR /usr/src/app

# Copiar archivos de definición de dependencias
COPY package*.json ./

# Instalar dependencias de producción
RUN npm ci --only=production

# Copiar el código de la aplicación
COPY . .

# Exponer el puerto
EXPOSE 3000

# Variables de entorno por defecto
ENV PORT=3000
ENV NODE_ENV=production
ENV DATA_DIR=/usr/src/app/data

# Comando para arrancar el servidor
CMD [ "node", "server.js" ]
