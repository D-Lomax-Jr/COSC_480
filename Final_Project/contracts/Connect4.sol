// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract Connect4 {
    enum WagerStatus {
        Active,
        PlayerWon,
        PlayerLost,
        Cancelled
    }

    struct LocalWager {
        address payable player;
        uint256 stake;
        WagerStatus status;
    }

    uint256 public nextWagerId;
    uint256 public lostStakeTotal;

    mapping(uint256 => LocalWager) public wagers;
    mapping(address => uint256) public playerLostStake;

    event WagerCreated(uint256 indexed wagerId, address indexed player, uint256 stake);
    event WagerSettled(uint256 indexed wagerId, address indexed player, bool playerWon, uint256 payout);
    event WagerCancelled(uint256 indexed wagerId, address indexed player, uint256 refund);

    modifier onlyWagerPlayer(uint256 wagerId) {
        require(msg.sender == wagers[wagerId].player, "Only the wager player can do this");
        _;
    }

    function createLocalWager() external payable returns (uint256 wagerId) {
        require(msg.value > 0, "Stake is required");

        wagerId = nextWagerId;
        nextWagerId += 1;

        wagers[wagerId] = LocalWager({
            player: payable(msg.sender),
            stake: msg.value,
            status: WagerStatus.Active
        });

        emit WagerCreated(wagerId, msg.sender, msg.value);
    }

    function settleLocalWager(uint256 wagerId, bool playerWon) external onlyWagerPlayer(wagerId) {
        LocalWager storage wager = wagers[wagerId];
        require(wager.status == WagerStatus.Active, "Wager is already settled");

        uint256 payout = 0;
        if (playerWon) {
            payout = wager.stake;
            wager.status = WagerStatus.PlayerWon;
            wager.player.transfer(payout);
        } else {
            wager.status = WagerStatus.PlayerLost;
            lostStakeTotal += wager.stake;
            playerLostStake[msg.sender] += wager.stake;
        }

        emit WagerSettled(wagerId, msg.sender, playerWon, payout);
    }

    function cancelLocalWager(uint256 wagerId) external onlyWagerPlayer(wagerId) {
        LocalWager storage wager = wagers[wagerId];
        require(wager.status == WagerStatus.Active, "Wager is already settled");

        uint256 refund = wager.stake;
        wager.status = WagerStatus.Cancelled;
        wager.player.transfer(refund);

        emit WagerCancelled(wagerId, msg.sender, refund);
    }

    function vaultBalance() external view returns (uint256) {
        return address(this).balance;
    }
}
