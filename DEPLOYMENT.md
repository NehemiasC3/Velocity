# 🚀 Guía de Configuración de Despliegue Continuo (CI/CD)

Esta guía explica cómo configurar el flujo de integración y despliegue continuo (CI/CD) automatizado con **GitHub Actions**, **Docker Compose** y **SSH** en tu servidor VPS de producción (Linux / KVM 1).

---

## 🔐 1. Variables Secretas en GitHub (`GitHub Secrets`)

Dirígete a tu repositorio en GitHub y accede a:
👉 **Settings** > **Secrets and variables** > **Actions** > **New repository secret**

Agrega las siguientes variables:

| Nombre del Secret | Descripción | Ejemplo |
| :--- | :--- | :--- |
| `SSH_HOST` | Dirección IP pública o dominio del servidor VPS. | `194.163.150.24` o `vps.tu-isp.com` |
| `SSH_USER` | Usuario con permisos sudo/docker en el servidor. | `ubuntu`, `root` o `deploy` |
| `SSH_KEY` | Contenido completo de la **Clave Privada SSH** (`id_ed25519` o `id_rsa`). | `-----BEGIN OPENSSH PRIVATE KEY----- ... -----END OPENSSH PRIVATE KEY-----` |
| `PROJECT_PATH` | Ruta absoluta donde está clonado el repositorio en el servidor. | `/var/www/velocity` o `/root/Velocity` |
| `SSH_PORT` *(Opcional)* | Puerto SSH si no usas el estándar (por defecto: `22`). | `22` o `2222` |

---

## 🔑 2. Generación y Configuración de Claves SSH en el Servidor

Si aún no tienes un par de claves SSH dedicadas para GitHub Actions, ejecútalo en la terminal de tu VPS:

### Paso 1: Generar el par de claves (ED25519 recomendado)
```bash
ssh-keygen -t ed25519 -C "github-actions-velocity" -f ~/.ssh/github_actions_key -N ""
```

### Paso 2: Autorizar la clave pública en el servidor
```bash
cat ~/.ssh/github_actions_key.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
chmod 700 ~/.ssh
```

### Paso 3: Obtener la clave privada para GitHub Secrets
Muestra en pantalla la clave privada y copia **todo el contenido**, incluyendo las líneas `BEGIN` y `END`:
```bash
cat ~/.ssh/github_actions_key
```
> 📋 Pega este texto exactamente en el secret `SSH_KEY` de GitHub.

---

## 🐳 3. Configuración Inicial del Proyecto en el Servidor

Asegúrate de que el repositorio ya esté clonado en la ruta especificada en `PROJECT_PATH` y que Docker funcione correctamente:

```bash
# 1. Crear directorio y clonar repositorio si es la primera vez
sudo mkdir -p /var/www/velocity
sudo chown -R $USER:$USER /var/www/velocity
cd /var/www/velocity

git clone https://github.com/tu-usuario/Velocity.git .

# 2. Configurar el archivo de variables de entorno de producción
cp .env.example .env
nano .env  # Configurar WISPRO_API_KEY, etc.

# 3. Asegurar permisos de Docker para el usuario sin necesidad de sudo
sudo usermod -aG docker $USER
newgrp docker
```

---

## 🔄 4. Flujo de Ejecución del Pipeline

Cada vez que realizas `git push` a la rama `main` o `master`:

1. **`backend-ci`**: Instala dependencias, valida tipos TypeScript (`npm run typecheck`) y compila el backend.
2. **`frontend-ci`**: Instala dependencias, valida tipos TypeScript y genera el bundle estático de React con Vite.
3. **`docker-build`**: Comprueba que la imagen Docker construya sin errores.
4. **`deploy`**: Se conecta vía SSH a tu servidor y ejecuta:
   - `git reset --hard origin/main` (descarga el código exacto de main).
   - `docker compose up -d --build` (reconstruye y levanta los contenedores en 0 downtime).
   - `docker image prune -f` (elimina imágenes huérfanas para ahorrar espacio en disco).
