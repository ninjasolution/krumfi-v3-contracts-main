// SPDX-License-Identifier: MIT

pragma solidity =0.8.10;
import "../../../utils/SafeMath.sol";
import "../../../interfaces/dydx/ISoloMargin.sol";
import "../helpers/FLHelper.sol";

contract DydxFlashLoanBase is FLHelper {
    using SafeMath for uint256;

    error MarketIdNotFound();

    function _getMarketIdFromTokenAddress(address _solo, address _token)
        internal
        view
        returns (uint256 marketId)
    {
        ISoloMargin solo = ISoloMargin(_solo);

        uint256 numTokenIds = solo.getNumMarkets();

        for (uint256 i = 0; i < numTokenIds; i++) {
            if (solo.getMarketTokenAddress(i) == _token) {
                return i;
            }
        }

        // if we get this far no id has been found
        revert MarketIdNotFound();
    }

    function _getRepaymentAmountInternal(uint256 amount) internal pure returns (uint256) {
        // Needs to provide +2 wei to be safe
        return amount.add(2);
    }

    function _getAccountInfo() internal view returns (Account.Info memory) {
        return Account.Info({owner: address(this), number: 1});
    }

    function _getWithdrawAction(
        uint256 marketId,
        uint256 amount,
        address contractAddr
    ) internal pure returns (Actions.ActionArgs memory) {
        return
            Actions.ActionArgs({
                actionType: Actions.ActionType.Withdraw,
                accountId: 0,
                amount: Types.AssetAmount({
                    sign: false,
                    denomination: Types.AssetDenomination.Wei,
                    ref: Types.AssetReference.Delta,
                    value: amount
                }),
                primaryMarketId: marketId,
                secondaryMarketId: 0,
                otherAddress: contractAddr,
                otherAccountId: 0,
                data: ""
            });
    }

    function _getCallAction(bytes memory data, address contractAddr)
        internal
        pure
        returns (Actions.ActionArgs memory)
    {
        return
            Actions.ActionArgs({
                actionType: Actions.ActionType.Call,
                accountId: 0,
                amount: Types.AssetAmount({
                    sign: false,
                    denomination: Types.AssetDenomination.Wei,
                    ref: Types.AssetReference.Delta,
                    value: 0
                }),
                primaryMarketId: 0,
                secondaryMarketId: 0,
                otherAddress: contractAddr,
                otherAccountId: 0,
                data: data
            });
    }

    function _getDepositAction(
        uint256 marketId,
        uint256 amount,
        address contractAddr
    ) internal pure returns (Actions.ActionArgs memory) {
        return
            Actions.ActionArgs({
                actionType: Actions.ActionType.Deposit,
                accountId: 0,
                amount: Types.AssetAmount({
                    sign: true,
                    denomination: Types.AssetDenomination.Wei,
                    ref: Types.AssetReference.Delta,
                    value: amount
                }),
                primaryMarketId: marketId,
                secondaryMarketId: 0,
                otherAddress: contractAddr,
                otherAccountId: 0,
                data: ""
            });
    }
}
