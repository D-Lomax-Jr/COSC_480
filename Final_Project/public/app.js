const authPanel = document.querySelector("#authPanel");
const gamePanel = document.querySelector("#gamePanel");
const authForm = document.querySelector("#authForm");
const loginTab = document.querySelector("#loginTab");
const signupTab = document.querySelector("#signupTab");
const authSubmit = document.querySelector("#authSubmit");
const authMessage = document.querySelector("#authMessage");
const usernameInput = document.querySelector("#usernameInput");
const passwordInput = document.querySelector("#passwordInput");
const signedInAs = document.querySelector("#signedInAs");
const logoutButton = document.querySelector("#logoutButton");
const walletButton = document.querySelector("#walletButton");
const walletLabel = document.querySelector("#walletLabel");
const contractLabel = document.querySelector("#contractLabel");
const stakeInput = document.querySelector("#stakeInput");
const startButton = document.querySelector("#queueButton");
const newBoardButton = document.querySelector("#cancelQueueButton");
const playersList = document.querySelector("#playersList");
const gameStatus = document.querySelector("#gameStatus");
const wagerStatus = document.querySelector("#wagerStatus");
const settleButton = document.querySelector("#createWagerButton");
const refundButton = document.querySelector("#joinWagerButton");
const resetButton = document.querySelector("#reportResultButton");
const board = document.querySelector("#board");
const columnControls = document.querySelector("#columnControls");
const leaderboard = document.querySelector("#leaderboard");

const ROWS = 6;
const COLS = 7;
const SEPOLIA_CHAIN_ID = 11155111;
const SEPOLIA_CHAIN_ID_HEX = "0xaa36a7";
const SAVED_CONTRACT_KEY = "connect4LocalContractAddress";

let mode = "login";
let token = localStorage.getItem("connect4Token");
let user = null;
let walletAddress = "";
let contractConfig = { contractAddress: "", contractAbi: [], contractBytecode: "" };
let currentGame = null;

init();

async function init() {
  buildBoard();
  bindEvents();
  await loadContractConfig();

  if (token) {
    try {
      const data = await api("/api/me");
      user = data.user;
      walletAddress = user.walletAddress || "";
      showGame();
    } catch (_error) {
      localStorage.removeItem("connect4Token");
      token = null;
    }
  }
}

function bindEvents() {
  loginTab.addEventListener("click", () => setMode("login"));
  signupTab.addEventListener("click", () => setMode("signup"));
  authForm.addEventListener("submit", handleAuth);
  logoutButton.addEventListener("click", logout);
  walletButton.addEventListener("click", connectWallet);
  startButton.addEventListener("click", startLocalWager);
  newBoardButton.addEventListener("click", resetBoard);
  settleButton.addEventListener("click", settleFinishedWager);
  refundButton.addEventListener("click", refundDraw);
  resetButton.addEventListener("click", resetBoard);
}

function setMode(nextMode) {
  mode = nextMode;
  loginTab.classList.toggle("active", mode === "login");
  signupTab.classList.toggle("active", mode === "signup");
  authSubmit.textContent = mode === "login" ? "Log In" : "Create Account";
  passwordInput.autocomplete = mode === "login" ? "current-password" : "new-password";
  authMessage.textContent = "";
}

async function handleAuth(event) {
  event.preventDefault();
  authMessage.textContent = "";

  try {
    const data = await api(`/api/${mode === "login" ? "login" : "signup"}`, {
      method: "POST",
      body: JSON.stringify({
        username: usernameInput.value,
        password: passwordInput.value,
      }),
    });

    token = data.token;
    user = data.user;
    walletAddress = user.walletAddress || "";
    localStorage.setItem("connect4Token", token);
    authForm.reset();
    showGame();
  } catch (error) {
    authMessage.textContent = error.message;
  }
}

function showGame() {
  authPanel.classList.add("hidden");
  gamePanel.classList.remove("hidden");
  signedInAs.textContent = `Signed in as ${user.username}`;
  walletLabel.textContent = walletAddress ? shortAddress(walletAddress) : "Not connected";
  renderPlayers();
  renderBoard();
  loadLeaderboard();
}

function logout() {
  token = null;
  user = null;
  currentGame = null;
  localStorage.removeItem("connect4Token");
  gamePanel.classList.add("hidden");
  authPanel.classList.remove("hidden");
  resetBoard();
}

async function connectWallet() {
  if (!window.ethereum) {
    gameStatus.textContent = "MetaMask was not detected. Install it, then refresh this page.";
    return;
  }

  try {
    await ensureSepoliaNetwork();
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    walletAddress = ethers.utils.getAddress(accounts[0]);

    const data = await api("/api/me/wallet", {
      method: "PUT",
      body: JSON.stringify({ walletAddress }),
    });

    user = data.user;
    walletLabel.textContent = shortAddress(walletAddress);
    gameStatus.textContent = "Wallet connected. Start a wager when ready.";
    renderPlayers();
  } catch (error) {
    gameStatus.textContent = cleanWalletError(error);
  }
}

