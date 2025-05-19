// SPDX-License-Identifier: MIT
pragma solidity =0.8.10;
import "forge-std/console.sol";

import "ds-test/test.sol";
import "../../contracts/core/DFSRegistry.sol";
import "../../contracts/core/strategy/BotAuth.sol";
import "../../contracts/actions/utils/helpers/ActionsUtilHelper.sol";
import "../CheatCodes.sol";

contract RegistryUtils is ActionsUtilHelper {
    function redeploy(string memory _actionName, address _newAddr) public {
        DFSRegistry registry = DFSRegistry(REGISTRY_ADDR);
        CheatCodes vm = CheatCodes(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);

        bytes4 actionId = bytes4(keccak256(abi.encodePacked(_actionName)));

        (,uint256 waitPeriod,,,,bool exists) = registry.entries(actionId);

        address owner = AdminVault(registry.adminVault()).owner();

        vm.startPrank(owner);

        if (exists) {
            registry.startContractChange(actionId, _newAddr);
            // time travel
            vm.warp(block.timestamp + waitPeriod);
            registry.approveContractChange(actionId);
        } else {
            registry.addNewContract(actionId, _newAddr, 0);
        }

        vm.stopPrank();
    }

    function getAddr(string memory _name) public view returns (address) {
        DFSRegistry registry = DFSRegistry(REGISTRY_ADDR);

        bytes4 id = bytes4(keccak256(abi.encodePacked(_name)));

        return registry.getAddr(id);
    }

    function addBotCaller(address _newBot) public {
        CheatCodes vm = CheatCodes(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);
        BotAuth botAuth = BotAuth(getAddr("BotAuth"));

        address owner = AdminVault(botAuth.adminVault()).owner();

        vm.startPrank(owner);
        botAuth.addCaller(_newBot);
        vm.stopPrank();
    }

}