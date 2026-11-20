import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { request } from 'node:http';
import { platform, release } from 'node:os';
import { dockerTrackBProfile as profile } from './track-b-docker-gate.mjs';
import { nativePostgresDigests, verifyNativePostgresContent } from './track-b-native-boundary.mjs';

const socketPath = '/run/docker.sock';
const maxInfoBytes = 128 * 1024;
const contentStore = '/var/lib/containerd/io.containerd.content.v1.content/blobs/sha256/';

export async function verifyCachedNativePostgres({ signal } = {}) {
  const entries = await Promise.all(Object.entries(nativePostgresDigests).map(async ([key, pin]) =>
    [key, await readFile(contentStore + pin.slice('sha256:'.length), { signal })]));
  verifyNativePostgresContent(Object.fromEntries(entries));
}

/**
 * Read-only engine observation for the native WSL installation. The fingerprint
 * is one input to a future private binding, not proof of target isolation or
 * authority to provision resources. Importing this module performs no I/O.
 */
export async function observeTrackBNativeEngine({ signal } = {}) {
  return engineIdentity(await readLocalDocker('/info', signal));
}

// Fixed inspection endpoints only. Docker inspect may return private environment
// values; project the required fields before returning observations.
export async function inspectTrackBNativeDocker({ signal } = {}) {
  const engine = await observeTrackBNativeEngine({ signal });
  const [container, network, volume] = await Promise.all([
    readLocalDocker('/containers/' + profile.container + '/json', signal),
    readLocalDocker('/networks/' + profile.network, signal),
    readLocalDocker('/volumes/' + profile.volume, signal),
  ]);
  if (!/^sha256:[a-f0-9]{64}$/.test(container?.Image ?? '')) {
    throw new Error('TRACK_B_NATIVE_IMAGE_ID_UNVERIFIED');
  }
  const image = await readLocalDocker('/images/' + container.Image + '/json', signal);
  await verifyCachedNativePostgres({ signal });
  return {
    engine,
    postgresContentVerified: true,
    container: {
      Id: container.Id, Name: container.Name, Image: container.Image, State: container.State,
      Config: { Labels: container.Config?.Labels },
      HostConfig: {
        RestartPolicy: container.HostConfig?.RestartPolicy, Privileged: container.HostConfig?.Privileged,
        PublishAllPorts: container.HostConfig?.PublishAllPorts, PortBindings: container.HostConfig?.PortBindings,
        Memory: container.HostConfig?.Memory, NanoCpus: container.HostConfig?.NanoCpus,
      },
      Mounts: container.Mounts,
      NetworkSettings: { Networks: container.NetworkSettings?.Networks, Ports: container.NetworkSettings?.Ports },
    },
    network: { Id: network.Id, Name: network.Name, Driver: network.Driver, Internal: network.Internal,
      Labels: network.Labels, Containers: network.Containers },
    volume: { Name: volume.Name, Driver: volume.Driver, Labels: volume.Labels, CreatedAt: volume.CreatedAt },
    image: { Id: image.Id, Os: image.Os, Architecture: image.Architecture, RepoDigests: image.RepoDigests },
  };
}

export async function inspectNativeRunner(id, { signal } = {}) {
  if (!/^[a-f0-9]{64}$/.test(id ?? '')) throw Error('NATIVE_RUNNER_ID_REJECTED');
  return readLocalDocker('/containers/' + id + '/json', signal);
}

export async function inspectNativeEvidenceVolume({ signal } = {}) {
  const volume = await readLocalDocker('/volumes/zentric-q03-replacement-evidence', signal);
  return { Name: volume.Name, Driver: volume.Driver, Labels: volume.Labels, CreatedAt: volume.CreatedAt };
}

export async function inspectNativeSocketVolume({ signal } = {}) {
  const volume = await readLocalDocker('/volumes/zentric-q03-replacement-socket', signal);
  return { Name: volume.Name, Driver: volume.Driver, Labels: volume.Labels, CreatedAt: volume.CreatedAt };
}

async function readLocalDocker(path, signal) {
  if (platform() !== 'linux' || !/microsoft-standard-wsl2/i.test(release())) {
    throw new Error('TRACK_B_NATIVE_WSL_REQUIRED');
  }

  return new Promise((resolve, reject) => {
    const deadline = AbortSignal.timeout(3000);
    const requestSignal = signal ? AbortSignal.any([signal, deadline]) : deadline;
    const fail = () => reject(new Error('TRACK_B_NATIVE_ENGINE_UNAVAILABLE'));
    const probe = request({
      socketPath, path, method: 'GET', agent: false, signal: requestSignal,
    }, response => {
      response.once('error', fail);
      response.once('aborted', fail);
      if (response.statusCode !== 200) {
        response.destroy();
        fail();
        return;
      }

      let size = 0;
      const chunks = [];
      response.on('data', chunk => {
        size += chunk.length;
        if (size > maxInfoBytes) {
          response.destroy();
          fail();
          return;
        }
        chunks.push(chunk);
      });
      response.once('end', () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
        } catch {
          fail();
        }
      });
    });
    probe.once('error', fail);
    probe.end();
  });
}

function engineIdentity(info) {
  if (info?.OSType !== 'linux' || info.Architecture !== 'x86_64'
      || info.KernelVersion !== release() || typeof info.ID !== 'string'
      || !/^[a-z0-9:-]{16,128}$/i.test(info.ID)) {
    throw new Error('TRACK_B_NATIVE_ENGINE_IDENTITY_UNVERIFIED');
  }

  return Object.freeze({
    backend: 'docker-engine-wsl2',
    platform: 'linux/amd64',
    engineFingerprint: createHash('sha256')
      .update(JSON.stringify([socketPath, info.ID]))
      .digest('hex'),
  });
}