async function startLocalWager() {
  if (!walletAddress) {
    gameStatus.textContent = "Connect MetaMask before starting a wager.";
    return;
  }

  try {
    startButton.disabled = true;
    const stake = normalizeStake(stakeInput.value);
    const stakeWei = ethers.utils.parseEther(stake);
    const contract = await getOrDeployContract(stakeWei);

    wagerStatus.textContent = "Confirm the stake deposit in MetaMask.";
    await ensureCanAffordTransaction(contract, stakeWei);
    const tx = await contract.createLocalWager({ value: stakeWei });
    const receipt = await tx.wait();
    const created = receipt.events?.find((event) => event.event === "WagerCreated");
    const contractWagerId = created?.args?.wagerId?.toString();

    if (!contractWagerId) {
      throw new Error("The contract did not return a wager id.");
    }

    const data = await api("/api/local-games", {
      method: "POST",
      body: JSON.stringify({
        stakeEth: stake,
        contractAddress: contract.address,
        contractWagerId,
      }),
    });

    currentGame = {
      ...data.game,
      board: Array.from({ length: ROWS }, () => Array(COLS).fill(0)),
      turn: 1,
      moves: [],
      winnerColor: null,
      draw: false,
      settled: false,
    };

    gameStatus.textContent = "Your turn.";
    wagerStatus.textContent = `Stake locked in wager #${contractWagerId}.`;
    renderPlayers();
    renderBoard();
    updateControls();
  } catch (error) {
    startButton.disabled = false;
    wagerStatus.textContent = cleanWalletError(error);
  }
}

function buildBoard() {
  columnControls.innerHTML = Array.from({ length: COLS }, (_, col) => {
    return `<button class="column-button" type="button" data-col="${col}" aria-label="Drop in column ${col + 1}">Drop</button>`;
  }).join("");

  board.innerHTML = Array.from({ length: ROWS * COLS }, (_, index) => {
    const row = Math.floor(index / COLS);
    const col = index % COLS;
    return `<div class="cell" data-row="${row}" data-col="${col}"></div>`;
  }).join("");

  columnControls.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-col]");
    if (!button || !currentGame || currentGame.winnerColor || currentGame.draw) return;
    dropDisc(Number(button.dataset.col));
  });
}

function dropDisc(col) {
  const row = placeDisc(currentGame.board, col, currentGame.turn);
  if (row === -1) return;

  currentGame.moves.push({
    row,
    col,
    color: currentGame.turn,
    player: currentGame.turn === 1 ? user.username : "Local Opponent",
    at: new Date().toISOString(),
  });

  if (hasWinner(currentGame.board, row, col, currentGame.turn)) {
    currentGame.winnerColor = currentGame.turn;
    gameStatus.textContent = currentGame.turn === 1 ? "You won. Settle to return your stake." : "You lost. Settle to hold the stake.";
  } else if (currentGame.board[0].every(Boolean)) {
    currentGame.draw = true;
    gameStatus.textContent = "Draw game. Refund the stake.";
  } else {
    currentGame.turn = currentGame.turn === 1 ? 2 : 1;
    gameStatus.textContent = currentGame.turn === 1 ? "Your turn." : "Local opponent's turn.";
  }

  renderBoard();
  updateControls();
}

async function settleFinishedWager() {
  if (!currentGame || !currentGame.winnerColor) return;

  try {
    const playerWon = currentGame.winnerColor === 1;
    const contract = await getContract(currentGame.contractAddress);
    wagerStatus.textContent = "Confirm settlement in MetaMask.";
    const tx = await contract.settleLocalWager(currentGame.contractWagerId, playerWon);
    await tx.wait();

    await api(`/api/local-games/${currentGame.roomId}/finish`, {
      method: "POST",
      body: JSON.stringify({ playerWon, moves: currentGame.moves }),
    });

    currentGame.settled = true;
    wagerStatus.textContent = playerWon ? "Stake returned to your wallet." : "Stake is held in the contract.";
    updateControls();
    loadLeaderboard();
  } catch (error) {
    wagerStatus.textContent = cleanWalletError(error);
  }
}

async function refundDraw() {
  if (!currentGame || !currentGame.draw) return;

  try {
    const contract = await getContract(currentGame.contractAddress);
    wagerStatus.textContent = "Confirm refund in MetaMask.";
    const tx = await contract.cancelLocalWager(currentGame.contractWagerId);
    await tx.wait();

    await api(`/api/local-games/${currentGame.roomId}/finish`, {
      method: "POST",
      body: JSON.stringify({ playerWon: null, moves: currentGame.moves }),
    });

    currentGame.settled = true;
    wagerStatus.textContent = "Draw refunded.";
    updateControls();
    loadLeaderboard();
  } catch (error) {
    wagerStatus.textContent = cleanWalletError(error);
  }
}

