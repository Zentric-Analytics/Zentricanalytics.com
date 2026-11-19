FROM postgres:18.6@sha256:e3d24f6906d0760bf4da0dae872415391ededefad23fd471c47dc53b0ddf3c42 AS postgres_base
FROM scratch
# Copy the filesystem without inheriting the PostgreSQL image's data volume.
COPY --from=postgres_base / /
ENV PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
COPY node /opt/node/bin/node
COPY engines /opt/engines
COPY node_modules /opt/project/node_modules
COPY q03 /opt/q03
RUN chmod 0755 /opt/node/bin/node /opt/engines/schema-engine
USER 65532:65532
ENTRYPOINT ["/opt/node/bin/node"]
CMD ["/opt/q03/track-b-native-postgres.mjs"]
