#!/usr/bin/env bash
set -euo pipefail

BASE_URL="http://127.0.0.1:3000"
WORKDIR="$(mktemp -d)"
LOG_FILE="compose-smoke.log"

compose_logs() {
  docker compose logs --no-color > "$LOG_FILE" 2>&1 || true
}

cleanup() {
  status=$?
  if [ "$status" -ne 0 ]; then
    compose_logs
  fi
  docker compose down -v >/dev/null 2>&1 || true
  rm -rf "$WORKDIR"
  exit "$status"
}
trap cleanup EXIT

wait_healthy() {
  for _ in $(seq 1 60); do
    if curl -fsS "$BASE_URL/api/health" > "$WORKDIR/health.json" 2>/dev/null; then
      if grep -q '"status":"ok"' "$WORKDIR/health.json"; then
        cat "$WORKDIR/health.json"
        return 0
      fi
    fi
    sleep 2
  done
  echo "health check did not become ready"
  compose_logs
  return 1
}

login() {
  curl -fsS -c "$WORKDIR/cookies" -H 'content-type: application/json' -d '{"username":"admin","password":"admin12345"}' "$BASE_URL/api/auth/login" > "$WORKDIR/login.json"
  grep -q '"ok":true' "$WORKDIR/login.json"
}

home() {
  curl -fsS -b "$WORKDIR/cookies" "$BASE_URL/" > "$WORKDIR/home.html"
  grep -q '管理员' "$WORKDIR/home.html"
  grep -q '还没有业务数据' "$WORKDIR/home.html"
}

echo "== docker compose up --build =="
docker compose version
docker compose up --build -d
docker compose ps

echo "== health =="
wait_healthy

echo "== login =="
login
echo "login ok"

echo "== home =="
home
echo "home ok"

echo "== write volume marker =="
docker compose exec -T db psql -U postgres -d jxc -v ON_ERROR_STOP=1 -c "create table if not exists compose_probe (marker text primary key);" -c "insert into compose_probe (marker) values ('kept') on conflict do nothing;"

echo "== restart stack without removing volume =="
docker compose down
docker compose up -d
wait_healthy
login
home

echo "== verify volume marker survives restart =="
MARKER="$(docker compose exec -T db psql -U postgres -d jxc -tAc "select marker from compose_probe" | tr -d '[:space:]')"
test "$MARKER" = "kept"
ADMINS="$(docker compose exec -T db psql -U postgres -d jxc -tAc "select count(*) from app_user where role = 'admin'" | tr -d '[:space:]')"
test "$ADMINS" = "1"

echo "volume marker: $MARKER"
echo "enabled admins: $ADMINS"

echo "== compose smoke passed =="