function resetBoard() {
  currentGame = null;
  startButton.disabled = false;
  gameStatus.textContent = walletAddress ? "Start a wager when ready." : "Connect wallet, then start a wager";
  wagerStatus.textContent = "The stake is deposited before the board starts.";
  renderPlayers();
  renderBoard();
  updateControls();
}

function renderBoard() {
  const boardState = currentGame?.board || Array.from({ length: ROWS }, () => Array(COLS).fill(0));

  document.querySelectorAll(".cell").forEach((cell) => {
    const row = Number(cell.dataset.row);
    const col = Number(cell.dataset.col);
    cell.className = `cell ${boardState[row][col] ? `player-${boardState[row][col]}` : ""}`;
  });

  updateControls();
}

function renderPlayers() {
  playersList.innerHTML = `
    ${renderPlayer(user?.username || "Player", walletAddress, 1)}
    ${renderPlayer("Local Opponent", "", 2)}
  `;
}

function renderPlayer(name, address, color) {
  const tokenClass = color === 1 ? "red" : "yellow";
  return `
    <div class="player-row">
      <span class="disc-token ${tokenClass}"></span>
      <div>
        <strong>${escapeHtml(name)}</strong>
        <span class="wallet-small">${address ? shortAddress(address) : "Local seat"}</span>
      </div>
    </div>
  `;
}

function updateControls() {
  const active = Boolean(currentGame && !currentGame.winnerColor && !currentGame.draw);
  const finished = Boolean(currentGame?.winnerColor);
  const draw = Boolean(currentGame?.draw);
  const settled = Boolean(currentGame?.settled);

  stakeInput.disabled = Boolean(currentGame);
  startButton.disabled = Boolean(currentGame) || !walletAddress;
  newBoardButton.disabled = !settled;
  settleButton.disabled = !(finished && !settled);
  refundButton.disabled = !(draw && !settled);
  resetButton.disabled = !settled;

  document.querySelectorAll(".column-button").forEach((button) => {
    button.disabled = !active;
  });
}

async function loadContractConfig() {
  contractConfig = await api("/api/config", {}, false);
  contractLabel.textContent = contractConfig.contractAddress
    ? shortAddress(contractConfig.contractAddress)
    : getSavedContractAddress()
      ? shortAddress(getSavedContractAddress())
      : contractConfig.contractBytecode
      ? "Deploy from MetaMask"
      : "Run npm run compile";
}

async function loadLeaderboard() {
  try {
    const data = await api("/api/leaderboard", {}, false);
    leaderboard.innerHTML = data.players
      .map(
        (player) => `
          <li>
            <strong>${escapeHtml(player.username)}</strong>
            <span>${player.gamesWon} wins, ${player.gamesLost} losses</span>
          </li>
        `
      )
      .join("");
  } catch (_error) {
    leaderboard.innerHTML = "<li>Leaderboard unavailable</li>";
  }
}

async function getOrDeployContract(stakeWei) {
  const configuredAddress = contractConfig.contractAddress || getSavedContractAddress();
  if (configuredAddress && await hasContractCode(configuredAddress)) {
    return getContract(configuredAddress);
  }

  if (!contractConfig.contractBytecode) {
    throw new Error("Contract bytecode is missing. Run npm run compile first.");
  }

  const provider = await getBrowserProvider();
  const factory = new ethers.ContractFactory(contractConfig.contractAbi, contractConfig.contractBytecode, provider.getSigner());
  await ensureCanAffordDeployment(provider, factory, stakeWei);
  wagerStatus.textContent = "Confirm contract deployment in MetaMask.";
  const contract = await factory.deploy();
  await contract.deployed();
  localStorage.setItem(SAVED_CONTRACT_KEY, contract.address);
  contractLabel.textContent = shortAddress(contract.address);
  return contract;
}

async function getContract(address) {
  const provider = await getBrowserProvider();
  return new ethers.Contract(address, contractConfig.contractAbi, provider.getSigner());
}

async function getBrowserProvider() {
  if (!window.ethereum) {
    throw new Error("MetaMask was not detected. Install it, then refresh this page.");
  }

  await ensureSepoliaNetwork();
  const provider = new ethers.providers.Web3Provider(window.ethereum);
  const accounts = await provider.send("eth_requestAccounts", []);
  const selected = ethers.utils.getAddress(accounts[0]);

  if (walletAddress && selected !== ethers.utils.getAddress(walletAddress)) {
    throw new Error(`MetaMask is on ${shortAddress(selected)}. Switch back to ${shortAddress(walletAddress)}.`);
  }

  return provider;
}

