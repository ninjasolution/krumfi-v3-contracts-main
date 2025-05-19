// SPDX-License-Identifier: MIT
pragma solidity =0.8.10;
pragma experimental ABIEncoderV2;

import "../../ActionBase.sol";
import "../helpers/CurveHelper.sol";
import "../../../utils/TokenUtils.sol";

import "../../../interfaces/curve/ILiquidityGauge.sol";

contract CurveGaugeDeposit is ActionBase, CurveHelper {
    using TokenUtils for address;

    struct Params {
        address gaugeAddr;  // gauge to deposit into
        address lpToken;    // LP token address, needed for approval
        address sender;     // address where the LP tokens are pulled from
        address onBehalfOf; // address of the deposit beneficiary
        uint256 amount;     // amount of LP tokens to deposit
    }

    function executeAction(
        bytes memory _callData,
        bytes32[] memory _subData,
        uint8[] memory _paramMapping,
        bytes32[] memory _returnValues
    ) public payable virtual override returns (bytes32) {
        Params memory params = parseInputs(_callData);
        params.sender = _parseParamAddr(params.sender, _paramMapping[0], _subData, _returnValues);
        params.onBehalfOf = _parseParamAddr(params.onBehalfOf, _paramMapping[1], _subData, _returnValues);
        params.amount = _parseParamUint(params.amount, _paramMapping[2], _subData, _returnValues);

        (uint256 deposited, bytes memory logData) = _curveGaugeDeposit(params);
        emit ActionEvent("CurveGaugeDeposit", logData);
        return bytes32(deposited);
    }

    /// @inheritdoc ActionBase
    function executeActionDirect(bytes memory _callData) public payable virtual override {
        Params memory params = parseInputs(_callData);
        (, bytes memory logData) = _curveGaugeDeposit(params);
        logger.logActionDirectEvent("CurveGaugeDeposit", logData);
    }

    /// @inheritdoc ActionBase
    function actionType() public pure virtual override returns (uint8) {
        return uint8(ActionType.STANDARD_ACTION);
    }

    /// @notice Deposits LP tokens into pool Liquidity Gauge
    /// @dev if _params.receiver != address(this) the receiver must call set_approve_deposit on gauge
    function _curveGaugeDeposit(Params memory _params) internal returns (uint256, bytes memory) {
        require(_params.onBehalfOf != address(0), "cant deposit on behalf of 0x0");
        
        if (_params.amount == type(uint256).max) {
            _params.amount = _params.lpToken.getBalance(_params.sender);
        }
        _params.lpToken.pullTokensIfNeeded(_params.sender, _params.amount);
        _params.lpToken.approveToken(_params.gaugeAddr, _params.amount);
        ILiquidityGauge(_params.gaugeAddr).deposit(_params.amount, _params.onBehalfOf);

        bytes memory logData = abi.encode(_params);
        return (_params.amount, logData);
    }

    function parseInputs(bytes memory _callData) internal pure returns (Params memory params) {
        params = abi.decode(_callData, (Params));
    }
}