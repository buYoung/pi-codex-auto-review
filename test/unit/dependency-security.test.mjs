import test from 'node:test';
import assert from 'node:assert/strict';
import { constants, createHash, generateKeyPairSync, privateEncrypt, sign, verify } from 'node:crypto';
import { createRequire } from 'node:module';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';

const sandboxRequire = createRequire(import.meta.resolve('@anthropic-ai/sandbox-runtime'));
const forge = sandboxRequire('node-forge');
const keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
const publicKey = forge.pki.publicKeyFromPem(keys.publicKey.export({ type: 'spki', format: 'pem' }));
const message = Buffer.from('owned dependency security regression');
const digest = createHash('sha256').update(message).digest();

function encodedSignature({ hasNull = true, extra = [] } = {}) {
  const { asn1 } = forge, universal = asn1.Class.UNIVERSAL;
  const sequence = values => asn1.create(universal, asn1.Type.SEQUENCE, true, values);
  const algorithm = [asn1.create(universal, asn1.Type.OID, false, asn1.oidToDer('2.16.840.1.101.3.4.2.1').getBytes())];
  if (hasNull) algorithm.push(asn1.create(universal, asn1.Type.NULL, false, ''));
  const info = sequence([
    sequence([...algorithm, ...extra]),
    asn1.create(universal, asn1.Type.OCTETSTRING, false, digest.toString('binary')),
  ]);
  return privateEncrypt({ key: keys.privateKey, padding: constants.RSA_PKCS1_PADDING },
    Buffer.from(asn1.toDer(info).getBytes(), 'binary'));
}

test('[dependency-security] sandbox RSA verification accepts valid PKCS1 and PSS controls', () => {
  for (const hasNull of [false, true]) {
    assert.equal(publicKey.verify(digest.toString('binary'), encodedSignature({ hasNull }).toString('binary')), true);
  }
  const signature = sign('sha256', message, keys.privateKey);
  assert.equal(publicKey.verify(digest.toString('binary'), signature.toString('binary')), true);
  assert.equal(publicKey.verify(Buffer.alloc(32).toString('binary'), signature.toString('binary')), false);
  const pssSignature = sign('sha256', message, { key: keys.privateKey, padding: constants.RSA_PKCS1_PSS_PADDING, saltLength: 32 });
  const pss = forge.pss.create({ md: forge.md.sha256.create(), mgf: forge.mgf.mgf1.create(forge.md.sha256.create()), saltLength: 32 });
  assert.equal(publicKey.verify(digest.toString('binary'), pssSignature.toString('binary'), pss), true);
});

test('[dependency-security] GHSA-86w9-cpqp-85rv nested DigestAlgorithm garbage never verifies', () => {
  const { asn1 } = forge;
  for (const extra of [
    asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OCTETSTRING, false, 'owned malformed bytes'),
    asn1.create(asn1.Class.UNIVERSAL, asn1.Type.NULL, false, ''),
    asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, []),
  ]) {
    const signature = encodedSignature({ extra: [extra] });
    assert.equal(verify('sha256', message, keys.publicKey, signature), false, 'Native crypto rejects the malformed signature control');
    let isAccepted = false;
    try { isAccepted = publicKey.verify(digest.toString('binary'), signature.toString('binary')); }
    catch (error) { assert.match(error.message, /valid RSASSA-PKCS1-v1_5 DigestInfo/); }
    assert.equal(isAccepted, false, 'Malformed DigestAlgorithm must not be accepted');
  }
});

test('[dependency-security] Pi brace expansion handles bounded adversarial input without a crash or event-loop stall', async () => {
  const piRequire = createRequire(import.meta.resolve('@earendil-works/pi-coding-agent'));
  const minimatchRequire = createRequire(piRequire.resolve('minimatch'));
  const moduleURL = pathToFileURL(minimatchRequire.resolve('brace-expansion')).href;
  const program = `
    const module = await import(${JSON.stringify(moduleURL)});
    const expand = module.expand ?? module.default;
    const control = expand('a{b,c}');
    if (JSON.stringify(control) !== '["ab","ac"]') throw new Error('positive brace control failed');
    for (const input of ['{a}' + '}'.repeat(65536) + ',z}', '{' + 'x,'.repeat(12000) + 'z}']) {
      const output = expand(input);
      if (!Array.isArray(output) || output.length === 0) throw new Error('invalid bounded expansion');
    }
    console.log('bounded brace inputs completed');
  `;
  const { stdout } = await promisify(execFile)(process.execPath,
    ['--max-old-space-size=96', '--input-type=module', '-e', program],
    { timeout: 5000, maxBuffer: 16384, env: { PATH: process.env.PATH } });
  assert.equal(stdout.trim(), 'bounded brace inputs completed');
});
