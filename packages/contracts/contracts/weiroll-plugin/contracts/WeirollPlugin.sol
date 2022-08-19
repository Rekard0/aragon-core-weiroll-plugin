// SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;

import "./weiroll/VM.sol";
import "../../core/plugin/AragonPlugin.sol";
import "../../utils/PluginERC1967Proxy.sol";

contract WeirollPlugin is VM, AragonPlugin {
    bytes32 public constant EXECUTE_ON_WEIROLL_PERMISSION_ID =
        keccak256("EXECUTE_ON_WEIROLL_PERMISSION");

    function createProxy(
        address dao,
        address logic,
        bytes memory init
    ) external returns (address) {
        return address(new PluginERC1967Proxy(dao, logic, init));
    }

    function execute(bytes32[] calldata commands, bytes[] memory state)
        external
        returns (
            // auth(EXECUTE_ON_WEIROLL_PERMISSION_ID)
            bytes[] memory results
        )
    {
        results = _execute(commands, state);
    }
}
