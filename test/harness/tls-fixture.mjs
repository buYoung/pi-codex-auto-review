import { generateKeyPairSync } from "node:crypto";
import forge from "node-forge";

/** Ephemeral, self-signed fixture identity. No host certificate/key material is read. */
export function tlsFixtureIdentity(hostname) {
    const pair = generateKeyPairSync("rsa", {
        modulusLength: 2048,
        publicKeyEncoding: { type: "spki", format: "pem" },
        privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });
    const certificate = forge.pki.createCertificate();
    certificate.publicKey = forge.pki.publicKeyFromPem(pair.publicKey);
    certificate.serialNumber = "01";
    certificate.validity.notBefore = new Date(Date.now() - 60000);
    certificate.validity.notAfter = new Date(Date.now() + 3600000);
    const subject = [{ name: "commonName", value: hostname }];
    certificate.setSubject(subject);
    certificate.setIssuer(subject);
    certificate.setExtensions([
        { name: "basicConstraints", cA: true },
        {
            name: "keyUsage",
            digitalSignature: true,
            keyEncipherment: true,
            keyCertSign: true,
        },
        { name: "subjectAltName", altNames: [{ type: 2, value: hostname }] },
    ]);
    certificate.sign(
        forge.pki.privateKeyFromPem(pair.privateKey),
        forge.md.sha256.create(),
    );
    return {
        key: pair.privateKey,
        cert: forge.pki.certificateToPem(certificate),
    };
}
