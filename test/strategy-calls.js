/* eslint-disable max-len */
const dfs = require('@defisaver/sdk');
const hre = require('hardhat');

const { getAssetInfo } = require('@defisaver/tokens');

const {
    mUSD,
    imUSD,
    imUSDVault,
    AssetPair,
} = require('./utils-mstable');

const {
    formatExchangeObj,
    getGasUsed,
    calcGasToUSD,
    AVG_GAS_PRICE,
    placeHolderAddr,
    // MCD_MANAGER_ADDR,
    WETH_ADDRESS,
    DAI_ADDR,
    UNISWAP_WRAPPER,
    MAX_UINT128,
    nullAddress,
    rariDaiFundManager,
    rdptAddress,
    rariUsdcFundManager,
    rsptAddress,
    fetchAmountinUSDPrice,
    Float2BN,
    getLocalTokenPrice,
    BN2Float,
    USDC_ADDR,
    LUSD_ADDR,
    formatMockExchangeObj,
    MAX_UINT,
    addrs,
    network,
} = require('./utils');

const {
    MCD_MANAGER_ADDR,
} = require('./utils-mcd');

const { ADAPTER_ADDRESS } = require('./utils-reflexer');

const {
    getTroveInfo,
    findInsertPosition,
} = require('./utils-liquity');

const abiCoder = new hre.ethers.utils.AbiCoder();

// eslint-disable-next-line max-len
const callDcaStrategy = async (botAcc, strategyExecutor, subId, strategySub, srcToken, destToken, uniV3Fee) => {
    const triggerCallData = [];
    const actionsCallData = [];

    const sellAction = new dfs.actions.basic.SellAction(
        formatExchangeObj(
            srcToken,
            destToken,
            '0',
            addrs[network].UNISWAP_V3_WRAPPER,
            0,
            uniV3Fee,
        ),
        placeHolderAddr,
        placeHolderAddr,
    );

    const gasCost = 500_000;
    let feeTakingAction = new dfs.actions.basic.GasFeeAction(
        gasCost, placeHolderAddr, '0',
    );

    if (network !== 'mainnet') {
        feeTakingAction = new dfs.actions.basic.GasFeeActionL2(
            gasCost, placeHolderAddr, '0', '0',
        );
    }

    const sendTokenAction = new dfs.actions.basic.SendTokenAndUnwrapAction(
        placeHolderAddr, placeHolderAddr, 0,
    );

    triggerCallData.push(abiCoder.encode(['uint256'], ['0']));

    actionsCallData.push(sellAction.encodeForRecipe()[0]);
    actionsCallData.push(feeTakingAction.encodeForRecipe()[0]);
    actionsCallData.push(sendTokenAction.encodeForRecipe()[0]);

    const strategyExecutorByBot = strategyExecutor.connect(botAcc);

    let receipt;

    if (network === 'mainnet') {
    // eslint-disable-next-line max-len
        receipt = await strategyExecutorByBot.executeStrategy(subId, 0, triggerCallData, actionsCallData, strategySub, {
            gasLimit: 8000000,
        });
    } else {
        // eslint-disable-next-line max-len
        receipt = await strategyExecutorByBot.executeStrategy(subId, 0, triggerCallData, actionsCallData, {
            gasLimit: 8000000,
        });
    }

    const gasUsed = await getGasUsed(receipt);
    const dollarPrice = calcGasToUSD(gasUsed, AVG_GAS_PRICE);

    console.log(`GasUsed callDcaStrategy: ${gasUsed}, price at ${AVG_GAS_PRICE} gwei $${dollarPrice}`);
};

// eslint-disable-next-line max-len
const callUniV3RangeOrderStrategy = async (botAcc, strategyExecutor, subId, strategySub, liquidity, recipient, nftOwner) => {
    const triggerCallData = [];
    const actionsCallData = [];

    const deadline = Date.now() + Date.now();
    const withdrawAction = new dfs.actions.uniswapV3.UniswapV3WithdrawAction(
        '0',
        liquidity,
        0,
        0,
        deadline,
        recipient,
        MAX_UINT128,
        MAX_UINT128,
        nftOwner,
    );
    triggerCallData.push(abiCoder.encode(['uint256'], ['0']));

    actionsCallData.push(withdrawAction.encodeForRecipe()[0]);

    const strategyExecutorByBot = strategyExecutor.connect(botAcc);
    const strategyIndex = 0;
    // eslint-disable-next-line max-len
    const receipt = await strategyExecutorByBot.executeStrategy(subId, strategyIndex, triggerCallData, actionsCallData, strategySub, {
        gasLimit: 8000000,
    });

    const gasUsed = await getGasUsed(receipt);
    const dollarPrice = calcGasToUSD(gasUsed, AVG_GAS_PRICE);

    console.log(`GasUsed callUniV3RangeOrderStrategy: ${gasUsed}, price at ${AVG_GAS_PRICE} gwei $${dollarPrice}`);
};

// eslint-disable-next-line max-len
const callUniV3CollectStrategy = async (botAcc, strategyExecutor, subId, strategySub, nftOwner) => {
    const triggerCallData = [];
    const actionsCallData = [];

    const collectAction = new dfs.actions.uniswapV3.UniswapV3CollectAction(
        '0',
        placeHolderAddr,
        MAX_UINT128,
        MAX_UINT128,
        nftOwner,
    );

    triggerCallData.push(abiCoder.encode(['uint256'], ['0']));
    triggerCallData.push(abiCoder.encode(['uint256'], ['0']));
    actionsCallData.push(collectAction.encodeForRecipe()[0]);

    const strategyExecutorByBot = strategyExecutor.connect(botAcc);
    const strategyIndex = 0;
    // eslint-disable-next-line max-len
    const receipt = await strategyExecutorByBot.executeStrategy(subId, strategyIndex, triggerCallData, actionsCallData, strategySub, {
        gasLimit: 8000000,
        gasPrice: hre.ethers.utils.parseUnits('10', 'gwei'),
    });

    const gasUsed = await getGasUsed(receipt);
    const dollarPrice = calcGasToUSD(gasUsed, AVG_GAS_PRICE);

    console.log(`GasUsed callUniV3CollectStrategy: ${gasUsed}, price at ${AVG_GAS_PRICE} gwei $${dollarPrice}`);
};

const callMcdRepayFromYearnWithExchangeStrategy = async (botAcc, strategyExecutor, strategyIndex, subId, strategySub, yWethAddr, repayAmount) => {
    const triggerCallData = [];
    const actionsCallData = [];

    const withdrawAction = new dfs.actions.yearn.YearnWithdrawAction(
        yWethAddr,
        repayAmount,
        placeHolderAddr,
        placeHolderAddr,
    );

    // sell action
    const sellAction = new dfs.actions.basic.SellAction(
        formatExchangeObj(
            WETH_ADDRESS,
            DAI_ADDR,
            '0',
            UNISWAP_WRAPPER,
        ),
        placeHolderAddr,
        placeHolderAddr,
    );

    const repayGasCost = 1200000; // 1.2 mil gas
    const feeTakingAction = new dfs.actions.basic.GasFeeAction(
        repayGasCost, DAI_ADDR, 0,
    );

    const mcdPaybackAction = new dfs.actions.maker.MakerPaybackAction(
        0,
        0,
        placeHolderAddr,
        MCD_MANAGER_ADDR,
    );

    actionsCallData.push(withdrawAction.encodeForRecipe()[0]);
    actionsCallData.push(sellAction.encodeForRecipe()[0]);
    actionsCallData.push(feeTakingAction.encodeForRecipe()[0]);
    actionsCallData.push(mcdPaybackAction.encodeForRecipe()[0]);

    const nextPrice = 0;
    triggerCallData.push(abiCoder.encode(['uint256', 'uint8'], [nextPrice, '0']));

    const strategyExecutorByBot = strategyExecutor.connect(botAcc);
    // eslint-disable-next-line max-len
    const receipt = await strategyExecutorByBot.executeStrategy(subId, strategyIndex, triggerCallData, actionsCallData, strategySub, {
        gasLimit: 8000000,
    });

    const gasUsed = await getGasUsed(receipt);
    const dollarPrice = calcGasToUSD(gasUsed, AVG_GAS_PRICE);

    console.log(`GasUsed callMcdRepayStrategy: ${gasUsed}, price at ${AVG_GAS_PRICE} gwei $${dollarPrice}`);
};

const callMcdRepayFromYearnStrategy = async (botAcc, strategyExecutor, strategyIndex, subId, strategySub, yDaiAddr, repayAmount) => {
    const triggerCallData = [];
    const actionsCallData = [];

    const withdrawAction = new dfs.actions.yearn.YearnWithdrawAction(
        yDaiAddr,
        repayAmount,
        placeHolderAddr,
        placeHolderAddr,
    );
    const repayGasCost = 1200000; // 1.2 mil gas
    const feeTakingAction = new dfs.actions.basic.GasFeeAction(
        repayGasCost, DAI_ADDR, 0,
    );

    const mcdPaybackAction = new dfs.actions.maker.MakerPaybackAction(
        0,
        0,
        placeHolderAddr,
        MCD_MANAGER_ADDR,
    );

    actionsCallData.push(withdrawAction.encodeForRecipe()[0]);
    actionsCallData.push(feeTakingAction.encodeForRecipe()[0]);
    actionsCallData.push(mcdPaybackAction.encodeForRecipe()[0]);

    const nextPrice = 0;
    triggerCallData.push(abiCoder.encode(['uint256', 'uint8'], [nextPrice, '0']));

    const strategyExecutorByBot = strategyExecutor.connect(botAcc);
    // eslint-disable-next-line max-len
    const receipt = await strategyExecutorByBot.executeStrategy(subId, strategyIndex, triggerCallData, actionsCallData, strategySub, {
        gasLimit: 8000000,
    });

    const gasUsed = await getGasUsed(receipt);
    const dollarPrice = calcGasToUSD(gasUsed, AVG_GAS_PRICE);

    console.log(`GasUsed callMcdRepayStrategy: ${gasUsed}, price at ${AVG_GAS_PRICE} gwei $${dollarPrice}`);
};

const callMcdRepayFromMstableStrategy = async (botAcc, strategyExecutor, strategyIndex, subId, strategySub, repayAmount) => {
    const triggerCallData = [];
    const actionsCallData = [];

    const mStableActionWithdraw = new dfs.actions.mstable.MStableWithdrawAction(
        DAI_ADDR,
        mUSD,
        imUSD,
        imUSDVault,
        placeHolderAddr, // from
        placeHolderAddr, // to
        repayAmount,
        0, // minOut
        AssetPair.BASSET_IMASSETVAULT,
    );

    const repayGasCost = 1200000; // 1.2 mil gas
    const feeTakingAction = new dfs.actions.basic.GasFeeAction(
        repayGasCost, DAI_ADDR, 0,
    );

    const mcdPaybackAction = new dfs.actions.maker.MakerPaybackAction(
        0,
        0,
        placeHolderAddr,
        MCD_MANAGER_ADDR,
    );

    actionsCallData.push(mStableActionWithdraw.encodeForRecipe()[0]);
    actionsCallData.push(feeTakingAction.encodeForRecipe()[0]);
    actionsCallData.push(mcdPaybackAction.encodeForRecipe()[0]);

    const nextPrice = 0;
    triggerCallData.push(abiCoder.encode(['uint256', 'uint8'], [nextPrice, '0']));

    const strategyExecutorByBot = strategyExecutor.connect(botAcc);

    // eslint-disable-next-line max-len
    const receipt = await strategyExecutorByBot.executeStrategy(subId, strategyIndex, triggerCallData, actionsCallData, strategySub, {
        gasLimit: 8000000,
    });

    const gasUsed = await getGasUsed(receipt);
    const dollarPrice = calcGasToUSD(gasUsed, AVG_GAS_PRICE);

    console.log(`GasUsed callMcdRepayStrategy: ${gasUsed}, price at ${AVG_GAS_PRICE} gwei $${dollarPrice}`);
};

