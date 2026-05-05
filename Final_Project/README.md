# Connect 4 Wagers

Connect 4 Wagers is a Senior Capstone web application that combines a classic Connect 4 game with user accounts, MySQL persistence, MetaMask wallet connection, and a Solidity smart contract for Sepolia test ETH wager handling.

The current version is designed as a local hot-seat demo. A user logs in, connects MetaMask, deposits a small amount of Sepolia test ETH into a smart contract, plays Connect 4 locally in the browser, and settles the result through MetaMask. If the player wins, the stake is returned. If the player loses, the stake stays inside the contract vault. If the game ends in a draw, the stake is refunded.

This project is for educational and demonstration purposes only. It should use test ETH only, not real funds.

## Main Features

- User signup and login
- Password hashing with `bcryptjs`
- MySQL database persistence
- Sequelize ORM models for users and local game records
- Leaderboard using stored win/loss statistics
- MetaMask wallet connection
- Sepolia test network support
- Local Connect 4 game board
- Turn handling, win detection, and draw detection
- Solidity smart contract for local wager deposits and settlement
- Vault tab showing test ETH held by the deployed contract
- Futuristic cyber-style frontend design

## Technology Stack

- Frontend: HTML, CSS, vanilla JavaScript
- Backend: Node.js and Express
- Database: MySQL
- ORM: Sequelize
- Authentication: JSON Web Tokens
- Password security: bcrypt
- Blockchain tools: Hardhat and ethers.js
- Wallet: MetaMask
- Smart contract language: Solidity
- Test network: Sepolia

## Project Structure

```text
Final_Project/
  contracts/
    Connect4.sol             Solidity wager contract
  public/
    index.html               Frontend layout
    app.js                   Frontend game, wallet, and contract logic
    styles.css               Frontend styling
    assets/                  Static image assets
  scripts/
    deploy.js                Hardhat deployment script
  src/
    server.js                Express server and Sequelize models
  database_setup.sql         Optional database setup helper
  hardhat.config.js          Hardhat network/compiler config
  package.json               Node scripts and dependencies
  .env.example               Safe environment variable template
  .gitignore                 Files excluded from Git
```

## Environment Variables

Create a `.env` file using `.env.example` as a guide.

```env
DB_HOST=localhost
DB_USER=connect4_user
DB_PASSWORD=replace_me
DB_DATABASE=connect4_app
DB_PORT=3306
DB_DIALECT=mysql
PORT=3000

API_URL=https://sepolia.infura.io/v3/replace_me
PRIVATE_KEY=replace_me_without_0x
CONTRACT_ADDRESS=
JWT_SECRET=replace_with_a_long_random_string
```

Do not commit `.env` to GitHub. It contains private credentials and keys. The `.gitignore` file excludes `.env` while keeping `.env.example`.

## Database Setup

The application uses MySQL through Sequelize.

The main tables are:

- `users`: stores usernames, password hashes, wallet addresses, wins, and losses
- `local_games`: stores local wager game records, contract addresses, wager IDs, status, and move history

If your MySQL user already has permissions, the app can create/sync the required Sequelize table for `local_games`. If permissions are limited, use MySQL Workbench or `database_setup.sql` to create the database and grant privileges.

Recommended privileges for the app database:

```sql
CREATE DATABASE IF NOT EXISTS connect4_app;
GRANT ALL PRIVILEGES ON connect4_app.* TO 'connect4_user'@'%';
FLUSH PRIVILEGES;
```

Your local database may use `wins` and `losses` columns instead of `games_won` and `games_lost`. The backend detects and supports that existing schema.

## Installation

Install dependencies:

```bash
npm install
```

Compile the Solidity contract:

```bash
npm run compile
```

Start the web app:

```bash
npm start
```

Open the app in your browser:

```text
http://localhost:3000
```

## Smart Contract

The smart contract is located at:

```text
contracts/Connect4.sol
```

The contract supports:

- Creating a local wager with `createLocalWager`
- Settling a wager with `settleLocalWager`
- Refunding a draw with `cancelLocalWager`
- Tracking total lost stakes with `lostStakeTotal`
- Tracking each player's lost stake with `playerLostStake`
- Reading the contract balance with `vaultBalance`

When a player loses, the ETH is not transferred to the website or database. It remains inside the deployed smart contract. The website reads the contract balance and displays it in the Vault tab.

## Contract Deployment Options

There are two supported contract approaches.

Option 1: Shared deployed contract

Deploy once:

```bash
npm run deploy
```

Copy the deployed address into `.env`:

```env
CONTRACT_ADDRESS=0xYourContractAddress
```

Restart the app:

```bash
npm start
```

Option 2: Browser-deployed contract

Leave `CONTRACT_ADDRESS` blank. When a user starts a wager, MetaMask can deploy a compatible contract from the browser. The deployed address is saved in browser local storage and reused if compatible.

## How to Use the App

1. Open `http://localhost:3000`.
2. Sign up or log in.
3. Connect MetaMask.
4. Make sure MetaMask is on Sepolia.
5. Enter a small test ETH stake.
6. Click **Start Wager**.
7. Confirm MetaMask transactions.
8. Play Connect 4 locally.
9. Settle the result:
   - Win: stake is returned
   - Loss: stake remains in the contract vault
   - Draw: stake is refunded
10. Open the **Vault** tab to view contract-held test ETH.

## Vault Tab

The Vault tab shows blockchain data from the deployed contract:

- Contract Balance: current ETH balance held by the smart contract
- Tracked Lost Stakes: total lost wagers recorded by the contract
- Your Recorded Losses: amount lost by the connected wallet
- Contract Address: the address being read

The Vault tab requires MetaMask because the frontend uses the wallet provider to read Sepolia contract state.

## Security Notes

- This project is for test networks only.
- Do not use real ETH.
- Do not commit `.env`.
- Keep private keys out of frontend code.
- Passwords are stored as hashes, not plaintext.
- The local game result is settled from the browser, so this is a capstone/demo architecture, not a production gambling system.

## Useful Scripts

```bash
npm start
```

Starts the Express web server.

```bash
npm run compile
```

Compiles the Solidity contract with Hardhat.

```bash
npm run deploy
```

Deploys the contract to Sepolia using `scripts/deploy.js`.

```bash
npm test
```

Runs Hardhat tests if test files are added.

## Troubleshooting

MetaMask says insufficient funds:

- Make sure MetaMask is on Sepolia.
- Use a small stake such as `0.001`.
- Remember the first browser deployment costs gas in addition to the stake.

The app cannot connect to MySQL:

- Check `.env` database values.
- Confirm the database exists.
- Confirm the MySQL user has privileges on the database.

Hardhat warns about Node version:

- Hardhat may warn on very new Node versions.
- If compilation behaves strangely, use an LTS Node version.

Vault shows no contract:

- Start a wager first, or deploy a contract and set `CONTRACT_ADDRESS`.
- Refresh the Vault tab after settlement.

Old contract does not show tracked lost stakes:

- Older deployed contracts may not include the vault tracking functions.
- Start a new wager so the app deploys or uses a compatible contract.
