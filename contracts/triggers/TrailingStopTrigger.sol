// SPDX-License-Identifier: MIT

pragma solidity =0.8.10;

import "../auth/AdminAuth.sol";
import "../DS/DSMath.sol";
import "../interfaces/ITrigger.sol";
import "../interfaces/chainlink/IFeedRegistry.sol";
import "../interfaces/lido/IWStEth.sol";
import "../utils/Denominations.sol";
import "../utils/TokenUtils.sol";
import "./helpers/TriggerHelper.sol";
import "../utils/TokenPriceHelper.sol";

/// @title Validates trailing stop, caller injects a chainlink roundId where conditions are met
contract TrailingStopTrigger is ITrigger, AdminAuth, TriggerHelper, DSMath, TokenPriceHelper {
    using TokenUtils for address;

    struct SubParams {
        address tokenAddr;
        uint256 percentage;
        uint80 startRoundId;
    }

    struct CallParams {
        uint80 maxRoundId;
    }

    function isTriggered(bytes memory _callData, bytes memory _subData)
        public
        view
        override
        returns (bool)
    {
        SubParams memory triggerSubData = parseSubInputs(_subData);
        CallParams memory triggerCallData = parseCallInputs(_callData);

        // valid chainlink id should never be 0
        if (triggerCallData.maxRoundId == 0 || triggerSubData.startRoundId == 0) return false;

        (uint256 currPrice, ) = getRoundInfo(triggerSubData.tokenAddr, 0);
        (uint256 maxPrice, uint256 maxPriceTimeStamp) = getRoundInfo(
            triggerSubData.tokenAddr,
            triggerCallData.maxRoundId
        );

        (, uint256 startTimeStamp) = getRoundInfo(triggerSubData.tokenAddr, triggerSubData.startRoundId);

        // we can't send a roundId that happened before the users sub
        if (maxPriceTimeStamp < startTimeStamp) {
            return false;
        }

        return checkPercentageDiff(currPrice, maxPrice, triggerSubData.percentage);
    }

    /// @notice Given the currentPrice and the maxPrice see if there diff. > than percentage
    function checkPercentageDiff(
        uint256 _currPrice,
        uint256 _maxPrice,
        uint256 _percentage
    ) public pure returns (bool) {
        uint256 amountDiff = (_maxPrice * _percentage) / 10**10;

        return _currPrice <= (_maxPrice - amountDiff);
    }

    function changedSubData(bytes memory _subData) public pure override returns (bytes memory) {}

    function isChangeable() public pure override returns (bool) {
        return false;
    }

    function parseSubInputs(bytes memory _callData)
        internal
        pure
        returns (SubParams memory params)
    {
        params = abi.decode(_callData, (SubParams));
    }

    function parseCallInputs(bytes memory _callData)
        internal
        pure
        returns (CallParams memory params)
    {
        params = abi.decode(_callData, (CallParams));
    }
}