const callMcdRepayFromMstableWithExchangeStrategy = async (botAcc, strategyExecutor, strategyIndex, subId, strategySub, repayAmount) => {
    const triggerCallData = [];
    const actionsCallData = [];

    const mStableActionWithdraw = new dfs.actions.mstable.MStableWithdrawAction(
        USDC_ADDR,
        mUSD,
        imUSD,
        imUSDVault,
        placeHolderAddr, // from
        placeHolderAddr, // to
        repayAmount,
        0, // minOut
        AssetPair.BASSET_IMASSETVAULT,
    );

    // sell action
    const sellAction = new dfs.actions.basic.SellAction(
        formatExchangeObj(
            USDC_ADDR,
            DAI_ADDR,
            '0',
            UNISWAP_WRAPPER,
        ),
        placeHolderAddr,
        placeHolderAddr,
    );

    const repayGasCost = 1200000; // 1.2 mil gas
    const feeTakingAction = new dfs.actions.basic.GasFeeAction(
        repayGasCost, DAI_ADDR, 0,
    );

    const mcdPaybackAction = new dfs.actions.maker.MakerPaybackAction(
        0,
        0,
        placeHolderAddr,
        MCD_MANAGER_ADDR,
    );

    actionsCallData.push(mStableActionWithdraw.encodeForRecipe()[0]);
    actionsCallData.push(sellAction.encodeForRecipe()[0]);
    actionsCallData.push(feeTakingAction.encodeForRecipe()[0]);
    actionsCallData.push(mcdPaybackAction.encodeForRecipe()[0]);

    const nextPrice = 0;
    triggerCallData.push(abiCoder.encode(['uint256', 'uint8'], [nextPrice, '0']));

    const strategyExecutorByBot = strategyExecutor.connect(botAcc);

    // eslint-disable-next-line max-len
    const receipt = await strategyExecutorByBot.executeStrategy(subId, strategyIndex, triggerCallData, actionsCallData, strategySub, {
        gasLimit: 8000000,
    });

    const gasUsed = await getGasUsed(receipt);
    const dollarPrice = calcGasToUSD(gasUsed, AVG_GAS_PRICE);

    console.log(`GasUsed callMcdRepayStrategy: ${gasUsed}, price at ${AVG_GAS_PRICE} gwei $${dollarPrice}`);
};

const callMcdRepayFromRariStrategyWithExchange = async (botAcc, strategyExecutor, strategyIndex, subId, strategySub, poolAmount, repayAmount) => {
    const triggerCallData = [];
    const actionsCallData = [];

    const rariWithdrawAction = new dfs.actions.rari.RariWithdrawAction(
        rariUsdcFundManager,
        rsptAddress,
        poolAmount,
        placeHolderAddr,
        USDC_ADDR,
        repayAmount,
        placeHolderAddr,
    );

    const sellAction = new dfs.actions.basic.SellAction(
        formatExchangeObj(
            USDC_ADDR,
            DAI_ADDR,
            '0',
            UNISWAP_WRAPPER,
        ),
        placeHolderAddr,
        placeHolderAddr,
    );

    const repayGasCost = 1200000; // 1.2 mil gas
    const feeTakingAction = new dfs.actions.basic.GasFeeAction(
        repayGasCost, DAI_ADDR, 0,
    );

    const mcdPaybackAction = new dfs.actions.maker.MakerPaybackAction(
        0,
        0,
        placeHolderAddr,
        MCD_MANAGER_ADDR,
    );

    actionsCallData.push(rariWithdrawAction.encodeForRecipe()[0]);
    actionsCallData.push(sellAction.encodeForRecipe()[0]);
    actionsCallData.push(feeTakingAction.encodeForRecipe()[0]);
    actionsCallData.push(mcdPaybackAction.encodeForRecipe()[0]);

    const nextPrice = 0;
    triggerCallData.push(abiCoder.encode(['uint256', 'uint8'], [nextPrice, '0']));

    const strategyExecutorByBot = strategyExecutor.connect(botAcc);
    // eslint-disable-next-line max-len
    const receipt = await strategyExecutorByBot.executeStrategy(subId, strategyIndex, triggerCallData, actionsCallData, strategySub, {
        gasLimit: 8000000,
    });

    const gasUsed = await getGasUsed(receipt);
    const dollarPrice = calcGasToUSD(gasUsed, AVG_GAS_PRICE);

    console.log(`GasUsed callMcdRepayStrategy: ${gasUsed}, price at ${AVG_GAS_PRICE} gwei $${dollarPrice}`);
};

const callMcdRepayFromRariStrategy = async (botAcc, strategyExecutor, strategyIndex, subId, strategySub, poolAmount, repayAmount) => {
    const triggerCallData = [];
    const actionsCallData = [];

    const rariWithdrawAction = new dfs.actions.rari.RariWithdrawAction(
        rariDaiFundManager,
        rdptAddress,
        poolAmount,
        placeHolderAddr,
        DAI_ADDR,
        repayAmount,
        placeHolderAddr,
    );

    const repayGasCost = 1200000; // 1.2 mil gas
    const feeTakingAction = new dfs.actions.basic.GasFeeAction(
        repayGasCost, DAI_ADDR, 0,
    );

    const mcdPaybackAction = new dfs.actions.maker.MakerPaybackAction(
        0,
        0,
        placeHolderAddr,
        MCD_MANAGER_ADDR,
    );

    actionsCallData.push(rariWithdrawAction.encodeForRecipe()[0]);
    actionsCallData.push(feeTakingAction.encodeForRecipe()[0]);
    actionsCallData.push(mcdPaybackAction.encodeForRecipe()[0]);

    const nextPrice = 0;
    triggerCallData.push(abiCoder.encode(['uint256', 'uint8'], [nextPrice, '0']));

    const strategyExecutorByBot = strategyExecutor.connect(botAcc);
    // eslint-disable-next-line max-len
    const receipt = await strategyExecutorByBot.executeStrategy(subId, strategyIndex, triggerCallData, actionsCallData, strategySub, {
        gasLimit: 8000000,
    });

    const gasUsed = await getGasUsed(receipt);
    const dollarPrice = calcGasToUSD(gasUsed, AVG_GAS_PRICE);

    console.log(`GasUsed callMcdRepayStrategy: ${gasUsed}, price at ${AVG_GAS_PRICE} gwei $${dollarPrice}`);
};

// eslint-disable-next-line max-len
const callMcdRepayStrategy = async (botAcc, strategyExecutor, strategyIndex, subId, strategySub, joinAddr, collAsset, repayAmount) => {
    const triggerCallData = [];
    const actionsCallData = [];

    const ratioAction = new dfs.actions.maker.MakerRatioAction(
        '0',
    );

    const withdrawAction = new dfs.actions.maker.MakerWithdrawAction(
        '0',
        repayAmount,
        joinAddr,
        placeHolderAddr,
        MCD_MANAGER_ADDR,
    );

    const repayGasCost = 1200000; // 1.2 mil gas
    const feeTakingAction = new dfs.actions.basic.GasFeeAction(
        repayGasCost, collAsset.address, '0',
    );

    const sellAction = new dfs.actions.basic.SellAction(
        await formatMockExchangeObj(
            collAsset,
            getAssetInfo('DAI'),
            '0',
        ),
        placeHolderAddr,
        placeHolderAddr,
    );

    const mcdPaybackAction = new dfs.actions.maker.MakerPaybackAction(
        '0', // vaultId
        '0', // amount
        placeHolderAddr, // proxy
        MCD_MANAGER_ADDR,
    );

    const mcdRatioCheckAction = new dfs.actions.checkers.MakerRatioCheckAction(
        '1', // ratioState - SHOULD_BE_HIGHER
        false, // if exact triggerRatio should be checked
        '0', // targetRatio
        '0', // vaultId
        '0', // returnValueIndex
    );

    actionsCallData.push(ratioAction.encodeForRecipe()[0]);
    actionsCallData.push(withdrawAction.encodeForRecipe()[0]);
    actionsCallData.push(feeTakingAction.encodeForRecipe()[0]);
    actionsCallData.push(sellAction.encodeForRecipe()[0]);
    actionsCallData.push(mcdPaybackAction.encodeForRecipe()[0]);
    actionsCallData.push(mcdRatioCheckAction.encodeForRecipe()[0]);

    const nextPrice = 0;
    triggerCallData.push(abiCoder.encode(['uint256', 'uint8'], [nextPrice, '0']));

    const strategyExecutorByBot = strategyExecutor.connect(botAcc);
    // eslint-disable-next-line max-len
    const receipt = await strategyExecutorByBot.executeStrategy(subId, strategyIndex, triggerCallData, actionsCallData, strategySub, {
        gasLimit: 8000000,
    });

    const gasUsed = await getGasUsed(receipt);
    const dollarPrice = calcGasToUSD(gasUsed, AVG_GAS_PRICE);

    console.log(`GasUsed callMcdRepayStrategy: ${gasUsed}, price at ${AVG_GAS_PRICE} gwei $${dollarPrice}`);
};

// eslint-disable-next-line max-len
const callFLMcdRepayStrategy = async (botAcc, strategyExecutor, strategyIndex, subId, strategySub, flAddr, joinAddr, collAsset, repayAmount) => {
    const triggerCallData = [];
    const actionsCallData = [];

    const flAction = new dfs.actions.flashloan.BalancerFlashLoanAction([collAsset.address], [repayAmount]);

    const ratioAction = new dfs.actions.maker.MakerRatioAction(
        '0',
    );

    const sellAction = new dfs.actions.basic.SellAction(
        await formatMockExchangeObj(
            collAsset,
            getAssetInfo('DAI'),
            '0',
        ),
        placeHolderAddr,
        placeHolderAddr,
    );

    const repayGasCost = 1200000; // 1.2 mil gas
    const feeTakingAction = new dfs.actions.basic.GasFeeAction(
        repayGasCost, DAI_ADDR, '0',
    );

    const mcdPaybackAction = new dfs.actions.maker.MakerPaybackAction(
        '0', // vaultId
        '0', // amount
        placeHolderAddr, // proxy
        MCD_MANAGER_ADDR,
    );

    const withdrawAction = new dfs.actions.maker.MakerWithdrawAction(
        '0',
        repayAmount,
        joinAddr,
        flAddr,
        MCD_MANAGER_ADDR,
    );

    const mcdRatioCheckAction = new dfs.actions.checkers.MakerRatioCheckAction(
        '1', // ratioState - SHOULD_BE_HIGHER
        false, // if exact triggerRatio should be checked
        '0', // targetRatio
        '0', // vaultId
        '1', // returnValueIndex
    );

    actionsCallData.push(flAction.encodeForRecipe()[0]);
    actionsCallData.push(ratioAction.encodeForRecipe()[0]);
    actionsCallData.push(sellAction.encodeForRecipe()[0]);
    actionsCallData.push(feeTakingAction.encodeForRecipe()[0]);
    actionsCallData.push(mcdPaybackAction.encodeForRecipe()[0]);
    actionsCallData.push(withdrawAction.encodeForRecipe()[0]);
    actionsCallData.push(mcdRatioCheckAction.encodeForRecipe()[0]);

    // const nextPrice = await getNextEthPrice();
    const nextPrice = 0;

    triggerCallData.push(abiCoder.encode(['uint256', 'uint8'], [nextPrice, '0']));

    const strategyExecutorByBot = strategyExecutor.connect(botAcc);
    // eslint-disable-next-line max-len
    const receipt = await strategyExecutorByBot.executeStrategy(subId, strategyIndex, triggerCallData, actionsCallData, strategySub, {
        gasLimit: 8000000,
    });

    const gasUsed = await getGasUsed(receipt);
    const dollarPrice = calcGasToUSD(gasUsed, AVG_GAS_PRICE);

    console.log(`GasUsed callFLMcdRepayStrategy: ${gasUsed}, price at ${AVG_GAS_PRICE} gwei $${dollarPrice}`);
};

