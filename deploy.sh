#!/usr/bin/env bash
# ==============================================================================
# 🚀 VELOCITY ISP SUITE - SCRIPT DE DESPLIEGUE CONTINUO EN PRODUCCIÓN (deploy.sh)
# ==============================================================================
# Uso:
#   chmod +x deploy.sh
#   ./deploy.sh
# ==============================================================================

set -e # Detener la ejecución si ocurre cualquier error

# Colores para salida estilizada en terminal
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m' # No Color

log_step() {
    echo -e "\n${BLUE}================================================================${NC}"
    echo -e "${CYAN}▶ $1${NC}"
    echo -e "${BLUE}================================================================${NC}"
}

log_success() {
    echo -e "${GREEN}✔ $1${NC}"
}

log_warn() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

log_error() {
    echo -e "${RED}✖ $1${NC}"
}

START_TIME=$(date +%s)

log_step "1/5: Verificando entorno y herramientas requeridas"

# Validar Git
if ! command -v git &> /dev/null; then
    log_error "Git no está instalado en el servidor."
    exit 1
fi

# Validar Docker
if ! command -v docker &> /dev/null; then
    log_error "Docker no está instalado en el servidor."
    exit 1
fi

# Detectar comando de Docker Compose (docker compose o docker-compose)
if docker compose version &> /dev/null; then
    DOCKER_COMPOSE="docker compose"
elif command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
else
    log_error "Docker Compose no está instalado."
    exit 1
fi

log_success "Entorno validado correctamente ($DOCKER_COMPOSE detectado)"

# ------------------------------------------------------------------------------
log_step "2/5: Descargando últimos cambios del repositorio (Git Pull)"
# ------------------------------------------------------------------------------
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD || echo "main")
echo -e "Rama activa: ${YELLOW}${CURRENT_BRANCH}${NC}"

git pull origin "${CURRENT_BRANCH}" || {
    log_warn "Fallo git pull directo. Intentando git pull..."
    git pull
}
log_success "Código actualizado con éxito desde el repositorio remoto"

# ------------------------------------------------------------------------------
log_step "3/5: Compilando TypeScript, Backend y Frontend PWA"
# ------------------------------------------------------------------------------
if [ -f "package.json" ]; then
    echo "Instalando dependencias de la raíz y subproyectos..."
    npm install --silent || true
    
    echo "Compilando Backend y Frontend..."
    npm run build:all
    log_success "Compilación de producción completada con éxito (Exit code 0)"
else
    log_warn "No se encontró package.json en la raíz. Omitiendo build local previo a Docker."
fi

# ------------------------------------------------------------------------------
log_step "4/5: Reconstruyendo y levantando contenedores Docker"
# ------------------------------------------------------------------------------
echo "Ejecutando: $DOCKER_COMPOSE up -d --build"
$DOCKER_COMPOSE up -d --build

log_success "Contenedores Docker levantados y activos en segundo plano"

# ------------------------------------------------------------------------------
log_step "5/5: Mantenimiento y limpieza de Docker"
# ------------------------------------------------------------------------------
echo "Eliminando imágenes colgadas y huérfanas (dangling images)..."
docker image prune -f || true
log_success "Espacio en disco optimizado"

# ------------------------------------------------------------------------------
# Resumen de Estado
# ------------------------------------------------------------------------------
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo -e "\n${GREEN}================================================================${NC}"
echo -e "${GREEN}🎉 DESPLIEGUE A PRODUCCIÓN COMPLETADO EN ${DURATION} SEGUNDOS 🎉${NC}"
echo -e "${GREEN}================================================================${NC}\n"

echo -e "${CYAN}Estado actual de los servicios:${NC}"
$DOCKER_COMPOSE ps

echo -e "\n${YELLOW}💡 Recuerda:${NC} Los usuarios de la PWA recibirán automáticamente la notificación de actualización sin necesidad de limpiar la caché del navegador manualmente.\n"
