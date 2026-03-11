FROM php:8.2-apache

# Enable required PHP extensions
RUN docker-php-ext-install mysqli pdo pdo_mysql

# Enable Apache mod_rewrite
RUN a2enmod rewrite headers

# Set working directory
WORKDIR /var/www/html

# Copy application files
COPY . /var/www/html/

# Remove Docker-specific files from the web root
RUN rm -f /var/www/html/Dockerfile \
    /var/www/html/docker-compose.yml \
    /var/www/html/.env.example \
    /var/www/html/.env

# Set proper permissions
RUN chown -R www-data:www-data /var/www/html

# Apache configuration for security headers
RUN echo '<Directory /var/www/html>\n\
    Options -Indexes +FollowSymLinks\n\
    AllowOverride All\n\
    Require all granted\n\
</Directory>\n\
<IfModule mod_headers.c>\n\
    Header always set X-Content-Type-Options "nosniff"\n\
    Header always set X-Frame-Options "SAMEORIGIN"\n\
    Header always set Referrer-Policy "strict-origin-when-cross-origin"\n\
</IfModule>' > /etc/apache2/conf-available/security-headers.conf \
    && a2enconf security-headers

# Expose port 80
EXPOSE 80

CMD ["apache2-foreground"]