const callMcdRepayCompositeStrategy = async (botAcc, strategyExecutor, strategyIndex, subId, strategySub, joinAddr, collAsset, repayAmount) => {
    const triggerCallData = [];
    const actionsCallData = [];

    const repayGasCost = 800000; // .8 mil gas

    const repayCompositeAction = new dfs.actions.maker.MakerRepayCompositeAction(
        '0', // '&vaultId'
        joinAddr,
        repayGasCost,
        nullAddress,
        0,
        0,
        0,
        await formatMockExchangeObj(
            collAsset,
            getAssetInfo('DAI'),
            repayAmount,
        ),
    );

    actionsCallData.push(repayCompositeAction.encodeForRecipe()[0]);
    triggerCallData.push(abiCoder.encode(['uint256', 'uint8'], ['0', '0']));

    const strategyExecutorByBot = strategyExecutor.connect(botAcc);
    // eslint-disable-next-line max-len
    const receipt = await strategyExecutorByBot.executeStrategy(subId, strategyIndex, triggerCallData, actionsCallData, strategySub, {
        gasLimit: 8000000,
    });

    const gasUsed = await getGasUsed(receipt);
    const dollarPrice = calcGasToUSD(gasUsed, AVG_GAS_PRICE);

    console.log(`GasUsed callMcdRepayCompositeStrategy: ${gasUsed}, price at ${AVG_GAS_PRICE} gwei $${dollarPrice}`);
};

const callMcdFLRepayCompositeStrategy = async (botAcc, strategyExecutor, strategyIndex, subId, strategySub, joinAddr, collAsset, repayAmount, flAddr) => {
    const triggerCallData = [];
    const actionsCallData = [];

    const repayGasCost = 800000; // .8 mil gas

    let flashLoanAction = new dfs.actions.flashloan.BalancerFlashLoanAction(
        [collAsset.address],
        [repayAmount],
        nullAddress,
        [],
    );

    flashLoanAction = new dfs.actions.flashloan.FLAction(flashLoanAction);

    const repayCompositeAction = new dfs.actions.maker.MakerRepayCompositeAction(
        '0', // '&vaultId'
        joinAddr,
        repayGasCost,
        flAddr,
        0,
        0,
        0,
        await formatMockExchangeObj(
            collAsset,
            getAssetInfo('DAI'),
            repayAmount,
        ),
    );

    actionsCallData.push(flashLoanAction.encodeForRecipe()[0]);
    actionsCallData.push(repayCompositeAction.encodeForRecipe()[0]);
    triggerCallData.push(abiCoder.encode(['uint256', 'uint8'], ['0', '0']));

    const strategyExecutorByBot = strategyExecutor.connect(botAcc);
    // eslint-disable-next-line max-len
    const receipt = await strategyExecutorByBot.executeStrategy(subId, strategyIndex, triggerCallData, actionsCallData, strategySub, {
        gasLimit: 8000000,
    });

    const gasUsed = await getGasUsed(receipt);
    const dollarPrice = calcGasToUSD(gasUsed, AVG_GAS_PRICE);

    console.log(`GasUsed callMcdFLRepayCompositeStrategy: ${gasUsed}, price at ${AVG_GAS_PRICE} gwei $${dollarPrice}`);
};

const callMcdBoostCompositeStrategy = async (botAcc, strategyExecutor, strategyIndex, subId, strategySub, joinAddr, collAsset, boostAmount) => {
    const triggerCallData = [];
    const actionsCallData = [];

    const boostGasCost = 800000; // .8 mil gas

    const boostCompositeAction = new dfs.actions.maker.MakerBoostCompositeAction(
        '0', // &vaultId
        joinAddr,
        boostGasCost,
        nullAddress,
        0,
        0,
        0,
        await formatMockExchangeObj(
            getAssetInfo('DAI'),
            collAsset,
            boostAmount,
        ),
    );

    actionsCallData.push(boostCompositeAction.encodeForRecipe()[0]);

    triggerCallData.push(abiCoder.encode(['uint256', 'uint8'], ['0', '0']));

    const strategyExecutorByBot = strategyExecutor.connect(botAcc);
    // eslint-disable-next-line max-len
    const receipt = await strategyExecutorByBot.executeStrategy(subId, strategyIndex, triggerCallData, actionsCallData, strategySub, {
        gasLimit: 8000000,
    });

    const gasUsed = await getGasUsed(receipt);
    const dollarPrice = calcGasToUSD(gasUsed, AVG_GAS_PRICE);

    console.log(`GasUsed callMcdBoostCompositeStrategy: ${gasUsed}, price at ${AVG_GAS_PRICE} gwei $${dollarPrice}`);
};

const callMcdFLBoostCompositeStrategy = async (botAcc, strategyExecutor, strategyIndex, subId, strategySub, joinAddr, collAsset, boostAmount, flAddr) => {
    const triggerCallData = [];
    const actionsCallData = [];

    const boostGasCost = 800000; // .8 mil gas

    let flashLoanAction = new dfs.actions.flashloan.MakerFlashLoanAction(
        boostAmount,
        nullAddress,
        [],
    );

    flashLoanAction = new dfs.actions.flashloan.FLAction(flashLoanAction);

    const boostCompositeAction = new dfs.actions.maker.MakerBoostCompositeAction(
        '0', // &vaultId
        joinAddr,
        boostGasCost,
        flAddr,
        0, // flAmount is injected
        0,
        0,
        await formatMockExchangeObj(
            getAssetInfo('DAI'),
            collAsset,
            boostAmount,
        ),
    );

    actionsCallData.push(flashLoanAction.encodeForRecipe()[0]);
    actionsCallData.push(boostCompositeAction.encodeForRecipe()[0]);

    triggerCallData.push(abiCoder.encode(['uint256', 'uint8'], ['0', '0']));

    const strategyExecutorByBot = strategyExecutor.connect(botAcc);
    // eslint-disable-next-line max-len
    const receipt = await strategyExecutorByBot.executeStrategy(subId, strategyIndex, triggerCallData, actionsCallData, strategySub, {
        gasLimit: 8000000,
    });

    const gasUsed = await getGasUsed(receipt);
    const dollarPrice = calcGasToUSD(gasUsed, AVG_GAS_PRICE);

    console.log(`GasUsed callMcdFLBoostCompositeStrategy: ${gasUsed}, price at ${AVG_GAS_PRICE} gwei $${dollarPrice}`);
};

// eslint-disable-next-line max-len
const callMcdBoostStrategy = async (botAcc, strategyExecutor, strategyIndex, subId, strategySub, joinAddr, collAsset, boostAmount) => {
    const triggerCallData = [];
    const actionsCallData = [];

    const ratioAction = new dfs.actions.maker.MakerRatioAction(
        '0',
    );

    const generateAction = new dfs.actions.maker.MakerGenerateAction(
        '0',
        boostAmount,
        placeHolderAddr,
        MCD_MANAGER_ADDR,
    );

    const sellAction = new dfs.actions.basic.SellAction(
        await formatMockExchangeObj(
            getAssetInfo('DAI'),
            collAsset,
            '0',
        ),
        placeHolderAddr,
        placeHolderAddr,
    );

    const boostGasCost = 1200000; // 1.2 mil gas
    const feeTakingAction = new dfs.actions.basic.GasFeeAction(
        boostGasCost, collAsset.address, '0',
    );

    const mcdSupplyAction = new dfs.actions.maker.MakerSupplyAction(
        '0', // vaultId
        '0', // amount
        joinAddr,
        placeHolderAddr, // proxy
        MCD_MANAGER_ADDR,
    );

    const mcdRatioCheckAction = new dfs.actions.checkers.MakerRatioCheckAction(
        '0', // ratioState - SHOULD_BE_LOWER
        false,
        '0', // targetRatio
        '0', // vaultId
        '0', // returnValueIndex
    );

    actionsCallData.push(ratioAction.encodeForRecipe()[0]);
    actionsCallData.push(generateAction.encodeForRecipe()[0]);
    actionsCallData.push(sellAction.encodeForRecipe()[0]);
    actionsCallData.push(feeTakingAction.encodeForRecipe()[0]);
    actionsCallData.push(mcdSupplyAction.encodeForRecipe()[0]);
    actionsCallData.push(mcdRatioCheckAction.encodeForRecipe()[0]);

    triggerCallData.push(abiCoder.encode(['uint256', 'uint8'], ['0', '0']));

    const strategyExecutorByBot = strategyExecutor.connect(botAcc);
    // eslint-disable-next-line max-len
    const receipt = await strategyExecutorByBot.executeStrategy(subId, strategyIndex, triggerCallData, actionsCallData, strategySub, {
        gasLimit: 8000000,
    });

    const gasUsed = await getGasUsed(receipt);
    const dollarPrice = calcGasToUSD(gasUsed, AVG_GAS_PRICE);

    console.log(`GasUsed callMcdBoostStrategy: ${gasUsed}, price at ${AVG_GAS_PRICE} gwei $${dollarPrice}`);
};

// eslint-disable-next-line max-len
const callFLMcdBoostStrategy = async (botAcc, strategyExecutor, strategyIndex, subId, strategySub, flLoanAddr, joinAddr, collAsset, boostAmount) => {
    const triggerCallData = [];
    const actionsCallData = [];

    // const flAction = new dfs.actions.flashloan.DyDxFlashLoanAction(boostAmount, DAI_ADDR);
    const flAction = new dfs.actions.flashloan.BalancerFlashLoanAction([DAI_ADDR], [boostAmount]);

    const ratioAction = new dfs.actions.maker.MakerRatioAction(
        '0',
    );

    const sellAction = new dfs.actions.basic.SellAction(
        await formatMockExchangeObj(
            getAssetInfo('DAI'),
            collAsset,
            '0',
        ),
        placeHolderAddr,
        placeHolderAddr,
    );

    const boostGasCost = 1200000; // 1.2 mil gas
    const feeTakingAction = new dfs.actions.basic.GasFeeAction(
        boostGasCost, collAsset.address, '0',
    );

    const mcdSupplyAction = new dfs.actions.maker.MakerSupplyAction(
        '0', // vaultId
        '0', // amount
        joinAddr,
        placeHolderAddr, // proxy
        MCD_MANAGER_ADDR,
    );

    const generateAction = new dfs.actions.maker.MakerGenerateAction(
        '0', // vaultId
        '0', // amount
        flLoanAddr,
        MCD_MANAGER_ADDR,
    );

    const mcdRatioCheckAction = new dfs.actions.checkers.MakerRatioCheckAction(
        '0', // ratioState - SHOULD_BE_LOWER
        false, // if exact triggerRatio should be checked
        '0', // targetRatio
        '0', // vaultId
        '1', // returnValueIndex
    );

    actionsCallData.push(flAction.encodeForRecipe()[0]);
    actionsCallData.push(ratioAction.encodeForRecipe()[0]);
    actionsCallData.push(sellAction.encodeForRecipe()[0]);
    actionsCallData.push(feeTakingAction.encodeForRecipe()[0]);
    actionsCallData.push(mcdSupplyAction.encodeForRecipe()[0]);
    actionsCallData.push(generateAction.encodeForRecipe()[0]);
    actionsCallData.push(mcdRatioCheckAction.encodeForRecipe()[0]);

    triggerCallData.push(abiCoder.encode(['uint256', 'uint8'], ['0', '0']));

    const strategyExecutorByBot = strategyExecutor.connect(botAcc);
    // eslint-disable-next-line max-len
    const receipt = await strategyExecutorByBot.executeStrategy(subId, strategyIndex, triggerCallData, actionsCallData, strategySub, {
        gasLimit: 8000000,
    });

    const gasUsed = await getGasUsed(receipt);
    const dollarPrice = calcGasToUSD(gasUsed, AVG_GAS_PRICE);

    console.log(`GasUsed callFLMcdBoostStrategy: ${gasUsed}, price at ${AVG_GAS_PRICE} gwei $${dollarPrice}`);
};

