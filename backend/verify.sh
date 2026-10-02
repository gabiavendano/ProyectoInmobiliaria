#!/bin/bash
cd "$(dirname "$0")" || exit 1
echo "=== Compilando ==="
./mvnw clean compile 2>&1 | tail -5
echo ""
echo "=== Ejecutando tests ==="
./mvnw test 2>&1 | grep -E "Tests run:|BUILD|ERROR|FAILURE" | tail -10
echo ""
echo "=== Backend arrancando (ctrl+C para detener) ==="
./mvnw spring-boot:run -DskipTests 2>&1 | grep -E "Started|ERROR|Exception|Tomcat initialized|Database info"
