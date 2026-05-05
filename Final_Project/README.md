# Connect 4 Wagers

A senior capstone web app for local Connect 4 with account login, MySQL stats, MetaMask wallet connection, and Sepolia test ETH wager settlement.

## What It Includes

- Login and signup with hashed passwords stored in MySQL.
- Sequelize models for users, leaderboard stats, and local game records.
- Local hot-seat Connect 4 play in one browser.
- Connect 4 turn validation, win detection, draw detection, and leaderboard stats.
- MetaMask wallet saving per account.
- Solidity wager contract where the connected player deposits a test ETH stake before the board starts. A win returns the stake, a loss leaves it held in the contract, and a draw refunds it.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create or update `.env` using `.env.example` as a guide.

3. Make sure the MySQL user in `.env` has access to the database named by `DB_DATABASE`.
   If needed, run `database_setup.sql` as a MySQL admin user after replacing the sample database, username, and password.

4. Start the web app:

   ```bash
   npm start
   ```

5. Open `http://localhost:3000`.

## Sepolia Contract

Compile the contract:

```bash
npm run compile
```

Deploy to Sepolia if you want one shared contract address for every local wager:

```bash
npm run deploy
```

Copy the deployed contract address into `.env` as `CONTRACT_ADDRESS`, then restart the app.

You can also leave `CONTRACT_ADDRESS` blank. In that mode, the logged-in player deploys a fresh wager contract from MetaMask when starting the first local wager.

## Local Wager Flow

1. Log in or sign up.
2. Connect MetaMask on a test network.
3. Enter the test ETH stake and click **Start Wager**.
4. MetaMask confirms the contract deployment if needed, then confirms the stake deposit.
5. Play the local hot-seat Connect 4 board.
6. If the logged-in player wins, **Settle Wager** returns the stake. If the logged-in player loses, **Settle Wager** leaves the stake held by the contract. If the board draws, **Refund Draw** returns the stake.

## Notes

- Use Sepolia or another test network only. This project is for test ETH, not real-money wagering.
- The app creates the `users` and `games` tables automatically when the configured MySQL user has permission.
- Hardhat may warn on very new Node versions. If contract compilation behaves oddly, use an LTS Node release.