const callCompRepayStrategy = async (botAcc, strategyExecutor, subId, strategySub, repayAmount) => {
    const triggerCallData = [];
    const actionsCallData = [];

    const compWithdrawAction = new dfs.actions.compound.CompoundWithdrawAction(
        getAssetInfo('cETH').address,
        repayAmount,
        placeHolderAddr,
    );
    const repayGasCost = 1200000; // 1.2 mil gas
    const feeTakingAction = new dfs.actions.basic.GasFeeAction(
        repayGasCost, WETH_ADDRESS, '0',
    );
    const sellAction = new dfs.actions.basic.SellAction(
        formatExchangeObj(
            WETH_ADDRESS,
            DAI_ADDR,
            '0',
            UNISWAP_WRAPPER,
        ),
        placeHolderAddr,
        placeHolderAddr,
    );
    const paybackAction = new dfs.actions.compound.CompoundPaybackAction(
        getAssetInfo('cDAI').address,
        '1',
        placeHolderAddr,
    );

    actionsCallData.push(compWithdrawAction.encodeForRecipe()[0]);
    actionsCallData.push(feeTakingAction.encodeForRecipe()[0]);
    actionsCallData.push(sellAction.encodeForRecipe()[0]);
    actionsCallData.push(paybackAction.encodeForRecipe()[0]);

    triggerCallData.push(abiCoder.encode(['uint256'], ['0']));

    const strategyExecutorByBot = strategyExecutor.connect(botAcc);
    const strategyIndex = 0;
    // eslint-disable-next-line max-len
    const receipt = await strategyExecutorByBot.executeStrategy(subId, strategyIndex, triggerCallData, actionsCallData, strategySub, {
        gasLimit: 8000000,
    });

    const gasUsed = await getGasUsed(receipt);
    const dollarPrice = calcGasToUSD(gasUsed, AVG_GAS_PRICE);

    console.log(`GasUsed callCompRepayStrategy: ${gasUsed}, price at ${AVG_GAS_PRICE} gwei $${dollarPrice}`);
};

const callCompBoostStrategy = async (botAcc, strategyExecutor, subId, strategySub, boostAmount) => {
    const triggerCallData = [];
    const actionsCallData = [];

    const compBorrowAction = new dfs.actions.compound.CompoundBorrowAction(
        getAssetInfo('cDAI').address,
        boostAmount,
        placeHolderAddr,
    );
    const sellAction = new dfs.actions.basic.SellAction(
        formatExchangeObj(
            DAI_ADDR,
            WETH_ADDRESS,
            '0',
            UNISWAP_WRAPPER,
        ),
        placeHolderAddr,
        placeHolderAddr,
    );
    const boostGasCost = 1200000; // 1.2 mil gas
    const feeTakingAction = new dfs.actions.basic.GasFeeAction(
        boostGasCost, WETH_ADDRESS, '0',
    );
    const compSupplyAction = new dfs.actions.compound.CompoundSupplyAction(
        getAssetInfo('cETH').address,
        '$2',
        placeHolderAddr,
        true,
    );
    actionsCallData.push(compBorrowAction.encodeForRecipe()[0]);
    actionsCallData.push(sellAction.encodeForRecipe()[0]);
    actionsCallData.push(feeTakingAction.encodeForRecipe()[0]);
    actionsCallData.push(compSupplyAction.encodeForRecipe()[0]);

    triggerCallData.push(abiCoder.encode(['uint256'], ['0']));

    const strategyExecutorByBot = strategyExecutor.connect(botAcc);
    const strategyIndex = 0;

    // eslint-disable-next-line max-len
    const receipt = await strategyExecutorByBot.executeStrategy(subId, strategyIndex, triggerCallData, actionsCallData, strategySub, {
        gasLimit: 8000000,
    });

    const gasUsed = await getGasUsed(receipt);
    const dollarPrice = calcGasToUSD(gasUsed, AVG_GAS_PRICE);

    console.log(`GasUsed callCompBoostStrategy: ${gasUsed}, price at ${AVG_GAS_PRICE} gwei $${dollarPrice}`);
};

const callLimitOrderStrategy = async (
    botAcc,
    minPrice,
    strategyExecutor,
    subId,
    strategySub,
    tokenAddrSell,
    tokenAddrBuy,
    uniV3Fee,
) => {
    const actionsCallData = [];
    const triggerCallData = [];

    const txGasCost = 500000; // 500k gas
    const l1GasCost = 30000; // 30k gas (just an estimate should be dynamic)

    let sellAction = new dfs.actions.basic.LimitSellAction(
        formatExchangeObj(
            tokenAddrSell,
            tokenAddrBuy,
            '0',
            addrs[network].UNISWAP_V3_WRAPPER,
            0,
            uniV3Fee,
            minPrice.toString(),
        ),
        placeHolderAddr,
        placeHolderAddr,
        txGasCost,
    );

    if (network !== 'mainnet') {
        sellAction = new dfs.actions.basic.LimitSellActionL2(
            formatExchangeObj(
                tokenAddrSell,
                tokenAddrBuy,
                '0',
                addrs[network].UNISWAP_V3_WRAPPER,
                0,
                uniV3Fee,
                minPrice.toString(),
            ),
            placeHolderAddr,
            placeHolderAddr,
            txGasCost,
            l1GasCost,
        );
    }

    triggerCallData.push(abiCoder.encode(['uint256'], [minPrice.toString()]));
    actionsCallData.push(sellAction.encodeForRecipe()[0]);

    const strategyExecutorByBot = strategyExecutor.connect(botAcc);
    let receipt;
    if (network === 'mainnet') {
        // eslint-disable-next-line max-len
        receipt = await strategyExecutorByBot.executeStrategy(subId, 0, triggerCallData, actionsCallData, strategySub, {
            gasLimit: 8000000,
        });
    } else {
        // eslint-disable-next-line max-len
        receipt = await strategyExecutorByBot.executeStrategy(subId, 0, triggerCallData, actionsCallData, {
            gasLimit: 8000000,
        });
    }

    const gasUsed = await getGasUsed(receipt);
    const dollarPrice = calcGasToUSD(gasUsed, AVG_GAS_PRICE);

    console.log(`GasUsed callLimitOrderStrategy: ${gasUsed}, price at ${AVG_GAS_PRICE} gwei $${dollarPrice}`);
};

// eslint-disable-next-line max-len
const callMcdCloseToCollStrategy = async (
    proxy,
    botAcc,
    strategyExecutor,
    subId,
    strategySub,
    flAmount,
    sellAmount,
    ethJoin,
    makerFlAddr,
    isTrailing = false,
    roundId = 0,
) => {
    const actionsCallData = [];
    const flashLoanAction = new dfs.actions.flashloan.MakerFlashLoanAction(
        flAmount,
        nullAddress,
        [],
    );
    const paybackAction = new dfs.actions.maker.MakerPaybackAction(
        '0',
        hre.ethers.constants.MaxUint256,
        placeHolderAddr,
        placeHolderAddr,
    );
    const withdrawAction = new dfs.actions.maker.MakerWithdrawAction(
        '0',
        hre.ethers.constants.MaxUint256,
        ethJoin,
        placeHolderAddr,
        placeHolderAddr,
    );

    const sellAction = new dfs.actions.basic.SellAction(
        formatExchangeObj(
            WETH_ADDRESS,
            DAI_ADDR, // can't be placeholder because of proper formatting of uni path
            sellAmount,
            UNISWAP_WRAPPER,
        ),
        placeHolderAddr,
        placeHolderAddr,
    );

    const closeGasCost = 1_200_000;
    const gasFee = new dfs.actions.basic.GasFeeAction(closeGasCost, placeHolderAddr, 0);
    const sendFirst = new dfs.actions.basic.SendTokenAction(placeHolderAddr, makerFlAddr, 0);
    const sendSecond = new dfs.actions.basic.SendTokenAction(
        placeHolderAddr,
        placeHolderAddr,
        hre.ethers.constants.MaxUint256,
    );
    const sendColl = new dfs.actions.basic.SendTokenAndUnwrapAction(
        placeHolderAddr,
        placeHolderAddr,
        hre.ethers.constants.MaxUint256,
    );
    actionsCallData.push(flashLoanAction.encodeForRecipe()[0]);
    actionsCallData.push(paybackAction.encodeForRecipe()[0]);
    actionsCallData.push(withdrawAction.encodeForRecipe()[0]);
    actionsCallData.push(sellAction.encodeForRecipe()[0]);
    actionsCallData.push(gasFee.encodeForRecipe()[0]);
    actionsCallData.push(sendFirst.encodeForRecipe()[0]);
    actionsCallData.push(sendSecond.encodeForRecipe()[0]);
    actionsCallData.push(sendColl.encodeForRecipe()[0]);

    const strategyExecutorByBot = strategyExecutor.connect(botAcc);
    const strategyIndex = 0;
    const triggerCallData = [];

    if (isTrailing) {
        triggerCallData.push(abiCoder.encode(['uint256'], [roundId]));
    } else {
        triggerCallData.push(abiCoder.encode(['uint256', 'uint8'], ['0', '0']));
    }
    // eslint-disable-next-line max-len
    const receipt = await strategyExecutorByBot.executeStrategy(
        subId,
        strategyIndex,
        triggerCallData,
        actionsCallData,
        strategySub,
        {
            gasLimit: 8000000,
        },
    );

    const gasUsed = await getGasUsed(receipt);
    const dollarPrice = calcGasToUSD(gasUsed, AVG_GAS_PRICE);

    console.log(
        `GasUsed callMcdCloseToCollStrategy: ${gasUsed}, price at ${AVG_GAS_PRICE} gwei $${dollarPrice}`,
    );
};

// eslint-disable-next-line max-len
const callMcdCloseToDaiStrategy = async (
    proxy,
    botAcc,
    strategyExecutor,
    subId,
    strategySub,
    flAmount,
    ethJoin,
    makerFlAddr,
    isTrailing = false,
    roundId = 0,
) => {
    const actionsCallData = [];
    const flashLoanAction = new dfs.actions.flashloan.MakerFlashLoanAction(
        flAmount,
        nullAddress,
        [],
    );
    const paybackAction = new dfs.actions.maker.MakerPaybackAction(
        '0',
        hre.ethers.constants.MaxUint256,
        placeHolderAddr,
        placeHolderAddr,
    );
    const withdrawAction = new dfs.actions.maker.MakerWithdrawAction(
        '0',
        hre.ethers.constants.MaxUint256,
        ethJoin,
        placeHolderAddr,
        placeHolderAddr,
    );

    const sellAction = new dfs.actions.basic.SellAction(
        formatExchangeObj(
            WETH_ADDRESS,
            DAI_ADDR, // can't be placeholder because of proper formatting of uni path
            hre.ethers.constants.MaxUint256,
            UNISWAP_WRAPPER,
        ),
        placeHolderAddr,
        placeHolderAddr,
    );

    const closeGasCost = 1_200_000;
    const gasFee = new dfs.actions.basic.GasFeeAction(closeGasCost, placeHolderAddr, 0);
    const sendFirst = new dfs.actions.basic.SendTokenAction(placeHolderAddr, makerFlAddr, 0);
    const sendSecond = new dfs.actions.basic.SendTokenAction(
        placeHolderAddr,
        placeHolderAddr,
        hre.ethers.constants.MaxUint256,
    );
    actionsCallData.push(flashLoanAction.encodeForRecipe()[0]);
    actionsCallData.push(paybackAction.encodeForRecipe()[0]);
    actionsCallData.push(withdrawAction.encodeForRecipe()[0]);
    actionsCallData.push(sellAction.encodeForRecipe()[0]);
    actionsCallData.push(gasFee.encodeForRecipe()[0]);
    actionsCallData.push(sendFirst.encodeForRecipe()[0]);
    actionsCallData.push(sendSecond.encodeForRecipe()[0]);

    const strategyExecutorByBot = strategyExecutor.connect(botAcc);
    const strategyIndex = 0;
    const triggerCallData = [];

    if (isTrailing) {
        triggerCallData.push(abiCoder.encode(['uint256'], [roundId]));
    } else {
        triggerCallData.push(abiCoder.encode(['uint256', 'uint8'], ['0', '0']));
    }
    // eslint-disable-next-line max-len
    const receipt = await strategyExecutorByBot.executeStrategy(
        subId,
        strategyIndex,
        triggerCallData,
        actionsCallData,
        strategySub,
        {
            gasLimit: 8000000,
        },
    );

    const gasUsed = await getGasUsed(receipt);
    const dollarPrice = calcGasToUSD(gasUsed, AVG_GAS_PRICE);

    console.log(
        `GasUsed callMcdCloseStrategy: ${gasUsed}, price at ${AVG_GAS_PRICE} gwei $${dollarPrice}`,
    );
};

