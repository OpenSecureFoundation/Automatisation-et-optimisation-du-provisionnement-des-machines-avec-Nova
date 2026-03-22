#!/bin/bash
# À exécuter sur le serveur (45.9.191.91) pour voir comment OpenStack est exposé.
# Usage: sudo bash scripts/check-openstack-endpoints.sh

echo "=== Ports en écoute (OpenStack typiques) ==="
for port in 5000 8774 9292 9696 8776 8778 35357; do
  ss -tulpn 2>/dev/null | grep -q ":$port " && echo "  $port: OUI" || echo "  $port: non"
done

echo ""
echo "=== Apache / Nginx config (proxys vers OpenStack) ==="
if command -v apache2ctl &>/dev/null; then
  grep -r -l -E "proxy_pass|ProxyPass" /etc/apache2/ 2>/dev/null | head -20
  echo "--- Exemples de ProxyPass (Identity, Nova, etc.) ---"
  grep -r -h -E "ProxyPass|proxy_pass" /etc/apache2/ 2>/dev/null | grep -v "^#" | head -30
fi
if [ -d /etc/nginx ]; then
  grep -r -l "proxy_pass" /etc/nginx/ 2>/dev/null | head -10
fi

echo ""
echo "=== Test des URLs courantes (port 80) ==="
HOST="${1:-127.0.0.1}"
for path in "/identity/v3" "/v3" "/compute/v2.1" "/compute" "/network/v2.0" "/image/v2" "/volume/v3"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 2 "http://${HOST}${path}" 2>/dev/null)
  echo "  http://${HOST}${path} -> $code"
done
