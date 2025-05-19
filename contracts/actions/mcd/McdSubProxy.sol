// SPDX-License-Identifier: MIT

pragma solidity =0.8.10;

import "../../auth/AdminAuth.sol";
import "../../auth/ProxyPermission.sol";
import "../../core/strategy/SubStorage.sol";
import "../../utils/helpers/UtilHelper.sol";
import "../../interfaces/ISubscriptions.sol";

/// @title Subscribes users to boost/repay strategies for Maker
contract McdSubProxy is StrategyModel, AdminAuth, ProxyPermission, CoreHelper, UtilHelper {
    uint64 public immutable REPAY_BUNDLE_ID; 
    uint64 public immutable BOOST_BUNDLE_ID; 

    address public constant MCD_SUB_ADDRESS = 0xC45d4f6B6bf41b6EdAA58B01c4298B8d9078269a;
    address public constant LEGACY_PROXY_AUTH_ADDR = 0x1816A86C4DA59395522a42b871bf11A4E96A1C7a;

    constructor(uint64 _repayBundleId, uint64 _boostBundleId) {
        REPAY_BUNDLE_ID = _repayBundleId;
        BOOST_BUNDLE_ID = _boostBundleId;
    }

    enum RatioState { OVER, UNDER }

    /// @dev 2% offset acceptable
    uint256 internal constant RATIO_OFFSET = 20000000000000000;

    error WrongSubParams(uint256 minRatio, uint256 maxRatio);
    error RangeTooClose(uint256 ratio, uint256 targetRatio);

    /// @dev Input data from the user, for both repay/boost bundles
    struct McdSubData {
        uint256 vaultId;
        uint256 minRatio;
        uint256 maxRatio;
        uint128 targetRatioBoost;
        uint128 targetRatioRepay;
        bool boostEnabled;
    }

    /// @notice Parses input data and subscribes user to repay and boost bundles
    /// @dev Gives DSProxy permission if needed and registers a new sub
    /// @dev If boostEnabled = false it will only create a repay bundle
    /// @dev User can't just sub a boost bundle without repay
    function subToMcdAutomation(
        McdSubData calldata _subData,
        bool _shouldLegacyUnsub
    ) public {
        if (_shouldLegacyUnsub) {
            ISubscriptions(MCD_SUB_ADDRESS).unsubscribe(_subData.vaultId);

            removePermission(LEGACY_PROXY_AUTH_ADDR);

        }

        givePermission(PROXY_AUTH_ADDR);
        StrategySub memory repaySub = formatRepaySub(_subData);

        SubStorage(SUB_STORAGE_ADDR).subscribeToStrategy(repaySub);
        if (_subData.boostEnabled) {
            _validateSubData(_subData);

            StrategySub memory boostSub = formatBoostSub(_subData);
            SubStorage(SUB_STORAGE_ADDR).subscribeToStrategy(boostSub);
        }
    }

    /// @notice Calls SubStorage to update the users subscription data
    /// @dev Updating sub data will activate it as well
    /// @dev If we don't have a boost subId send as 0
    function updateSubData(
        uint32 _subId1,
        uint32 _subId2,
        McdSubData calldata _subData
    ) public {

        // update repay as we must have a subId, it's ok if it's the same data
        StrategySub memory repaySub = formatRepaySub(_subData);
        SubStorage(SUB_STORAGE_ADDR).updateSubData(_subId1, repaySub);
        SubStorage(SUB_STORAGE_ADDR).activateSub(_subId1);

        if (_subData.boostEnabled) {
            _validateSubData(_subData);

            StrategySub memory boostSub = formatBoostSub(_subData);

            // if we don't have a boost bundleId, create one
            if (_subId2 == 0) {
                SubStorage(SUB_STORAGE_ADDR).subscribeToStrategy(boostSub);
            } else {
                SubStorage(SUB_STORAGE_ADDR).updateSubData(_subId2, boostSub);
                SubStorage(SUB_STORAGE_ADDR).activateSub(_subId2);
            }
        } else {
            if (_subId2 != 0) {
                SubStorage(SUB_STORAGE_ADDR).deactivateSub(_subId2);
            }
        }
    }

    /// @notice Activates Repay sub and if exists a Boost sub
    function activateSub(
        uint32 _subId1,
        uint32 _subId2
    ) public {
        SubStorage(SUB_STORAGE_ADDR).activateSub(_subId1);

        if (_subId2 != 0) {
            SubStorage(SUB_STORAGE_ADDR).activateSub(_subId2);
        }
    }

    /// @notice Deactivates Repay sub and if exists a Boost sub
    function deactivateSub(
        uint32 _subId1,
        uint32 _subId2
    ) public {
        SubStorage(SUB_STORAGE_ADDR).deactivateSub(_subId1);

        if (_subId2 != 0) {
            SubStorage(SUB_STORAGE_ADDR).deactivateSub(_subId2);
        }
    }


    ///////////////////////////////// HELPER FUNCTIONS /////////////////////////////////

    function _validateSubData(McdSubData memory _subData) internal pure {
        if (_subData.minRatio > _subData.maxRatio) {
            revert WrongSubParams(_subData.minRatio, _subData.maxRatio);
        }

        if ((_subData.maxRatio - RATIO_OFFSET) < _subData.targetRatioRepay) {
            revert RangeTooClose(_subData.maxRatio, _subData.targetRatioRepay);
        }

        if ((_subData.minRatio + RATIO_OFFSET) > _subData.targetRatioBoost) {
            revert RangeTooClose(_subData.minRatio, _subData.targetRatioBoost);
        }
    }

    /// @notice Formats a StrategySub struct to a Repay bundle from the input data of the mcd sub
    function formatRepaySub(McdSubData memory _user) public view returns (StrategySub memory repaySub) {
        repaySub.strategyOrBundleId = REPAY_BUNDLE_ID;
        repaySub.isBundle = true;

        // format data for ratio trigger if currRatio < minRatio = true
        bytes memory triggerData = abi.encode(_user.vaultId, uint256(_user.minRatio), uint8(RatioState.UNDER));
        repaySub.triggerData =  new bytes[](1);
        repaySub.triggerData[0] = triggerData;

        repaySub.subData =  new bytes32[](3);
        repaySub.subData[0] = bytes32(_user.vaultId);
        repaySub.subData[1] = bytes32(uint256(_user.targetRatioRepay));
        repaySub.subData[2] = bytes32(uint256(uint160(DAI_ADDR)));
    }

    /// @notice Formats a StrategySub struct to a Boost bundle from the input data of the mcd sub
    function formatBoostSub(McdSubData memory _user) public view returns (StrategySub memory boostSub) {
        boostSub.strategyOrBundleId = BOOST_BUNDLE_ID;
        boostSub.isBundle = true;

        // format data for ratio trigger if currRatio > maxRatio = true
        bytes memory triggerData = abi.encode(_user.vaultId, uint256(_user.maxRatio), uint8(RatioState.OVER));
        boostSub.triggerData =  new bytes[](1);
        boostSub.triggerData[0] = triggerData;

        boostSub.subData =  new bytes32[](3);
        boostSub.subData[0] = bytes32(uint256(_user.vaultId));
        boostSub.subData[1] = bytes32(uint256(_user.targetRatioBoost));
        boostSub.subData[2] = bytes32(uint256(uint160(DAI_ADDR)));
    }
}