const callReflexerBoostStrategy = async (botAcc, strategyExecutor, subId, strategySub, boostAmount) => {
    const triggerCallData = [];
    const actionsCallData = [];

    const reflexerGenerateAction = new dfs.actions.reflexer.ReflexerGenerateAction(
        '0', // safeId
        boostAmount,
        placeHolderAddr,
    );

    const sellAction = new dfs.actions.basic.SellAction(
        formatExchangeObj(
            getAssetInfo('RAI').address,
            WETH_ADDRESS,
            '0',
            UNISWAP_WRAPPER,
        ),
        placeHolderAddr,
        placeHolderAddr,
    );

    const boostGasCost = 800000; // 800k gas
    const feeTakingAction = new dfs.actions.basic.GasFeeAction(
        boostGasCost, WETH_ADDRESS, '0',
    );

    const reflexerSupplyAction = new dfs.actions.reflexer.ReflexerSupplyAction(
        '0', // safeId
        '0', // amount
        ADAPTER_ADDRESS,
        placeHolderAddr,
    );

    actionsCallData.push(reflexerGenerateAction.encodeForRecipe()[0]);
    actionsCallData.push(sellAction.encodeForRecipe()[0]);
    actionsCallData.push(feeTakingAction.encodeForRecipe()[0]);
    actionsCallData.push(reflexerSupplyAction.encodeForRecipe()[0]);

    triggerCallData.push(abiCoder.encode(['uint256'], ['0']));

    const strategyExecutorByBot = strategyExecutor.connect(botAcc);

    const strategyIndex = 0;
    // eslint-disable-next-line max-len
    const receipt = await strategyExecutorByBot.executeStrategy(subId, strategyIndex, triggerCallData, actionsCallData, strategySub, {
        gasLimit: 8000000,
    });

    const gasUsed = await getGasUsed(receipt);
    const dollarPrice = calcGasToUSD(gasUsed, AVG_GAS_PRICE);

    console.log(`GasUsed callReflexerBoostStrategy: ${gasUsed}, price at ${AVG_GAS_PRICE} gwei $${dollarPrice}`);
};

const callReflexerFLBoostStrategy = async (botAcc, strategyExecutor, subId, strategySub, boostAmount, flAddr) => {
    const triggerCallData = [];
    const actionsCallData = [];

    const AAVE_NO_DEBT_MODE = 0;
    const flAction = new dfs.actions.flashloan.AaveV2FlashLoanAction([getAssetInfo('RAI').address], [boostAmount], [AAVE_NO_DEBT_MODE], nullAddress);

    const sellAction = new dfs.actions.basic.SellAction(
        formatExchangeObj(
            getAssetInfo('RAI').address,
            WETH_ADDRESS,
            '0',
            UNISWAP_WRAPPER,
        ),
        placeHolderAddr,
        placeHolderAddr,
    );

    const boostGasCost = 800000; // 800k gas
    const feeTakingAction = new dfs.actions.basic.GasFeeAction(
        boostGasCost, WETH_ADDRESS, '0',
    );

    const reflexerSupplyAction = new dfs.actions.reflexer.ReflexerSupplyAction(
        '0', // safeId
        '0', // amount
        ADAPTER_ADDRESS,
        placeHolderAddr,
    );

    const reflexerGenerateAction = new dfs.actions.reflexer.ReflexerGenerateAction(
        '0', // safeId
        '0',
        flAddr,
    );

    actionsCallData.push(flAction.encodeForRecipe()[0]);
    actionsCallData.push(sellAction.encodeForRecipe()[0]);
    actionsCallData.push(feeTakingAction.encodeForRecipe()[0]);
    actionsCallData.push(reflexerSupplyAction.encodeForRecipe()[0]);
    actionsCallData.push(reflexerGenerateAction.encodeForRecipe()[0]);

    triggerCallData.push(abiCoder.encode(['uint256'], ['0']));

    const strategyExecutorByBot = strategyExecutor.connect(botAcc);

    const strategyIndex = 1;
    // eslint-disable-next-line max-len
    const receipt = await strategyExecutorByBot.executeStrategy(subId, strategyIndex, triggerCallData, actionsCallData, strategySub, {
        gasLimit: 8000000,
    });

    const gasUsed = await getGasUsed(receipt);
    const dollarPrice = calcGasToUSD(gasUsed, AVG_GAS_PRICE);

    console.log(`GasUsed callReflexerFLBoostStrategy: ${gasUsed}, price at ${AVG_GAS_PRICE} gwei $${dollarPrice}`);
};

const callReflexerRepayStrategy = async (botAcc, strategyExecutor, subId, strategySub, repayAmount) => {
    const triggerCallData = [];
    const actionsCallData = [];

    const reflexerWithdrawAction = new dfs.actions.reflexer.ReflexerWithdrawAction(
        '0', // safeId
        repayAmount,
        ADAPTER_ADDRESS,
        placeHolderAddr,
    );

    const repayGasCost = 800000; // 800k gas
    const feeTakingAction = new dfs.actions.basic.GasFeeAction(
        repayGasCost, WETH_ADDRESS, '0',
    );

    const sellAction = new dfs.actions.basic.SellAction(
        formatExchangeObj(
            WETH_ADDRESS,
            getAssetInfo('RAI').address,
            '0',
            UNISWAP_WRAPPER,
        ),
        placeHolderAddr,
        placeHolderAddr,
    );

    const reflexerPaybackAction = new dfs.actions.reflexer.ReflexerPaybackAction(
        '0', // safeId
        '0',
        placeHolderAddr,
    );

    actionsCallData.push(reflexerWithdrawAction.encodeForRecipe()[0]);
    actionsCallData.push(feeTakingAction.encodeForRecipe()[0]);
    actionsCallData.push(sellAction.encodeForRecipe()[0]);
    actionsCallData.push(reflexerPaybackAction.encodeForRecipe()[0]);

    triggerCallData.push(abiCoder.encode(['uint256'], ['0']));

    const strategyExecutorByBot = strategyExecutor.connect(botAcc);

    const strategyIndex = 0;
    // eslint-disable-next-line max-len
    const receipt = await strategyExecutorByBot.executeStrategy(subId, strategyIndex, triggerCallData, actionsCallData, strategySub, {
        gasLimit: 8000000,
    });

    const gasUsed = await getGasUsed(receipt);
    const dollarPrice = calcGasToUSD(gasUsed, AVG_GAS_PRICE);

    console.log(`GasUsed callReflexerRepayStrategy: ${gasUsed}, price at ${AVG_GAS_PRICE} gwei $${dollarPrice}`);
};

const callReflexerFLRepayStrategy = async (botAcc, strategyExecutor, subId, strategySub, repayAmount, flAddr) => {
    const triggerCallData = [];
    const actionsCallData = [];

    const flAction = new dfs.actions.flashloan.BalancerFlashLoanAction([getAssetInfo('WETH').address], [repayAmount]);

    const repayGasCost = 800000; // 800k gas
    const feeTakingAction = new dfs.actions.basic.GasFeeAction(
        repayGasCost, WETH_ADDRESS, '0',
    );

    const sellAction = new dfs.actions.basic.SellAction(
        formatExchangeObj(
            WETH_ADDRESS,
            getAssetInfo('RAI').address,
            '0',
            UNISWAP_WRAPPER,
        ),
        placeHolderAddr,
        placeHolderAddr,
    );

    const reflexerPaybackAction = new dfs.actions.reflexer.ReflexerPaybackAction(
        '0', // safeId
        '0',
        placeHolderAddr,
    );

    const reflexerWithdrawAction = new dfs.actions.reflexer.ReflexerWithdrawAction(
        '0', // safeId
        '0',
        ADAPTER_ADDRESS,
        flAddr,
    );

    actionsCallData.push(flAction.encodeForRecipe()[0]);
    actionsCallData.push(feeTakingAction.encodeForRecipe()[0]);
    actionsCallData.push(sellAction.encodeForRecipe()[0]);
    actionsCallData.push(reflexerPaybackAction.encodeForRecipe()[0]);
    actionsCallData.push(reflexerWithdrawAction.encodeForRecipe()[0]);

    triggerCallData.push(abiCoder.encode(['uint256'], ['0']));

    const strategyExecutorByBot = strategyExecutor.connect(botAcc);

    const strategyIndex = 1;
    // eslint-disable-next-line max-len
    const receipt = await strategyExecutorByBot.executeStrategy(subId, strategyIndex, triggerCallData, actionsCallData, strategySub, {
        gasLimit: 8000000,
    });

    const gasUsed = await getGasUsed(receipt);
    const dollarPrice = calcGasToUSD(gasUsed, AVG_GAS_PRICE);

    console.log(`GasUsed callReflexerFLRepayStrategy: ${gasUsed}, price at ${AVG_GAS_PRICE} gwei $${dollarPrice}`);
};

const callLiquityBoostStrategy = async (
    botAcc,
    strategyExecutor,
    subId,
    strategySub,
    boostAmount,
    proxyAddr,
    maxFeePercentage,
) => {
    const triggerCallData = [];
    const actionsCallData = [];

    const { collAmount, debtAmount } = await getTroveInfo(proxyAddr);

    const newDebtAmount = debtAmount.add(boostAmount);
    let { upperHint, lowerHint } = await findInsertPosition(collAmount, newDebtAmount);

    const liquityBorrowAction = new dfs.actions.liquity.LiquityBorrowAction(
        maxFeePercentage,
        boostAmount,
        placeHolderAddr,
        upperHint,
        lowerHint,
    );

    const sellAction = new dfs.actions.basic.SellAction(
        formatExchangeObj(
            getAssetInfo('LUSD').address,
            getAssetInfo('WETH').address,
            '0',
            UNISWAP_WRAPPER,
        ),
        placeHolderAddr,
        placeHolderAddr,
    );

    // const boostGasCost = 1200000; // 1.2 mil gas
    const boostGasCost = 0; // 1.2 mil gas
    const feeTakingAction = new dfs.actions.basic.GasFeeAction(
        boostGasCost, WETH_ADDRESS, '0',
    );

    const supplyDollarValue = BN2Float(boostAmount) * getLocalTokenPrice('LUSD');
    const newCollAmount = collAmount.add(Float2BN(fetchAmountinUSDPrice('WETH', supplyDollarValue)));
    ({ upperHint, lowerHint } = await findInsertPosition(newCollAmount, newDebtAmount));

    const liquitySupplyAction = new dfs.actions.liquity.LiquitySupplyAction(
        '0',
        placeHolderAddr,
        upperHint,
        lowerHint,
    );

    const liquityRatioCheckAction = new dfs.actions.checkers.LiquityRatioCheckAction(
        '0', '0',
    );

    actionsCallData.push(liquityBorrowAction.encodeForRecipe()[0]);
    actionsCallData.push(sellAction.encodeForRecipe()[0]);
    actionsCallData.push(feeTakingAction.encodeForRecipe()[0]);
    actionsCallData.push(liquitySupplyAction.encodeForRecipe()[0]);
    actionsCallData.push(liquityRatioCheckAction.encodeForRecipe()[0]);

    triggerCallData.push(abiCoder.encode(['uint256'], ['0']));

    const strategyExecutorByBot = await strategyExecutor.connect(botAcc);

    const strategyId = 0;
    // eslint-disable-next-line max-len
    const receipt = await strategyExecutorByBot.executeStrategy(subId, strategyId, triggerCallData, actionsCallData, strategySub, {
        gasLimit: 8000000,
    });

    const gasUsed = await getGasUsed(receipt);
    const dollarPrice = calcGasToUSD(gasUsed, AVG_GAS_PRICE);

    console.log(`GasUsed callLiquityBoostStrategy: ${gasUsed}, price at ${AVG_GAS_PRICE} gwei $${dollarPrice}`);
};

