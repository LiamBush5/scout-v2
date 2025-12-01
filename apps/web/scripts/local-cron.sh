#!/bin/bash
# Local cron simulator - runs monitoring jobs every 5 minutes
# Usage: ./scripts/local-cron.sh

echo "Starting local cron simulator (Ctrl+C to stop)"
echo "Hitting /api/cron/monitoring every 5 minutes..."

while true; do
  echo ""
  echo "$(date): Triggering cron..."
  curl -s http://localhost:3000/api/cron/monitoring | jq .
  echo ""
  echo "Sleeping 5 minutes..."
  sleep 300
done

