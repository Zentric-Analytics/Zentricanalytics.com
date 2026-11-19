import { createHash } from 'node:crypto';
import { request } from 'node:http';
import { platform, release } from 'node:os';

const socketPath = '/run/docker.sock';
const maxInfoBytes = 128 * 1024;

/**
 * Read-only engine observation for the native WSL installation. The fingerprint
 * is one input to a future private binding, not proof of target isolation or
 * authority to provision resources. Importing this module performs no I/O.
 */
export async function observeTrackBNativeEngine({ signal } = {}) {
  if (platform() !== 'linux' || !/microsoft-standard-wsl2/i.test(release())) {
    throw new Error('TRACK_B_NATIVE_WSL_REQUIRED');
  }

  const info = await new Promise((resolve, reject) => {
    const deadline = AbortSignal.timeout(3000);
    const requestSignal = signal ? AbortSignal.any([signal, deadline]) : deadline;
    const fail = () => reject(new Error('TRACK_B_NATIVE_ENGINE_UNAVAILABLE'));
    const probe = request({
      socketPath, path: '/info', method: 'GET', agent: false, signal: requestSignal,
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