const callLiquityFLBoostStrategy = async (
    botAcc,
    strategyExecutor,
    subId,
    strategySub,
    boostAmount,
    proxyAddr,
    flAddr,
    maxFeePercentage,
) => {
    const triggerCallData = [];
    const actionsCallData = [];

    const { collAmount, debtAmount } = await getTroveInfo(proxyAddr);

    // fetch a large enough amount to be able to boost
    const collIncrease = Float2BN(fetchAmountinUSDPrice('WETH', (boostAmount / 1e18).toString()));

    const newCollAmount = collAmount.add(collIncrease);
    const newDebtAmount = debtAmount.add(boostAmount);

    const flAmount = boostAmount;
    const exchangeAmount = boostAmount;

    const flAction = new dfs.actions.flashloan.FLAction(
        new dfs.actions.flashloan.BalancerFlashLoanAction(
            [getAssetInfo('LUSD').address],
            [flAmount],
        ),
    );

    const sellAction = new dfs.actions.basic.SellAction(
        formatExchangeObj(
            getAssetInfo('LUSD').address,
            getAssetInfo('WETH').address,
            exchangeAmount,
            UNISWAP_WRAPPER,
        ),
        placeHolderAddr,
        placeHolderAddr,
    );

    // const boostGasCost = 1500000; // 1.5 mil gas
    const boostGasCost = 0; // 1.5 mil gas

    const feeTakingAction = new dfs.actions.basic.GasFeeAction(
        boostGasCost, WETH_ADDRESS, '0',
    );

    const { upperHint, lowerHint } = await findInsertPosition(newCollAmount, newDebtAmount);
    const liquityAdjustAction = new dfs.actions.liquity.LiquityAdjustAction(
        maxFeePercentage,
        '0',
        '0',
        '0',
        '0',
        placeHolderAddr,
        flAddr,
        upperHint,
        lowerHint,
    );

    const liquityRatioCheckAction = new dfs.actions.checkers.LiquityRatioCheckAction(
        '0', '0',
    );

    actionsCallData.push(flAction.encodeForRecipe()[0]);
    actionsCallData.push(sellAction.encodeForRecipe()[0]);
    actionsCallData.push(feeTakingAction.encodeForRecipe()[0]);
    actionsCallData.push(liquityAdjustAction.encodeForRecipe()[0]);
    actionsCallData.push(liquityRatioCheckAction.encodeForRecipe()[0]);

    triggerCallData.push(abiCoder.encode(['uint256'], ['0']));

    const strategyExecutorByBot = await strategyExecutor.connect(botAcc);

    const strategyId = 1;
    // eslint-disable-next-line max-len
    const receipt = await strategyExecutorByBot.executeStrategy(subId, strategyId, triggerCallData, actionsCallData, strategySub, {
        gasLimit: 8000000,
    });

    const gasUsed = await getGasUsed(receipt);
    const dollarPrice = calcGasToUSD(gasUsed, AVG_GAS_PRICE);

    console.log(`GasUsed callLiquityFLBoostStrategy: ${gasUsed}, price at ${AVG_GAS_PRICE} gwei $${dollarPrice}`);
};

const callLiquityFLBoostWithCollStrategy = async (
    botAcc,
    strategyExecutor,
    subId,
    strategySub,
    boostAmount,
    proxyAddr,
    flAddr,
    maxFeePercentage,
) => {
    const triggerCallData = [];
    const actionsCallData = [];

    const { collAmount, debtAmount } = await getTroveInfo(proxyAddr);

    // fetch a large enough amount to be able to boost
    const flAmount = Float2BN(fetchAmountinUSDPrice('WETH', (boostAmount / 1e18).toString()));
    const flAmountWeGotBack = flAmount;

    const newCollAmount = collAmount.add(flAmountWeGotBack);
    const newDebtAmount = debtAmount.add(boostAmount);

    const newCollAmountAfterSell = newCollAmount.add(flAmountWeGotBack);
    const newCollAmountAfterSellAndSupply = newCollAmount;

    const flAction = new dfs.actions.flashloan.FLAction(
        new dfs.actions.flashloan.BalancerFlashLoanAction(
            [getAssetInfo('WETH').address],
            [flAmount],
        ),
    );

    let { upperHint, lowerHint } = await findInsertPosition(newCollAmount, newDebtAmount);
    const liquityAdjustAction = new dfs.actions.liquity.LiquityAdjustAction(
        maxFeePercentage,
        flAmountWeGotBack,
        boostAmount,
        '0',
        '0',
        placeHolderAddr,
        placeHolderAddr,
        upperHint,
        lowerHint,
    );

    const sellAction = new dfs.actions.basic.SellAction(
        formatExchangeObj(
            getAssetInfo('LUSD').address,
            getAssetInfo('WETH').address,
            0,
            UNISWAP_WRAPPER,
        ),
        placeHolderAddr,
        placeHolderAddr,
    );

    // const boostGasCost = 1500000; // 1.5 mil gas
    const boostGasCost = 0; // 1.5 mil gas

    const feeTakingAction = new dfs.actions.basic.GasFeeAction(
        boostGasCost, WETH_ADDRESS, '0',
    );

    ({ upperHint, lowerHint } = await findInsertPosition(newCollAmountAfterSell, newDebtAmount));
    const liquitySupplyAction = new dfs.actions.liquity.LiquitySupplyAction(
        0, // piped from fee taker
        placeHolderAddr, // proxy
        upperHint,
        lowerHint,
    );

    ({ upperHint, lowerHint } = await findInsertPosition(newCollAmountAfterSellAndSupply, newDebtAmount));
    const liquityWithdrawAction = new dfs.actions.liquity.LiquityWithdrawAction(
        0, // hardcoded input from FL
        flAddr,
        upperHint,
        lowerHint,
    );

    const liquityRatioCheckAction = new dfs.actions.checkers.LiquityRatioCheckAction(
        '0', '0',
    );

    actionsCallData.push(flAction.encodeForRecipe()[0]);
    actionsCallData.push(liquityAdjustAction.encodeForRecipe()[0]);
    actionsCallData.push(sellAction.encodeForRecipe()[0]);
    actionsCallData.push(feeTakingAction.encodeForRecipe()[0]);
    actionsCallData.push(liquitySupplyAction.encodeForRecipe()[0]);
    actionsCallData.push(liquityWithdrawAction.encodeForRecipe()[0]);
    actionsCallData.push(liquityRatioCheckAction.encodeForRecipe()[0]);

    triggerCallData.push(abiCoder.encode(['uint256'], ['0']));

    const strategyExecutorByBot = await strategyExecutor.connect(botAcc);

    const strategyId = 2;
    // eslint-disable-next-line max-len
    const receipt = await strategyExecutorByBot.executeStrategy(subId, strategyId, triggerCallData, actionsCallData, strategySub, {
        gasLimit: 8000000,
    });

    const gasUsed = await getGasUsed(receipt);
    const dollarPrice = calcGasToUSD(gasUsed, AVG_GAS_PRICE);

    console.log(`GasUsed callLiquityFLBoostWithCollStrategy: ${gasUsed}, price at ${AVG_GAS_PRICE} gwei $${dollarPrice}`);
};

const callLiquityRepayStrategy = async (
    botAcc,
    strategyExecutor,
    subId,
    strategySub,
    repayAmount,
    proxyAddr,
) => {
    const triggerCallData = [];
    const actionsCallData = [];

    const { collAmount, debtAmount } = await getTroveInfo(proxyAddr);

    const newCollAmount = collAmount.sub(repayAmount);
    let { upperHint, lowerHint } = await findInsertPosition(newCollAmount, debtAmount);

    const liquityWithdrawAction = new dfs.actions.liquity.LiquityWithdrawAction(
        repayAmount,
        placeHolderAddr,
        upperHint,
        lowerHint,
    );

    const sellAction = new dfs.actions.basic.SellAction(
        formatExchangeObj(
            getAssetInfo('WETH').address,
            getAssetInfo('LUSD').address,
            '0',
            UNISWAP_WRAPPER,
        ),
        placeHolderAddr,
        placeHolderAddr,
    );

    // const repayGasCost = 1200000; // 1.2 mil gas
    const repayGasCost = 0; // 1.2 mil gas

    const feeTakingAction = new dfs.actions.basic.GasFeeAction(
        repayGasCost, getAssetInfo('LUSD').address, '0',
    );

    const repayDollarValue = BN2Float(repayAmount) * getLocalTokenPrice('WETH');
    const newDebtAmount = debtAmount.sub(Float2BN(fetchAmountinUSDPrice('LUSD', repayDollarValue)));
    ({ upperHint, lowerHint } = await findInsertPosition(newCollAmount, newDebtAmount));

    const liquityPaybackAction = new dfs.actions.liquity.LiquityPaybackAction(
        '0',
        placeHolderAddr,
        upperHint,
        lowerHint,
    );

    const liquityRatioCheckAction = new dfs.actions.checkers.LiquityRatioCheckAction(
        '0', '0',
    );

    actionsCallData.push(liquityWithdrawAction.encodeForRecipe()[0]);
    actionsCallData.push(sellAction.encodeForRecipe()[0]);
    actionsCallData.push(feeTakingAction.encodeForRecipe()[0]);
    actionsCallData.push(liquityPaybackAction.encodeForRecipe()[0]);
    actionsCallData.push(liquityRatioCheckAction.encodeForRecipe()[0]);

    triggerCallData.push(abiCoder.encode(['uint256'], ['0']));

    const strategyExecutorByBot = await strategyExecutor.connect(botAcc);

    const strategyId = 0;
    // eslint-disable-next-line max-len
    const receipt = await strategyExecutorByBot.executeStrategy(subId, strategyId, triggerCallData, actionsCallData, strategySub, {
        gasLimit: 8000000,
    });

    const gasUsed = await getGasUsed(receipt);
    const dollarPrice = calcGasToUSD(gasUsed, AVG_GAS_PRICE);

    console.log(`GasUsed callLiquityRepayStrategy: ${gasUsed}, price at ${AVG_GAS_PRICE} gwei $${dollarPrice}`);
};

