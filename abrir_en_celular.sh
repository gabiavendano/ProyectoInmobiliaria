#!/bin/bash
# Abre el proyecto para verlo desde el celular (misma red Wi-Fi que la Mac).
# Uso:  ./abrir_en_celular.sh        (Ctrl+C para detener todo)
cd "$(dirname "$0")" || exit 1
RAIZ="$(pwd)"

IP="$(ipconfig getifaddr en0 2>/dev/null)"
[ -z "$IP" ] && IP="$(ipconfig getifaddr en1 2>/dev/null)"
if [ -z "$IP" ]; then
  echo "No pude averiguar la IP de la Mac. ¿Estás conectada al Wi-Fi?"
  exit 1
fi

echo "=============================================================="
echo "  En el CELULAR (mismo Wi-Fi) abrí:   http://$IP:5173"
echo "  En la Mac abrí ESA MISMA dirección (no localhost), si no"
echo "  la sesión no funciona."
echo "  Ctrl+C detiene todo y deja el proyecto como estaba."
echo "=============================================================="

# El frontend tiene que apuntar al backend por IP (para el celular "localhost" es el propio celular)
echo "VITE_API_URL=http://$IP:8080" > frontend/.env.local

limpiar() {
  echo ""
  echo "Deteniendo..."
  rm -f "$RAIZ/frontend/.env.local"
  kill 0 2>/dev/null
}
trap limpiar INT TERM EXIT

# Backend: acepta pedidos desde la IP (cookie sin HTTPS, ya está en el perfil local)
( cd backend && CORS_ALLOWED_ORIGINS="http://localhost:5173,http://127.0.0.1:5173,http://$IP:5173" \
  ./mvnw spring-boot:run -DskipTests ) &

# Frontend visible en la red
cd frontend && npm run dev -- --host --port 5173 --strictPort
