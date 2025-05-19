// SPDX-License-Identifier: MIT
pragma solidity =0.8.10;
import "forge-std/console.sol";

import "ds-test/test.sol";
import "../../contracts/core/strategy/StrategyStorage.sol";
import "../CheatCodes.sol";

contract StrategyBuilder {
    string name;
    bool isContinuos;
    bytes4[] actions;
    bytes4[] triggers;
    mapping(bytes4 => string[]) public params;

    mapping(string => uint8) public subValues;
    address internal OWNER_ADDR = 0xBc841B0dE0b93205e912CFBBd1D0c160A1ec6F00;
    address internal STORAGE_ADDR = 0xF52551F95ec4A2B4299DcC42fbbc576718Dbf933;

    CheatCodes vm = CheatCodes(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);

    uint8 startSubIndex = 128;

    constructor(string memory _name, bool _isContinuos) {
        name = _name;
        isContinuos = _isContinuos;
    }

    function addSubMapping(string memory _paramName) public {
        subValues[_paramName] = startSubIndex;
        startSubIndex++;
    }

    function addAction(string memory _actionName, string[] memory _paramMaps) public {
        bytes4 actionId = bytes4(keccak256(abi.encodePacked(_actionName)));
        actions.push(actionId);

        params[actionId] = _paramMaps;
    }

    function addTrigger(string memory _triggerName) public {
        bytes4 triggerId = bytes4(keccak256(abi.encodePacked(_triggerName)));
        triggers.push(triggerId);
    }

    function createStrategy() public returns (uint256) {
        StrategyStorage strategyStorage = StrategyStorage(STORAGE_ADDR);

        uint8[][] memory paramMappings = new uint8[][](actions.length);

        for (uint256 i = 0; i < actions.length; ++i) {
            string[] memory strParams = params[actions[i]];
            paramMappings[i] = new uint8[](strParams.length);

            for (uint256 j = 0; j < strParams.length; ++j) {
                paramMappings[i][j] = getParamNum(strParams[j]);
            }
        }

        vm.startPrank(OWNER_ADDR);

        bytes memory subCallData = abi.encodeWithSignature(
            "createStrategy(string,bytes4[],bytes4[],uint8[][],bool)",
            name,
            triggers,
            actions,
            paramMappings,
            isContinuos
        );

        (bool success, ) = address(strategyStorage).call(subCallData);
        require(success);

        vm.stopPrank();

        return strategyStorage.getStrategyCount() - 1;
    }

    function getParamNum(string memory _strParam) public view returns (uint8) {
        if (keccak256(abi.encode(_strParam)) == keccak256(abi.encode("&proxy"))) {
            return 254;
        }

        if (keccak256(abi.encode(_strParam)) == keccak256(abi.encode("&eoa"))) {
            return 255;
        }

        bytes memory b = bytes(_strParam);
        if (b.length == 2) {
            // 36 ascii == $
            // 38 ascii == 0
            if (uint8(b[0]) == 36) {
                return uint8(b[1]) - 48;
            }
        }

        return subValues[_strParam];
    }
}