const callLiquityFLRepayStrategy = async (
    botAcc,
    strategyExecutor,
    subId,
    strategySub,
    repayAmount,
    proxyAddr,
    flAddr,
) => {
    const triggerCallData = [];
    const actionsCallData = [];

    const { collAmount, debtAmount } = await getTroveInfo(proxyAddr);
    const repayDollarValue = BN2Float(repayAmount) * getLocalTokenPrice('WETH');
    const newDebtAmount = debtAmount.sub(Float2BN(fetchAmountinUSDPrice('LUSD', repayDollarValue)));
    const newCollAmount = collAmount.sub(repayAmount);

    const flAmount = repayAmount;
    const exchangeAmount = repayAmount;

    const flAction = new dfs.actions.flashloan.FLAction(
        new dfs.actions.flashloan.BalancerFlashLoanAction(
            [getAssetInfo('WETH').address],
            [flAmount],
        ),
    );

    const sellAction = new dfs.actions.basic.SellAction(
        formatExchangeObj(
            getAssetInfo('WETH').address,
            getAssetInfo('LUSD').address,
            exchangeAmount,
            UNISWAP_WRAPPER,
        ),
        placeHolderAddr,
        placeHolderAddr,
    );

    // const repayGasCost = 1200000; // 1.2 mil gas
    const repayGasCost = 0; // 1.2 mil gas

    const feeTakingAction = new dfs.actions.basic.GasFeeAction(
        repayGasCost, getAssetInfo('LUSD').address, '0',
    );

    const { upperHint, lowerHint } = await findInsertPosition(newCollAmount, newDebtAmount);
    const liquityAdjustAction = new dfs.actions.liquity.LiquityAdjustAction(
        '0', // no liquity fee charged in recipe
        '0',
        '0',
        '0',
        '0',
        placeHolderAddr,
        flAddr,
        upperHint,
        lowerHint,
    );

    const liquityRatioCheckAction = new dfs.actions.checkers.LiquityRatioCheckAction(
        '0', '0',
    );

    actionsCallData.push(flAction.encodeForRecipe()[0]);
    actionsCallData.push(sellAction.encodeForRecipe()[0]);
    actionsCallData.push(feeTakingAction.encodeForRecipe()[0]);
    actionsCallData.push(liquityAdjustAction.encodeForRecipe()[0]);
    actionsCallData.push(liquityRatioCheckAction.encodeForRecipe()[0]);

    triggerCallData.push(abiCoder.encode(['uint256'], ['0']));

    const strategyExecutorByBot = await strategyExecutor.connect(botAcc);

    const strategyId = 1;
    // eslint-disable-next-line max-len
    const receipt = await strategyExecutorByBot.executeStrategy(subId, strategyId, triggerCallData, actionsCallData, strategySub, {
        gasLimit: 8000000,
    });

    const gasUsed = await getGasUsed(receipt);
    const dollarPrice = calcGasToUSD(gasUsed, AVG_GAS_PRICE);

    console.log(`GasUsed callLiquityFLRepayStrategy: ${gasUsed}, price at ${AVG_GAS_PRICE} gwei $${dollarPrice}`);
};

// eslint-disable-next-line max-len
const callLiquityCloseToCollStrategy = async (
    botAcc,
    strategyExecutor,
    subId,
    strategySub,
    flAmount,
    balancerFlAddr,
    isTrailing = false,
    roundId = 0,
) => {
    const actionsCallData = [];
    const flashLoanAction = new dfs.actions.flashloan.BalancerFlashLoanAction(
        [WETH_ADDRESS], // weth
        [flAmount],
    );

    const sellAction = new dfs.actions.basic.SellAction(
        formatExchangeObj(
            WETH_ADDRESS,
            LUSD_ADDR, // can't be placeholder because of proper formatting of uni path
            flAmount, // piped from fl
            UNISWAP_WRAPPER,
        ),
        placeHolderAddr,
        placeHolderAddr,
    );

    const liquityCloseAction = new dfs.actions.liquity.LiquityCloseAction(
        placeHolderAddr, // hardcoded take lusd from proxy
        placeHolderAddr, // hardcoded send to proxy
    );

    const closeGasCost = 1_500_000;
    const gasFee = new dfs.actions.basic.GasFeeAction(closeGasCost, placeHolderAddr, 0);
    const sendFL = new dfs.actions.basic.SendTokenAction(placeHolderAddr, balancerFlAddr, 0);
    const sendWethToEOA = new dfs.actions.basic.SendTokenAction(
        placeHolderAddr,
        placeHolderAddr,
        hre.ethers.constants.MaxUint256,
    );
    const sendLUSD = new dfs.actions.basic.SendTokenAndUnwrapAction(
        placeHolderAddr,
        placeHolderAddr,
        hre.ethers.constants.MaxUint256,
    );
    actionsCallData.push(flashLoanAction.encodeForRecipe()[0]);
    actionsCallData.push(sellAction.encodeForRecipe()[0]);
    actionsCallData.push(liquityCloseAction.encodeForRecipe()[0]);
    actionsCallData.push(gasFee.encodeForRecipe()[0]);
    actionsCallData.push(sendFL.encodeForRecipe()[0]);
    actionsCallData.push(sendWethToEOA.encodeForRecipe()[0]);
    actionsCallData.push(sendLUSD.encodeForRecipe()[0]);

    const strategyExecutorByBot = strategyExecutor.connect(botAcc);
    const strategyIndex = 0;
    const triggerCallData = [];

    if (isTrailing) {
        triggerCallData.push(abiCoder.encode(['uint256'], [roundId]));
    } else {
        triggerCallData.push(abiCoder.encode(['uint256', 'uint8'], ['0', '0']));
    }

    // eslint-disable-next-line max-len
    const receipt = await strategyExecutorByBot.executeStrategy(
        subId,
        strategyIndex,
        triggerCallData,
        actionsCallData,
        strategySub,
        {
            gasLimit: 8000000,
        },
    );

    const gasUsed = await getGasUsed(receipt);
    const dollarPrice = calcGasToUSD(gasUsed, AVG_GAS_PRICE);

    console.log(
        `GasUsed callMcdCloseToCollStrategy: ${gasUsed}, price at ${AVG_GAS_PRICE} gwei $${dollarPrice}`,
    );
};

// eslint-disable-next-line max-len
const callCbRebondStrategy = async (
    botAcc,
    strategyExecutor,
    subId,
    strategySub,
) => {
    const actionsCallData = [];
    const cbChickenInAction = new dfs.actions.chickenBonds.CBChickenInAction(
        '0', // bondID hardcoded from sub slot
        placeHolderAddr, // _to hardcoded to proxy
    );

    const bLUSDInfo = getAssetInfo('bLUSD');
    const lusdInfo = getAssetInfo('LUSD');

    const sellAction = new dfs.actions.basic.SellAction(
        await formatMockExchangeObj(
            bLUSDInfo,
            lusdInfo,
            MAX_UINT,
        ),
        placeHolderAddr,
        placeHolderAddr,
    );

    const gasCost = 1_600_000;
    const gasFee = new dfs.actions.basic.GasFeeAction(gasCost, placeHolderAddr, 0);

    const cbCreateAction = new dfs.actions.chickenBonds.CBCreateAction(
        '0', // lusdAmount from the gas fee action
        placeHolderAddr, // from hardcoded proxy
    );

    const cbUpdateRebondSubAction = new dfs.actions.chickenBonds.CBUpdateRebondSubAction(
        '0', // hardcoded subId from subscription
        '0', // hardcoded bondId from return value
    );

    actionsCallData.push(cbChickenInAction.encodeForRecipe()[0]);
    actionsCallData.push(sellAction.encodeForRecipe()[0]);
    actionsCallData.push(gasFee.encodeForRecipe()[0]);
    actionsCallData.push(cbCreateAction.encodeForRecipe()[0]);
    actionsCallData.push(cbUpdateRebondSubAction.encodeForRecipe()[0]);

    const strategyExecutorByBot = strategyExecutor.connect(botAcc);
    const strategyIndex = 0;
    const triggerCallData = [];

    triggerCallData.push(abiCoder.encode(['uint256'], ['0']));

    // eslint-disable-next-line max-len
    const receipt = await strategyExecutorByBot.executeStrategy(
        subId,
        strategyIndex,
        triggerCallData,
        actionsCallData,
        strategySub,
        {
            gasLimit: 8000000,
        },
    );

    const gasUsed = await getGasUsed(receipt);
    const dollarPrice = calcGasToUSD(gasUsed, AVG_GAS_PRICE);

    console.log(
        `GasUsed callCbRebondStrategy: ${gasUsed}, price at ${AVG_GAS_PRICE} gwei $${dollarPrice}`,
    );
};

const callLiquityPaybackChickenOutStrategy = async (
    botAcc,
    strategyExecutor,
    subId,
    strategySub,
    bondIdIfRebondSub,
    lusdDepositedInBond,
    upperHint,
    lowerHint,
) => {
    const actionsCallData = [];
    const fetchBondIdAction = new dfs.actions.chickenBonds.FetchBondIdAction(
        '0',
        '0',
        bondIdIfRebondSub,
    );
    const cbChickenOutAction = new dfs.actions.chickenBonds.CBChickenOutAction(
        '0',
        lusdDepositedInBond, // sent from backend to support emergency repayments, but should default to bond.lusdAmountDeposited almost always
        placeHolderAddr,
    );
    const gasCost = 1_000_000;
    const feeAction = new dfs.actions.basic.GasFeeAction(
        gasCost, placeHolderAddr, '0',
    );
    const paybackAction = new dfs.actions.liquity.LiquityPaybackAction(
        hre.ethers.constants.MaxUint256, placeHolderAddr, upperHint, lowerHint,
    );
    const sendTokenAction = new dfs.actions.basic.SendTokenAction(
        placeHolderAddr, placeHolderAddr, hre.ethers.constants.MaxUint256,
    );

    actionsCallData.push(fetchBondIdAction.encodeForRecipe()[0]);
    actionsCallData.push(cbChickenOutAction.encodeForRecipe()[0]);
    actionsCallData.push(feeAction.encodeForRecipe()[0]);
    actionsCallData.push(paybackAction.encodeForRecipe()[0]);
    actionsCallData.push(sendTokenAction.encodeForRecipe()[0]);

    const strategyExecutorByBot = strategyExecutor.connect(botAcc);
    const strategyIndex = 1;
    const triggerCallData = [];

    triggerCallData.push(abiCoder.encode(['address', 'uint256', 'uint8'], [nullAddress, '0', '0']));

    const receipt = await strategyExecutorByBot.executeStrategy(
        subId,
        strategyIndex,
        triggerCallData,
        actionsCallData,
        strategySub,
        {
            gasLimit: 8000000,
        },
    );

    const gasUsed = await getGasUsed(receipt);
    const dollarPrice = calcGasToUSD(gasUsed, AVG_GAS_PRICE);

    console.log(
        `GasUsed callLiquityPaybackChickenOutStrategy: ${gasUsed}, price at ${AVG_GAS_PRICE} gwei $${dollarPrice}`,
    );
};

