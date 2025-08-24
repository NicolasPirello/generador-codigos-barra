# Generador de Códigos de Barras – Kiosco

Aplicación web para generar, editar, visualizar y exportar etiquetas con códigos de barras con persistencia en el servidor. Ideal para kioscos o pequeños comercios. Incluye backend Express y frontend estático.

## 1) Requisitos previos del sistema

- Docker 20.10+ y Docker Compose (opcional pero recomendado)
- Acceso a Internet para descargar la imagen base y dependencias
- Puerto disponible (por defecto 3000)
- (Opcional) Una API Key para proteger el acceso a la aplicación

## 2) Pasos detallados para la configuración y despliegue

### A. Despliegue con Docker (recomendado)

1. Clona o descarga este repositorio en tu servidor.
2. Construye la imagen:
   ```bash
   docker build -t kiosco-barcodes:latest .
   ```
3. Crea un volumen para persistir datos (solo primera vez):
   ```bash
   docker volume create kiosco_barcodes_data
   ```
4. Ejecuta el contenedor:
   ```bash
   docker run -d \
     --name kiosco-barcodes \
     -p 3000:3000 \
     -e PORT=3000 \
     -e API_KEY="cambia-esta-clave" \
     -e DATA_DIR=/app/data \
     -v kiosco_barcodes_data:/app/data \
     kiosco-barcodes:latest
   ```
5. Abre en el navegador: http://TU_HOST:3000
6. Si configuraste API_KEY, en la interfaz ingresa la "API Key" cuando lo solicite o guárdala en el panel.

### B. Docker Compose (opcional)

```yaml
version: "3.9"
services:
  app:
    image: kiosco-barcodes:latest
    build: .
    ports:
      - "3000:3000"
    environment:
      PORT: 3000
      API_KEY: "cambia-esta-clave"
      DATA_DIR: /app/data
    volumes:
      - kiosco_barcodes_data:/app/data
volumes:
  kiosco_barcodes_data:
```

Luego:
```bash
docker compose up -d --build
```

### C. Despliegue en Dockploy

- Fuente: este repositorio con Dockerfile incluido.
- Variables de entorno: ver sección 3.
- Puerto: 3000
- Volumen persistente en ruta `/app/data`.
- Si se requiere acceso único, define `API_KEY`.

## 3) Variables de entorno necesarias

- PORT (opcional): Puerto de escucha. Por defecto 3000.
- API_KEY (opcional, recomendado): Si se define, la API exigirá el header `x-api-key` con ese valor.
- DATA_DIR (opcional): Directorio para guardar la base de datos JSON. Por defecto `/app/data`.

## 4) Comandos Docker relevantes

- Contruir imagen:
  ```bash
  docker build -t kiosco-barcodes:latest .
  ```
- Crear volumen persistente:
  ```bash
  docker volume create kiosco_barcodes_data
  ```
- Ejecutar contenedor:
  ```bash
  docker run -d --name kiosco-barcodes -p 3000:3000 -e API_KEY="cambia-esta-clave" -v kiosco_barcodes_data:/app/data kiosco-barcodes:latest
  ```
- Ver logs:
  ```bash
  docker logs -f kiosco-barcodes
  ```
- Actualizar imagen y reiniciar:
  ```bash
  docker stop kiosco-barcodes && docker rm kiosco-barcodes
  docker build -t kiosco-barcodes:latest .
  docker run -d --name kiosco-barcodes -p 3000:3000 -e API_KEY="cambia-esta-clave" -v kiosco_barcodes_data:/app/data kiosco-barcodes:latest
  ```

## 5) Consideraciones de seguridad

- Define una `API_KEY` fuerte para restringir acceso (cabecera `x-api-key`).
- Asegura el servidor detrás de HTTPS (proxy inverso como Nginx/Caddy o Dockploy con TLS).
- Mantén los permisos del volumen restringidos (solo lectura/escritura para el servicio).
- Haz backups periódicos del volumen `/app/data` (contiene `db.json`).
- Mantén la imagen actualizada con rebuilds regulares.

## 6) Solución de problemas comunes

- 401 No autorizado: Falta o es incorrecta la `x-api-key`.
  - Solución: Configura `API_KEY` en el contenedor y súminala en la interfaz (campo API Key) o en tus requests.
- El contenedor arranca pero no veo datos: ¿montaste el volumen en `/app/data`?
  - Solución: Asegúrate de incluir `-v kiosco_barcodes_data:/app/data`.
- Puerto en uso:
  - Solución: Cambia el mapeo `-p 8080:3000` y accede al 8080. O libera el 3000.
- No carga el frontend o 404: revisa logs con `docker logs -f kiosco-barcodes`.
- Códigos duplicados al editar:
  - El servidor valida duplicados y retorna 409 si el `code` ya existe. Cambia a un valor único.
- PDF desbordado o cortado:
  - Reduce la cantidad de tarjetas o ajusta ancho/alto de impresión. Usa el modo impresión del navegador.

## 7) Información de contacto para soporte

- Autor/Mantenedor: Kiosco Barcodes
- Email: soporte@tudominio.com
- Issues y mejoras: crea un ticket en el repositorio o escribe un correo.

---

### Uso rápido local (sin Docker)
```bash
npm install
npm start
# Navegá a http://localhost:3000
```

Variables de entorno locales (PowerShell):
```powershell
$env:API_KEY="cambia-esta-clave"; $env:PORT=3000; npm start
```