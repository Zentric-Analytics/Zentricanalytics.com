FROM postgres@sha256:86c951e05bf56c93d95d397747fb8820ac76cc3bedb78f43abd83eedbe3666ae
LABEL zentric.q03.run="q03-20261030-1960147fab" zentric.q03.unit="Q03-A7" zentric.q03.role="offline-runner"
ADD node-v22.23.3-linux-x64.tar.xz /opt/
COPY engines /opt/engines
ADD project-linux.tar /opt/project/
COPY runner-code /opt/harness
RUN mv /opt/node-v22.23.3-linux-x64 /opt/node && chmod 755 /opt/node/bin/node /opt/engines/schema-engine
USER 65532:65532
WORKDIR /work
# Inherited PGDATA volume MUST be covered by tmpfs at create time. Never start the PG entrypoint.
ENTRYPOINT ["/opt/node/bin/node", "/opt/harness/runner-entrypoint.mjs"]
CMD ["versions"]
