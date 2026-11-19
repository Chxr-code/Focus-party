#!/bin/sh
# 1) listen on the port the host gives us  2) create/update tables  3) start Apache
set -e
PORT="${PORT:-8080}"
export PORT
sed -i "s/^Listen .*/Listen ${PORT}/" /etc/apache2/ports.conf

cd /var/www/html
# the database may still be waking up (free tiers sleep): try a few times
i=0
until php yii migrate --interactive=0; do
    i=$((i + 1))
    if [ "$i" -ge 5 ]; then
        echo "Database not reachable - starting anyway"
        break
    fi
    echo "Database not ready, retrying in 5s ($i/5)"
    sleep 5
done

exec apache2-foreground
