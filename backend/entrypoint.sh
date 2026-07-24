#!/bin/sh

# Exit if any variable is unset or empty (set -u would exit on any unset reference)
[ -z "$POSTGRES_HOST" ] && { echo "POSTGRES_HOST is not set"; exit 1; }
if [ "${POSTGRES_HOST#/cloudsql/}" = "$POSTGRES_HOST" ]; then
    [ -z "$POSTGRES_PORT" ] && { echo "POSTGRES_PORT is not set"; exit 1; }
    echo "Waiting for postgres at $POSTGRES_HOST:$POSTGRES_PORT ..."
    while ! nc -z "$POSTGRES_HOST" "$POSTGRES_PORT"; do
        sleep 0.1
    done
    echo "PostgreSQL started"
else
    echo "Using Cloud SQL Unix socket at $POSTGRES_HOST"
fi

if [ "$RUN_MIGRATIONS" = "1" ]; then
    python manage.py migrate
fi
exec "$@"
