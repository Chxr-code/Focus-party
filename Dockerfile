# Focus Party: Yii2 API + the built React app (web/) in one container.
# Works on Render, Railway, Koyeb, Fly... The host gives the port in $PORT (default 8080).
FROM php:8.3-apache

RUN apt-get update \
    && apt-get install -y --no-install-recommends git unzip ca-certificates \
    && docker-php-ext-install pdo_mysql \
    && a2enmod rewrite headers \
    && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

# PHP packages first (cached until composer.json / composer.lock change)
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-interaction --prefer-dist --no-scripts --no-progress --optimize-autoloader

# the app (React is already built into web/)
COPY . .
RUN composer dump-autoload --no-dev --optimize \
    && mkdir -p runtime web/assets \
    && chown -R www-data:www-data runtime web/assets

# Apache serves web/, .htaccess sends /api to Yii and everything else to React
COPY docker/apache.conf /etc/apache2/sites-available/000-default.conf
COPY docker/start.sh /usr/local/bin/start.sh
RUN chmod +x /usr/local/bin/start.sh

ENV PORT=8080
EXPOSE 8080
CMD ["start.sh"]
