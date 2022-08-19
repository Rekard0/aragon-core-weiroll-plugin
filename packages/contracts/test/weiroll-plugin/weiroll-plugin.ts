import {ethers} from 'hardhat';
import {SignerWithAddress} from '@nomiclabs/hardhat-ethers/signers';

import {DAO, WeirollPlugin} from '../../typechain';

import {
  Contract as WeirollContract,
  Value as WeirolValue,
  Planner,
} from '@weiroll/weiroll.js';
import {expect} from 'chai';

const dummyAddress1 = '0x0000000000000000000000000000000000000001';
const dummyAddress2 = '0x0000000000000000000000000000000000000002';
const dummyMetadata1 = '0x0001';
const dummyMetadata2 = '0x0002';

const EVENTS = {
  MetadataSet: 'MetadataSet',
  TrustedForwarderSet: 'TrustedForwarderSet',
  ConfigUpdated: 'ConfigUpdated',
  DAOCreated: 'DAOCreated',
  Granted: 'Granted',
  Revoked: 'Revoked',
  Deposited: 'Deposited',
  Withdrawn: 'Withdrawn',
  Executed: 'Executed',
  NativeTokenDeposited: 'NativeTokenDeposited',
};

const PERMISSION_IDS = {
  ROOT_PERMISSION_ID: ethers.utils.id('ROOT_PERMISSION'),
  UPGRADE_PERMISSION_ID: ethers.utils.id('UPGRADE_PERMISSION'),
  SET_METADATA_PERMISSION_ID: ethers.utils.id('SET_METADATA_PERMISSION'),
  EXECUTE_PERMISSION_ID: ethers.utils.id('EXECUTE_PERMISSION'),
  WITHDRAW_PERMISSION_ID: ethers.utils.id('WITHDRAW_PERMISSION'),
  SET_SIGNATURE_VALIDATOR_PERMISSION_ID: ethers.utils.id(
    'SET_SIGNATURE_VALIDATOR_PERMISSION'
  ),
  SET_TRUSTED_FORWARDER_PERMISSION_ID: ethers.utils.id(
    'SET_TRUSTED_FORWARDER_PERMISSION'
  ),
  EXECUTE_ON_WEIROLL_PERMISSION_ID: ethers.utils.id(
    'EXECUTE_ON_WEIROLL_PERMISSION'
  ),
};

describe('Weiroll-plugin', function () {
  let signers: SignerWithAddress[];
  let ownerAddress: string;
  let dao: any;

  async function installWeirollOnDAO(): Promise<any> {
    const Weiroll = await ethers.getContractFactory('WeirollPlugin');
    const weiroll = await Weiroll.deploy();

    dao.grant(
      dao.address,
      weiroll.address,
      PERMISSION_IDS.EXECUTE_PERMISSION_ID
    );

    dao.grant(dao.address, weiroll.address, PERMISSION_IDS.ROOT_PERMISSION_ID);

    dao.grant(
      weiroll.address,
      dao.address,
      PERMISSION_IDS.EXECUTE_ON_WEIROLL_PERMISSION_ID
    );

    return weiroll;
  }

  beforeEach(async () => {
    signers = await ethers.getSigners();
    ownerAddress = await signers[0].getAddress();

    const DAO = await ethers.getContractFactory('DAO');
    dao = await DAO.deploy();
    await dao.initialize(dummyMetadata1, ownerAddress, dummyAddress1);

    // Grant permissions to owner address
    await Promise.all([
      dao.grant(
        dao.address,
        ownerAddress,
        PERMISSION_IDS.SET_METADATA_PERMISSION_ID
      ),
      dao.grant(
        dao.address,
        ownerAddress,
        PERMISSION_IDS.EXECUTE_PERMISSION_ID
      ),
      dao.grant(
        dao.address,
        ownerAddress,
        PERMISSION_IDS.WITHDRAW_PERMISSION_ID
      ),
      dao.grant(
        dao.address,
        ownerAddress,
        PERMISSION_IDS.UPGRADE_PERMISSION_ID
      ),
      dao.grant(
        dao.address,
        ownerAddress,
        PERMISSION_IDS.SET_SIGNATURE_VALIDATOR_PERMISSION_ID
      ),
      dao.grant(
        dao.address,
        ownerAddress,
        PERMISSION_IDS.SET_TRUSTED_FORWARDER_PERMISSION_ID
      ),
    ]);
  });

  describe('Simulate flow of Existing Dao install new plugin', async () => {
    it('install weiroll first then another plugin and handle permissions', async () => {
      // install weiroll on DAO
      const weirollPluginEtherContract = await installWeirollOnDAO();

      // prepare weiroll contractJs
      const weirollPluginWeirollContract = WeirollContract.createContract(
        weirollPluginEtherContract
      );

      const daoWeirollContract = WeirollContract.createContract(dao);

      // plan
      const planner = new Planner();

      // prepare a plugin to install
      const AllowlistVoting = await ethers.getContractFactory(
        'AllowlistVoting'
      );
      const votingLogic = await AllowlistVoting.deploy();
      let AllowlistVotingABI = [
        'function initialize(address _dao, address _trustedForwarder, uint64 _participationRequiredPct, uint64 _supportRequiredPct, uint64 _minDuration, address[] calldata _allowed)',
      ];
      let AllowlistVotingABIiface = new ethers.utils.Interface(
        AllowlistVotingABI
      );
      const initData = AllowlistVotingABIiface.encodeFunctionData(
        'initialize',
        [
          dao.address,
          ethers.constants.AddressZero,
          500,
          1000,
          6000,
          [ownerAddress],
        ]
      );

      // add to plant the creation of the plugin
      const retDeployAllowListVotingAddress = planner.add(
        weirollPluginWeirollContract.createProxy(
          dao.address,
          votingLogic.address,
          initData
        )
      );

      // add to plan the permission needed for the plugin
      planner.add(
        daoWeirollContract.grant(
          dao.address,
          retDeployAllowListVotingAddress,
          PERMISSION_IDS.EXECUTE_PERMISSION_ID
        )
      );

      const {commands, state} = planner.plan();

      // prepare dao execute call to call weiroll plugin executor
      let WeirollABI = [
        'function execute(bytes32[] calldata commands, bytes[] memory state)',
      ];
      let weirollABIiface = new ethers.utils.Interface(WeirollABI);
      const weirollData = weirollABIiface.encodeFunctionData('execute', [
        commands,
        state,
      ]);

      // prepare action for dao executor and execute
      const actions = [
        {
          to: weirollPluginEtherContract.address,
          data: weirollData,
          value: 0,
        },
      ];
      await dao.execute(1, actions);
    });
  });
});
