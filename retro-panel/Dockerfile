ARG BUILD_FROM
FROM $BUILD_FROM

# Install Python dependencies
COPY app/requirements.txt /tmp/requirements.txt
RUN pip3 install --no-cache-dir -r /tmp/requirements.txt

# Copy application source
COPY app/ /usr/lib/retropanel/

# Copy s6-overlay process scripts
COPY rootfs/ /

# Ensure s6 scripts are executable
RUN chmod a+x /etc/s6-overlay/s6-rc.d/retropanel/run \
    && find /etc/s6-overlay/s6-rc.d -name "type" -exec chmod 644 {} \; \
    && find /etc/s6-overlay/s6-rc.d/user/contents.d -type f -exec chmod 644 {} \;

# Internal port (accessed only via HA Ingress proxy)
EXPOSE 7654

WORKDIR /usr/lib/retropanel
