// SPDX-License-Identifier: MIT

pragma solidity =0.8.10;
pragma experimental ABIEncoderV2;

import "../../utils/SafeERC20.sol";
import "../../DS/DSMath.sol";
import "../../auth/AdminAuth.sol";
import "../DFSExchangeHelper.sol";
import "../../interfaces/exchange/IOffchainWrapper.sol";

/// @title Wrapper contract which will be used if offchain exchange used is Paraswap
contract ParaswapWrapper is IOffchainWrapper, DFSExchangeHelper, AdminAuth, DSMath {

    using TokenUtils for address;

    string public constant ERR_SRC_AMOUNT = "Not enough funds";
    string public constant ERR_PROTOCOL_FEE = "Not enough eth for protocol fee";
    string public constant ERR_TOKENS_SWAPPED_ZERO = "Order success but amount 0";

    using SafeERC20 for IERC20;

    /// @notice offchainData.callData should be this struct encoded
    struct ParaswapCalldata{
        bytes realCalldata;
        uint256 offset;
    }

    /// @notice Takes order from Paraswap and returns bool indicating if it is successful
    /// @param _exData Exchange data
    /// @param _type Action type (buy or sell)
    function takeOrder(
        ExchangeData memory _exData,
        ExchangeActionType _type
    ) override public payable returns (bool success, uint256) {
        // check that contract have enough balance for exchange
        require(_exData.srcAddr.getBalance(address(this)) >= _exData.srcAmount, ERR_SRC_AMOUNT);

        IERC20(_exData.srcAddr).safeApprove(_exData.offchainData.allowanceTarget, _exData.srcAmount);

        ParaswapCalldata memory paraswapCalldata = abi.decode(_exData.offchainData.callData, (ParaswapCalldata));
        // write in the exact amount we are selling/buying in an order
        if (_type == ExchangeActionType.SELL) {
            writeUint256(paraswapCalldata.realCalldata, paraswapCalldata.offset, _exData.srcAmount);
        } else {
            uint srcAmount = wdiv(_exData.destAmount, _exData.offchainData.price) + 1; // + 1 so we round up
            writeUint256(paraswapCalldata.realCalldata, paraswapCalldata.offset, srcAmount);
        }

        uint256 tokensBefore = _exData.destAddr.getBalance(address(this));
        (success, ) = _exData.offchainData.exchangeAddr.call{value: _exData.offchainData.protocolFee}(paraswapCalldata.realCalldata);
        uint256 tokensSwapped = 0;

        if (success) {
            // get the current balance of the swapped tokens
            tokensSwapped = sub(_exData.destAddr.getBalance(address(this)), tokensBefore);
            require(tokensSwapped > 0, ERR_TOKENS_SWAPPED_ZERO);
        }
        // returns all funds from src addr, dest addr and eth funds (protocol fee leftovers)
        sendLeftover(_exData.srcAddr, _exData.destAddr, payable(msg.sender));

        return (success, tokensSwapped);
    }

    // solhint-disable-next-line no-empty-blocks
    receive() external virtual payable {}
}
