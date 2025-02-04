import { randomAsHex } from '@polkadot/util-crypto';
import {
  initializeWasm, Accumulator, PositiveAccumulator, WitnessUpdatePublicInfo, AccumulatorParams,
} from '@docknetwork/crypto-wasm-ts';
import { InMemoryState } from '@docknetwork/crypto-wasm-ts/lib/accumulator/in-memory-persistence';
import { hexToU8a, stringToHex, u8aToHex } from '@polkadot/util';
import { DockAPI } from '../../../src';
import { FullNodeEndpoint, TestAccountURI, TestKeyringOpts } from '../../test-constants';
import { createNewDockDID, getHexIdentifierFromDID } from '../../../src/utils/did';

import AccumulatorModule from '../../../src/modules/accumulator';
import { getAllEventsFromBlock } from '../../../src/utils/chain-ops';
import { registerNewDIDUsingPair } from '../helpers';

describe('Accumulator Module', () => {
  const dock = new DockAPI();
  let account;
  let did1;
  let did2;
  let pair1;
  let pair2;
  let chainModule;
  const chainModuleClass = AccumulatorModule;

  const seed1 = randomAsHex(32);
  const seed2 = randomAsHex(32);
  const seedAccum = randomAsHex(32);
  const accumState = new InMemoryState();

  beforeAll(async () => {
    await dock.init({
      keyring: TestKeyringOpts,
      address: FullNodeEndpoint,
    });
    chainModule = dock.accumulatorModule;
    account = dock.keyring.addFromUri(TestAccountURI);
    dock.setAccount(account);
    pair1 = dock.keyring.addFromUri(seed1);
    pair2 = dock.keyring.addFromUri(seed2);
    did1 = createNewDockDID();
    did2 = createNewDockDID();
    await registerNewDIDUsingPair(dock, did1, pair1);
    await registerNewDIDUsingPair(dock, did2, pair2);
    await initializeWasm();
  }, 20000);

  test('Can create new params', async () => {
    let label = stringToHex('accumulator-params-label');
    let params = Accumulator.generateParams(hexToU8a(label));
    const bytes1 = u8aToHex(params.bytes);
    const params1 = chainModuleClass.prepareAddParameters(bytes1, undefined, label);
    await chainModule.addParams(params1, did1, pair1, 1, { didModule: dock.did }, false);
    const paramsWritten1 = await chainModule.getLastParamsWritten(did1);
    expect(paramsWritten1.bytes).toEqual(params1.bytes);
    expect(paramsWritten1.label).toEqual(params1.label);

    const queriedParams1 = await chainModule.getParams(did1, 1);
    expect(paramsWritten1).toEqual(queriedParams1);

    label = stringToHex('some label');
    params = Accumulator.generateParams(hexToU8a(label));
    const bytes2 = u8aToHex(params.bytes);
    const params2 = chainModuleClass.prepareAddParameters(bytes2);
    await chainModule.addParams(params2, did2, pair2, 1, { didModule: dock.did }, false);
    const paramsWritten2 = await chainModule.getLastParamsWritten(did2);
    expect(paramsWritten2.bytes).toEqual(params2.bytes);
    expect(paramsWritten2.label).toBe(null);

    const queriedParams2 = await chainModule.getParams(did2, 1);
    expect(paramsWritten2).toEqual(queriedParams2);

    label = stringToHex('some label');
    params = Accumulator.generateParams(hexToU8a(label));
    const bytes3 = u8aToHex(params.bytes);
    const params3 = chainModuleClass.prepareAddParameters(bytes3);
    await chainModule.addParams(params3, did1, pair1, 1, { didModule: dock.did }, false);
    const paramsWritten3 = await chainModule.getLastParamsWritten(did1);
    expect(paramsWritten3.bytes).toEqual(params3.bytes);
    expect(paramsWritten3.label).toBe(null);

    const queriedParams3 = await chainModule.getParams(did1, 2);
    expect(paramsWritten3).toEqual(queriedParams3);

    const paramsByDid1 = await chainModule.getAllParamsByDid(did1);
    expect(paramsByDid1[0]).toEqual(paramsWritten1);
    expect(paramsByDid1[1]).toEqual(paramsWritten3);

    const paramsByDid2 = await chainModule.getAllParamsByDid(did2);
    expect(paramsByDid2[0]).toEqual(paramsWritten2);
  }, 30000);

  test('Can create public keys', async () => {
    const params = Accumulator.generateParams();
    let keypair = Accumulator.generateKeypair(params);
    const bytes1 = u8aToHex(keypair.publicKey.bytes);
    const pk1 = chainModuleClass.prepareAddPublicKey(bytes1);
    await chainModule.addPublicKey(pk1, did1, pair1, 1, { didModule: dock.did }, false);

    const queriedPk1 = await chainModule.getPublicKey(did1, 1);
    expect(queriedPk1.bytes).toEqual(pk1.bytes);
    expect(queriedPk1.paramsRef).toBe(null);

    const params1 = await chainModule.getParams(did1, 1);
    const aparams1 = new AccumulatorParams(hexToU8a(params1.bytes));
    keypair = Accumulator.generateKeypair(aparams1, hexToU8a(seedAccum));
    const bytes2 = u8aToHex(keypair.publicKey.bytes);
    const pk2 = chainModuleClass.prepareAddPublicKey(bytes2, undefined, [did1, 1]);
    await chainModule.addPublicKey(pk2, did2, pair2, 1, { didModule: dock.did }, false);

    const queriedPk2 = await chainModule.getPublicKey(did2, 1);
    expect(queriedPk2.bytes).toEqual(pk2.bytes);
    expect(queriedPk2.paramsRef).toEqual([getHexIdentifierFromDID(did1), 1]);

    const queriedPk2WithParams = await chainModule.getPublicKey(did2, 1, true);
    expect(queriedPk2WithParams.params).toEqual(params1);

    const params2 = await chainModule.getParams(did1, 2);
    const aparams2 = new AccumulatorParams(hexToU8a(params2.bytes));
    keypair = Accumulator.generateKeypair(aparams2);
    const bytes3 = u8aToHex(keypair.publicKey.bytes);
    const pk3 = chainModuleClass.prepareAddPublicKey(bytes3, undefined, [did1, 2]);
    await chainModule.addPublicKey(pk3, did2, pair2, 1, { didModule: dock.did }, false);

    const queriedPk3 = await chainModule.getPublicKey(did2, 2);
    expect(queriedPk3.bytes).toEqual(pk3.bytes);
    expect(queriedPk3.paramsRef).toEqual([getHexIdentifierFromDID(did1), 2]);

    const queriedPk3WithParams = await chainModule.getPublicKey(did2, 2, true);
    expect(queriedPk3WithParams.params).toEqual(params2);

    const pksByDid1 = await chainModule.getAllPublicKeysByDid(did1);
    expect(pksByDid1[0]).toEqual(queriedPk1);

    const pksByDid2 = await chainModule.getAllPublicKeysByDid(did2);
    expect(pksByDid2[0]).toEqual(queriedPk2);
    expect(pksByDid2[1]).toEqual(queriedPk3);

    const pksWithParamsByDid2 = await chainModule.getAllPublicKeysByDid(
      did2,
      true,
    );
    expect(pksWithParamsByDid2[0]).toEqual(queriedPk2WithParams);
    expect(pksWithParamsByDid2[1]).toEqual(queriedPk3WithParams);
  }, 30000);

  test('Can add and remove accumulator', async () => {
    const id1 = randomAsHex(32);
    const accumulated1 = randomAsHex(100);
    await chainModule.addPositiveAccumulator(id1, accumulated1, [did1, 1], did1, pair1, 1, { didModule: dock.did }, false);

    const id2 = randomAsHex(32);
    const accumulated2 = randomAsHex(100);
    const maxSize = 100000;
    await chainModule.addUniversalAccumulator(id2, accumulated2, [did2, 1], maxSize, did2, pair2, 1, { didModule: dock.did }, false);

    const accum1 = await chainModule.getAccumulator(id1, false);
    expect(accum1.created > 0).toBe(true);
    expect(accum1.lastModified > 0).toBe(true);
    expect(accum1.created).toEqual(accum1.lastModified);
    expect(accum1.type).toEqual('positive');
    expect(accum1.accumulated).toEqual(accumulated1);
    expect(accum1.keyRef).toEqual([getHexIdentifierFromDID(did1), 1]);
    expect(accum1.publicKey).toBeUndefined();

    const accum2 = await chainModule.getAccumulator(id2, false);
    expect(accum2.created > 0).toBe(true);
    expect(accum2.lastModified > 0).toBe(true);
    expect(accum2.created).toEqual(accum2.lastModified);
    expect(accum2.type).toEqual('universal');
    expect(accum2.accumulated).toEqual(accumulated2);
    expect(accum2.keyRef).toEqual([getHexIdentifierFromDID(did2), 1]);
    expect(accum2.publicKey).toBeUndefined();

    const keyWithParams = await chainModule.getPublicKey(did2, 1, true);
    const accum2WithKeyAndParams = await chainModule.getAccumulator(id2, true);
    expect(accum2WithKeyAndParams.created > 0).toBe(true);
    expect(accum2WithKeyAndParams.lastModified > 0).toBe(true);
    expect(accum2WithKeyAndParams.created).toEqual(
      accum2WithKeyAndParams.lastModified,
    );
    expect(accum2WithKeyAndParams.type).toEqual('universal');
    expect(accum2WithKeyAndParams.accumulated).toEqual(accumulated2);
    expect(accum2WithKeyAndParams.keyRef).toEqual([getHexIdentifierFromDID(did2), 1]);
    expect(accum2WithKeyAndParams.publicKey).toEqual(keyWithParams);

    await chainModule.removeAccumulator(id1, did1, pair1, 1, { didModule: dock.did }, false);
    expect(await chainModule.getAccumulator(id1, false)).toEqual(null);

    await chainModule.removeAccumulator(id2, did2, pair2, 1, { didModule: dock.did }, false);
    expect(await chainModule.getAccumulator(id2, false)).toEqual(null);
  }, 50000);

  test('Update accumulator', async () => {
    const queriedPkWithParams = await chainModule.getPublicKey(did2, 1, true);
    const aparams = new AccumulatorParams(hexToU8a(queriedPkWithParams.params.bytes));
    const keypair = Accumulator.generateKeypair(aparams, hexToU8a(seedAccum));
    const accumulator = PositiveAccumulator.initialize(aparams, keypair.secretKey);

    const member1 = Accumulator.encodePositiveNumberAsAccumulatorMember(25);
    await accumulator.add(member1, keypair.secretKey, accumState);

    const accumulated1 = u8aToHex(accumulator.accumulated);
    const id = randomAsHex(32);
    await chainModule.addPositiveAccumulator(id, accumulated1, [did2, 1], did2, pair2, 1, { didModule: dock.did }, false);
    const accum1 = await chainModule.getAccumulator(id, false);
    expect(accum1.accumulated).toEqual(accumulated1);

    const accumulated2 = u8aToHex(accumulator.accumulated);
    await chainModule.updateAccumulator(id, accumulated2, {}, did2, pair2, 1, { didModule: dock.did }, false);
    const accum2 = await chainModule.getAccumulator(id, false);
    expect(accum2.accumulated).toEqual(accumulated2);

    const member2 = Accumulator.encodePositiveNumberAsAccumulatorMember(31);
    await accumulator.add(member2, keypair.secretKey, accumState);

    const member3 = Accumulator.encodePositiveNumberAsAccumulatorMember(7);
    await accumulator.add(member3, keypair.secretKey, accumState);

    await accumulator.remove(member1, keypair.secretKey, accumState);

    const accumulated3 = u8aToHex(accumulator.accumulated);
    const additions1 = [u8aToHex(member2), u8aToHex(member3)];
    const removals1 = [u8aToHex(member1)];
    const witUpd1 = u8aToHex(WitnessUpdatePublicInfo.new(hexToU8a(accumulated2), [member2, member3], [member1], keypair.secretKey).value);
    await chainModule.updateAccumulator(id, accumulated3, { additions: additions1, removals: removals1, witnessUpdateInfo: witUpd1 }, did2, pair2, 1, { didModule: dock.did }, false);
    const accum3 = await chainModule.getAccumulator(id, false);
    expect(accum3.accumulated).toEqual(accumulated3);

    const member4 = Accumulator.encodePositiveNumberAsAccumulatorMember(103);
    await accumulator.add(member4, keypair.secretKey, accumState);

    const member5 = Accumulator.encodePositiveNumberAsAccumulatorMember(50);
    await accumulator.add(member5, keypair.secretKey, accumState);

    const accumulated4 = u8aToHex(accumulator.accumulated);
    const additions2 = [u8aToHex(member4), u8aToHex(member5)];
    const witUpd2 = u8aToHex(WitnessUpdatePublicInfo.new(hexToU8a(accumulated3), [member4, member5], [], keypair.secretKey).value);
    await chainModule.updateAccumulator(id, accumulated4, { additions: additions2, witnessUpdateInfo: witUpd2 }, did2, pair2, 1, { didModule: dock.did }, false);
    const accum4 = await chainModule.getAccumulator(id, false);
    expect(accum4.accumulated).toEqual(accumulated4);

    await accumulator.remove(member2, keypair.secretKey, accumState);
    await accumulator.remove(member4, keypair.secretKey, accumState);

    const accumulated5 = u8aToHex(accumulator.accumulated);
    const removals3 = [u8aToHex(member2), u8aToHex(member4)];
    const witUpd3 = u8aToHex(WitnessUpdatePublicInfo.new(hexToU8a(accumulated4), [], [member2, member4], keypair.secretKey).value);
    await chainModule.updateAccumulator(id, accumulated5, { removals: removals3, witnessUpdateInfo: witUpd3 }, did2, pair2, 1, { didModule: dock.did }, false);
    const accum5 = await chainModule.getAccumulator(id, false);
    expect(accum5.accumulated).toEqual(accumulated5);

    const updates1 = await chainModule.getUpdatesFromBlock(
      id,
      accum2.lastModified,
    );
    expect(updates1[0].newAccumulated).toEqual(accumulated2);
    expect(updates1[0].additions).toEqual(null);
    expect(updates1[0].removals).toEqual(null);
    expect(updates1[0].witnessUpdateInfo).toEqual(null);

    const events1 = (
      await getAllEventsFromBlock(chainModule.api, accum2.lastModified, false)
    ).filter(({ event }) => event.section === 'accumulator');

    expect(
      chainModuleClass.parseEventAsAccumulatorUpdate(events1[0].event),
    ).toEqual([id, accumulated2]);

    const updates2 = await chainModule.getUpdatesFromBlock(
      id,
      accum3.lastModified,
    );
    expect(updates2[0].newAccumulated).toEqual(accumulated3);
    expect(updates2[0].additions).toEqual(additions1);
    expect(updates2[0].removals).toEqual(removals1);
    expect(updates2[0].witnessUpdateInfo).toEqual(witUpd1);

    const events2 = (
      await getAllEventsFromBlock(chainModule.api, accum3.lastModified, false)
    ).filter(({ event }) => event.section === 'accumulator');
    expect(
      chainModuleClass.parseEventAsAccumulatorUpdate(events2[0].event),
    ).toEqual([id, accumulated3]);

    const updates3 = await chainModule.getUpdatesFromBlock(
      id,
      accum4.lastModified,
    );
    expect(updates3[0].newAccumulated).toEqual(accumulated4);
    expect(updates3[0].additions).toEqual(additions2);
    expect(updates3[0].removals).toEqual(null);
    expect(updates3[0].witnessUpdateInfo).toEqual(witUpd2);

    const updates4 = await chainModule.getUpdatesFromBlock(
      id,
      accum5.lastModified,
    );
    expect(updates4[0].newAccumulated).toEqual(accumulated5);
    expect(updates4[0].additions).toEqual(null);
    expect(updates4[0].removals).toEqual(removals3);
    expect(updates4[0].witnessUpdateInfo).toEqual(witUpd3);
  }, 50000);

  test('Can remove public keys and params', async () => {
    await chainModule.removePublicKey(1, did1, pair1, 1, { didModule: dock.did }, false);
    const pk1 = await chainModule.getPublicKey(did1, 1);
    expect(pk1).toEqual(null);

    const pksByDid1 = await chainModule.getAllPublicKeysByDid(did1);
    expect(pksByDid1.length).toEqual(0);

    await chainModule.removeParams(1, did1, pair1, 1, { didModule: dock.did }, false);
    const params1 = await chainModule.getParams(did1, 1);
    expect(params1).toEqual(null);

    await expect(chainModule.getPublicKey(did2, 1, true)).rejects.toThrow();

    await chainModule.removePublicKey(1, did2, pair2, 1, { didModule: dock.did }, false);
    const pk2 = await chainModule.getPublicKey(did2, 1);
    expect(pk2).toEqual(null);

    const pksByDid2 = await chainModule.getAllPublicKeysByDid(did2);
    expect(pksByDid2.length).toEqual(1);

    const queriedPk2 = await chainModule.getPublicKey(did2, 2);
    expect(pksByDid2[0]).toEqual(queriedPk2);

    await chainModule.removePublicKey(2, did2, pair2, 1, { didModule: dock.did }, false);
    const pk3 = await chainModule.getPublicKey(did2, 2);
    expect(pk3).toEqual(null);

    await chainModule.removeParams(2, did1, pair1, 1, { didModule: dock.did }, false);
    const params2 = await chainModule.getParams(did1, 2);
    expect(params2).toEqual(null);

    await chainModule.removeParams(1, did2, pair2, 1, { didModule: dock.did }, false);
    const params3 = await chainModule.getParams(did2, 1);
    expect(params3).toEqual(null);
  }, 50000);

  afterAll(async () => {
    await dock.disconnect();
  }, 10000);
});