const callLiquityPaybackChickenInStrategy = async (
    botAcc,
    strategyExecutor,
    subId,
    strategySub,
    bondIdIfRebondSub,
    lusdDepositedInBond,
    upperHint,
    lowerHint,
) => {
    const actionsCallData = [];
    const fetchBondIdAction = new dfs.actions.chickenBonds.FetchBondIdAction(
        '0',
        '0',
        bondIdIfRebondSub,
    );
    const cbChickenOutAction = new dfs.actions.chickenBonds.CBChickenInAction(
        placeHolderAddr,
        placeHolderAddr,
    );
    const bLUSDInfo = getAssetInfo('bLUSD');
    const lusdInfo = getAssetInfo('LUSD');
    const sellAction = new dfs.actions.basic.SellAction(
        await formatMockExchangeObj(
            bLUSDInfo,
            lusdInfo,
            MAX_UINT,
        ),
        placeHolderAddr, // hardcoded
        placeHolderAddr, // hardcoded
    );
    const gasCost = 1_000_000;
    const feeAction = new dfs.actions.basic.GasFeeAction(
        gasCost, placeHolderAddr, '0',
    );
    const paybackAction = new dfs.actions.liquity.LiquityPaybackAction(
        hre.ethers.constants.MaxUint256, placeHolderAddr, upperHint, lowerHint,
    );
    const sendTokenAction = new dfs.actions.basic.SendTokenAction(
        placeHolderAddr, placeHolderAddr, hre.ethers.constants.MaxUint256,
    );

    actionsCallData.push(fetchBondIdAction.encodeForRecipe()[0]);
    actionsCallData.push(cbChickenOutAction.encodeForRecipe()[0]);
    actionsCallData.push(sellAction.encodeForRecipe()[0]);
    actionsCallData.push(feeAction.encodeForRecipe()[0]);
    actionsCallData.push(paybackAction.encodeForRecipe()[0]);
    actionsCallData.push(sendTokenAction.encodeForRecipe()[0]);

    const strategyExecutorByBot = strategyExecutor.connect(botAcc);
    const strategyIndex = 0;
    const triggerCallData = [];

    triggerCallData.push(abiCoder.encode(['address', 'uint256', 'uint8'], [nullAddress, '0', '0']));

    const receipt = await strategyExecutorByBot.executeStrategy(
        subId,
        strategyIndex,
        triggerCallData,
        actionsCallData,
        strategySub,
        {
            gasLimit: 8000000,
        },
    );

    const gasUsed = await getGasUsed(receipt);
    const dollarPrice = calcGasToUSD(gasUsed, AVG_GAS_PRICE);

    console.log(
        `GasUsed callLiquityPaybackChickenInStrategy: ${gasUsed}, price at ${AVG_GAS_PRICE} gwei $${dollarPrice}`,
    );
};

const callMorphoAaveV2FLBoostStrategy = async ({
    botAcc,
    strategyExecutor,
    subId,
    strategyId,
    strategySub,

    cAsset,
    dAsset,
    flAddress,
    flAmount,
    exchangeAmount,
    exchangeWrapper,
}) => {
    const strategy = new dfs.Strategy('');

    strategy.addAction(new dfs.actions.flashloan.FLAction(
        new dfs.actions.flashloan.EulerFlashLoanAction(
            dAsset, flAmount,
        ),
    ));
    strategy.addAction(new dfs.actions.basic.SellAction(
        formatExchangeObj(
            dAsset,
            cAsset,
            exchangeAmount,
            exchangeWrapper,
        ),
        placeHolderAddr,
        placeHolderAddr,
    ));

    const gasCost = 2_300_000;
    strategy.addAction(new dfs.actions.basic.GasFeeAction(
        gasCost, cAsset, '0',
    ));
    strategy.addAction(new dfs.actions.morpho.MorphoAaveV2SupplyAction(
        cAsset, '0', nullAddress, nullAddress, '0',
    ));
    strategy.addAction(new dfs.actions.morpho.MorphoAaveV2BorrowAction(
        dAsset, '0', flAddress, '0',
    ));
    strategy.addAction(new dfs.actions.checkers.MorphoAaveV2RatioCheckAction(
        '0', '0', nullAddress,
    ));

    const triggerCallData = [hre.ethers.utils.defaultAbiCoder.encode(['uint256'], ['0'])];
    const actionsCallData = strategy.actions.map((e) => e.encodeForRecipe()[0]);

    const strategyExecutorByBot = strategyExecutor.connect(botAcc);

    // eslint-disable-next-line max-len
    const receipt = await strategyExecutorByBot.executeStrategy(subId, strategyId, triggerCallData, actionsCallData, strategySub, {
        gasLimit: 8000000,
    });

    const gasUsed = await getGasUsed(receipt);
    const dollarPrice = calcGasToUSD(gasUsed, AVG_GAS_PRICE);

    console.log(`GasUsed callMorphoAaveV2FLBoostStrategy: ${gasUsed}, price at ${AVG_GAS_PRICE} gwei $${dollarPrice}`);
};

const callMorphoAaveV2BoostStrategy = async ({
    botAcc,
    strategyExecutor,
    subId,
    strategyId,
    strategySub,

    cAsset,
    dAsset,
    boostAmount,
    exchangeWrapper,
}) => {
    const strategy = new dfs.Strategy('');

    strategy.addAction(new dfs.actions.morpho.MorphoAaveV2BorrowAction(
        dAsset, boostAmount, nullAddress, '0',
    ));
    strategy.addAction(new dfs.actions.basic.SellAction(
        formatExchangeObj(
            dAsset,
            cAsset,
            '0',
            exchangeWrapper,
        ),
        placeHolderAddr,
        placeHolderAddr,
    ));
    const gasCost = 2_000_000;
    strategy.addAction(new dfs.actions.basic.GasFeeAction(
        gasCost, cAsset, '0',
    ));
    strategy.addAction(new dfs.actions.morpho.MorphoAaveV2SupplyAction(
        cAsset, '0', nullAddress, nullAddress, '0',
    ));
    strategy.addAction(new dfs.actions.checkers.MorphoAaveV2RatioCheckAction(
        '0', '0', nullAddress,
    ));

    const triggerCallData = [hre.ethers.utils.defaultAbiCoder.encode(['uint256'], ['0'])];
    const actionsCallData = strategy.actions.map((e) => e.encodeForRecipe()[0]);

    const strategyExecutorByBot = strategyExecutor.connect(botAcc);

    // eslint-disable-next-line max-len
    const receipt = await strategyExecutorByBot.executeStrategy(subId, strategyId, triggerCallData, actionsCallData, strategySub, {
        gasLimit: 8000000,
    });

    const gasUsed = await getGasUsed(receipt);
    const dollarPrice = calcGasToUSD(gasUsed, AVG_GAS_PRICE);

    console.log(`GasUsed callMorphoAaveV2BoostStrategy: ${gasUsed}, price at ${AVG_GAS_PRICE} gwei $${dollarPrice}`);
};

const callMorphoAaveV2FLRepayStrategy = async ({
    botAcc,
    strategyExecutor,
    subId,
    strategyId,
    strategySub,

    cAsset,
    dAsset,
    flAmount,
    flAddress,
    exchangeAmount,
    exchangeWrapper,
}) => {
    const strategy = new dfs.Strategy('');

    strategy.addAction(new dfs.actions.flashloan.FLAction(
        new dfs.actions.flashloan.EulerFlashLoanAction(
            cAsset, flAmount,
        ),
    ));
    strategy.addAction(new dfs.actions.basic.SellAction(
        formatExchangeObj(
            cAsset,
            dAsset,
            exchangeAmount,
            exchangeWrapper,
        ),
        placeHolderAddr,
        placeHolderAddr,
    ));

    const gasCost = 2_400_000;
    strategy.addAction(new dfs.actions.basic.GasFeeAction(
        gasCost, dAsset, '0',
    ));
    strategy.addAction(new dfs.actions.morpho.MorphoAaveV2PaybackAction(
        dAsset, '0', nullAddress, nullAddress,
    ));
    strategy.addAction(new dfs.actions.morpho.MorphoAaveV2WithdrawAction(
        cAsset, '0', flAddress,
    ));
    strategy.addAction(new dfs.actions.checkers.MorphoAaveV2RatioCheckAction(
        '0', '0', nullAddress,
    ));

    const triggerCallData = [hre.ethers.utils.defaultAbiCoder.encode(['uint256'], ['0'])];
    const actionsCallData = strategy.actions.map((e) => e.encodeForRecipe()[0]);

    const strategyExecutorByBot = strategyExecutor.connect(botAcc);

    // eslint-disable-next-line max-len
    const receipt = await strategyExecutorByBot.executeStrategy(subId, strategyId, triggerCallData, actionsCallData, strategySub, {
        gasLimit: 8000000,
    });

    const gasUsed = await getGasUsed(receipt);
    const dollarPrice = calcGasToUSD(gasUsed, AVG_GAS_PRICE);

    console.log(`GasUsed callMorphoAaveV2FLRepayStrategy: ${gasUsed}, price at ${AVG_GAS_PRICE} gwei $${dollarPrice}`);
};

const callMorphoAaveV2RepayStrategy = async ({
    botAcc,
    strategyExecutor,
    subId,
    strategyId,
    strategySub,

    cAsset,
    dAsset,
    repayAmount,
    exchangeWrapper,
}) => {
    const strategy = new dfs.Strategy('');

    strategy.addAction(new dfs.actions.morpho.MorphoAaveV2WithdrawAction(
        cAsset, repayAmount, nullAddress,
    ));
    strategy.addAction(new dfs.actions.basic.SellAction(
        formatExchangeObj(
            cAsset,
            dAsset,
            '0',
            exchangeWrapper,
        ),
        placeHolderAddr,
        placeHolderAddr,
    ));

    const gasCost = 0;
    strategy.addAction(new dfs.actions.basic.GasFeeAction(
        gasCost, dAsset, '0',
    ));
    strategy.addAction(new dfs.actions.morpho.MorphoAaveV2PaybackAction(
        dAsset, '0', nullAddress, nullAddress,
    ));
    strategy.addAction(new dfs.actions.checkers.MorphoAaveV2RatioCheckAction(
        '0', '0', nullAddress,
    ));

    const triggerCallData = [hre.ethers.utils.defaultAbiCoder.encode(['uint256'], ['0'])];
    const actionsCallData = strategy.actions.map((e) => e.encodeForRecipe()[0]);

    const strategyExecutorByBot = strategyExecutor.connect(botAcc);

    // eslint-disable-next-line max-len
    const receipt = await strategyExecutorByBot.executeStrategy(subId, strategyId, triggerCallData, actionsCallData, strategySub, {
        gasLimit: 8000000,
    });

    const gasUsed = await getGasUsed(receipt);
    const dollarPrice = calcGasToUSD(gasUsed, AVG_GAS_PRICE);

    console.log(`GasUsed callMorphoAaveV2RepayStrategy: ${gasUsed}, price at ${AVG_GAS_PRICE} gwei $${dollarPrice}`);
};

module.exports = {
    callDcaStrategy,
    callMcdRepayStrategy,
    callFLMcdRepayStrategy,
    callMcdBoostStrategy,
    callFLMcdBoostStrategy,
    callLimitOrderStrategy,
    callUniV3RangeOrderStrategy,
    callMcdCloseToDaiStrategy,
    callMcdCloseToCollStrategy,
    callUniV3CollectStrategy,
    callCompBoostStrategy,
    callCompRepayStrategy,
    callReflexerBoostStrategy,
    callReflexerFLBoostStrategy,
    callReflexerRepayStrategy,
    callReflexerFLRepayStrategy,
    callLiquityBoostStrategy,
    callLiquityFLBoostStrategy,
    callLiquityFLBoostWithCollStrategy,
    callLiquityRepayStrategy,
    callLiquityFLRepayStrategy,
    callLiquityCloseToCollStrategy,
    callMcdRepayFromYearnStrategy,
    callMcdRepayFromYearnWithExchangeStrategy,
    callMcdRepayFromMstableStrategy,
    callMcdRepayFromMstableWithExchangeStrategy,
    callMcdRepayFromRariStrategy,
    callMcdRepayFromRariStrategyWithExchange,
    callMcdRepayCompositeStrategy,
    callMcdFLRepayCompositeStrategy,
    callMcdBoostCompositeStrategy,
    callMcdFLBoostCompositeStrategy,
    callCbRebondStrategy,
    callLiquityPaybackChickenOutStrategy,
    callLiquityPaybackChickenInStrategy,
    callMorphoAaveV2FLBoostStrategy,
    callMorphoAaveV2BoostStrategy,
    callMorphoAaveV2FLRepayStrategy,
    callMorphoAaveV2RepayStrategy,
};