async function ensureSepoliaNetwork() {
  const chainId = await window.ethereum.request({ method: "eth_chainId" });
  if (chainId === SEPOLIA_CHAIN_ID_HEX) return;

  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: SEPOLIA_CHAIN_ID_HEX }],
    });
  } catch (error) {
    throw new Error("Switch MetaMask to Sepolia before starting a wager.");
  }
}

async function hasContractCode(address) {
  try {
    const provider = await getBrowserProvider();
    const network = await provider.getNetwork();
    if (network.chainId !== SEPOLIA_CHAIN_ID) return false;
    const code = await provider.getCode(address);
    return code && code !== "0x";
  } catch (_error) {
    return false;
  }
}

async function ensureCanAffordDeployment(provider, factory, stakeWei) {
  const signer = provider.getSigner();
  const address = await signer.getAddress();
  const balance = await provider.getBalance(address);
  const deployTx = factory.getDeployTransaction();
  const deployGas = await provider.estimateGas({ ...deployTx, from: address });
  const feeData = await provider.getFeeData();
  const gasPrice = feeData.maxFeePerGas || feeData.gasPrice || ethers.utils.parseUnits("30", "gwei");
  const wagerGasBuffer = ethers.BigNumber.from(180000);
  const required = stakeWei.add(deployGas.add(wagerGasBuffer).mul(gasPrice));

  if (balance.lt(required)) {
    throw new Error(`Not enough Sepolia ETH. Balance ${formatEth(balance)}, estimated need ${formatEth(required)} including deployment gas and stake.`);
  }
}

async function ensureCanAffordTransaction(contract, stakeWei) {
  const provider = await getBrowserProvider();
  const signer = provider.getSigner();
  const address = await signer.getAddress();
  const balance = await provider.getBalance(address);
  const gas = await contract.estimateGas.createLocalWager({ value: stakeWei });
  const feeData = await provider.getFeeData();
  const gasPrice = feeData.maxFeePerGas || feeData.gasPrice || ethers.utils.parseUnits("30", "gwei");
  const required = stakeWei.add(gas.mul(gasPrice));

  if (balance.lt(required)) {
    throw new Error(`Not enough Sepolia ETH. Balance ${formatEth(balance)}, estimated need ${formatEth(required)} for stake plus gas.`);
  }
}

function getSavedContractAddress() {
  const address = localStorage.getItem(SAVED_CONTRACT_KEY) || "";
  return /^0x[a-fA-F0-9]{40}$/.test(address) ? address : "";
}

function formatEth(value) {
  return `${Number(ethers.utils.formatEther(value)).toFixed(6)} SepoliaETH`;
}

function placeDisc(boardState, col, color) {
  for (let row = ROWS - 1; row >= 0; row -= 1) {
    if (!boardState[row][col]) {
      boardState[row][col] = color;
      return row;
    }
  }
  return -1;
}

function hasWinner(boardState, row, col, color) {
  return (
    countDirection(boardState, row, col, 0, 1, color) + countDirection(boardState, row, col, 0, -1, color) - 1 >= 4 ||
    countDirection(boardState, row, col, 1, 0, color) + countDirection(boardState, row, col, -1, 0, color) - 1 >= 4 ||
    countDirection(boardState, row, col, 1, 1, color) + countDirection(boardState, row, col, -1, -1, color) - 1 >= 4 ||
    countDirection(boardState, row, col, 1, -1, color) + countDirection(boardState, row, col, -1, 1, color) - 1 >= 4
  );
}

function countDirection(boardState, row, col, rowStep, colStep, color) {
  let count = 0;
  let currentRow = row;
  let currentCol = col;

  while (
    currentRow >= 0 &&
    currentRow < ROWS &&
    currentCol >= 0 &&
    currentCol < COLS &&
    boardState[currentRow][currentCol] === color
  ) {
    count += 1;
    currentRow += rowStep;
    currentCol += colStep;
  }

  return count;
}

async function api(path, options = {}, includeToken = true) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (includeToken && token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(path, { ...options, headers });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Request failed.");
  }

  return data;
}

function normalizeStake(value) {
  const stake = Number(value);
  if (!Number.isFinite(stake) || stake < 0.0001 || stake > 10) {
    throw new Error("Enter a stake between 0.0001 and 10 test ETH.");
  }
  return stake.toFixed(4);
}

function shortAddress(address) {
  if (!address) return "Not connected";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function cleanWalletError(error) {
  if (error?.code === 4001) return "MetaMask request was rejected.";
  return error?.reason || error?.data?.message || error?.message || "MetaMask request failed.";
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
