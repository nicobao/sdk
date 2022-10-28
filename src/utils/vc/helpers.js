import jsonld from 'jsonld';
import { getPublicKeyFromKeyringPair } from '../misc';
import defaultDocumentLoader from './document-loader';

import {
  EcdsaSecp256k1VerKeyName, Ed25519VerKeyName, Sr25519VerKeyName,
  EcdsaSepc256k1Signature2019, Ed25519Signature2018, Sr25519Signature2020,
  Bls12381BBSSignatureDock2022, Bls12381BBSDockVerKeyName,
} from './custom_crypto';

/**
 * @typedef {object} KeyDoc The Options to use in the function createUser.
 * @property {string} id The key's ID
 * @property {any} controller The key's controller ste
 * @property {any} type the type of key, Sr25519VerificationKey2020 or Ed25519VerificationKey2018 or EcdsaSecp256k1VerificationKey2019
 * @property {object} keypair Keypair is generated by either using polkadot-js's keyring or utils
 * @property {object} publicKey The key's public key taken from the keypair
 */

/**
 * Helper to get the key doc in a format needed for vc.js.
 * @param {string} did - DID in fully qualified form
 * @param {object} keypair - Keypair is generated by either using polkadot-js's keyring for Sr25519 and
 * Ed25519 or keypair generated with `generateEcdsaSecp256k1Keypair` for curve secp256k1.
 * @param {string} type - the type of key, Sr25519VerificationKey2020 or Ed25519VerificationKey2018 or EcdsaSecp256k1VerificationKey2019
 * @returns {KeyDoc}
 */
export default function getKeyDoc(did, keypair, type) {
  return {
    id: `${did}#keys-1`,
    controller: did,
    type,
    keypair,
    publicKey: getPublicKeyFromKeyringPair(keypair),
  };
}

/**
 * Get signature suite from a keyDoc
 * @param {object} keyDoc - key document containing `id`, `controller`, `type`, `privateKeyBase58` and `publicKeyBase58`
 * @returns {object} - signature suite.
 */
export function getSuiteFromKeyDoc(keyDoc) {
  // Check if passing suite directly
  if (keyDoc.verificationMethod) {
    return keyDoc;
  }

  let Cls;
  switch (keyDoc.type) {
    case EcdsaSecp256k1VerKeyName:
      Cls = EcdsaSepc256k1Signature2019;
      break;
    case Ed25519VerKeyName:
      Cls = Ed25519Signature2018;
      break;
    case Sr25519VerKeyName:
      Cls = Sr25519Signature2020;
      break;
    case Bls12381BBSDockVerKeyName:
      Cls = Bls12381BBSSignatureDock2022;
      break;
    default:
      throw new Error(`Unknown key type ${keyDoc.type}.`);
  }
  return new Cls({
    ...keyDoc,
    verificationMethod: keyDoc.id,
  });
}

/**
 * Helper method to ensure credential is valid according to the context
 * @param credential
 */
export async function expandJSONLD(credential, options = {}) {
  if (options.documentLoader && options.resolver) {
    throw new Error('Passing resolver and documentLoader results in resolver being ignored, please re-factor.');
  }

  const expanded = await jsonld.expand(credential, {
    ...options,
    documentLoader: options.documentLoader || defaultDocumentLoader(options.resolver),
  });
  return expanded[0];
}
