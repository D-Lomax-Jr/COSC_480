require("dotenv").config({ quiet: true });

const path = require("path");
const fs = require("fs");
const http = require("http");
const crypto = require("crypto");
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Sequelize, DataTypes, Op } = require("sequelize");

const app = express();
const server = http.createServer(app);

const PORT = Number(process.env.PORT) || 3000;
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString("hex");
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || "";
const CONTRACT_BYTECODE = readContractBytecode();

let sequelize;
let User;
let LocalGame;

const contractAbi = [
  "event WagerCreated(uint256 indexed wagerId, address indexed player, uint256 stake)",
  "event WagerSettled(uint256 indexed wagerId, address indexed player, bool playerWon, uint256 payout)",
  "event WagerCancelled(uint256 indexed wagerId, address indexed player, uint256 refund)",
  "function createLocalWager() external payable returns (uint256 wagerId)",
  "function settleLocalWager(uint256 wagerId, bool playerWon) external",
  "function cancelLocalWager(uint256 wagerId) external",
  "function wagers(uint256) view returns (address player, uint256 stake, uint8 status)",
];

app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));
app.get("/vendor/ethers.umd.min.js", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "node_modules", "ethers", "dist", "ethers.umd.min.js"));
});

function signUser(user) {
  return jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: "8h" });
}

function publicUser(user) {
  const plainUser = typeof user.get === "function" ? user.get({ plain: true }) : user;
  return {
    id: plainUser.id,
    username: plainUser.username,
    walletAddress: plainUser.walletAddress || plainUser.wallet_address || null,
    gamesWon: Number(plainUser.gamesWon ?? plainUser.games_won ?? plainUser.wins ?? 0),
    gamesLost: Number(plainUser.gamesLost ?? plainUser.games_lost ?? plainUser.losses ?? 0),
  };
}

function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

async function authenticateHttp(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await User.findByPk(payload.id);

    if (!user) {
      return res.status(401).json({ error: "Account not found." });
    }

    req.user = user;
    next();
  } catch (_error) {
    res.status(401).json({ error: "Please log in again." });
  }
}

async function initDatabase() {
  sequelize = new Sequelize(
    process.env.DB_DATABASE,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT) || 3306,
      dialect: process.env.DB_DIALECT || "mysql",
      logging: false,
      define: {
        underscored: true,
        timestamps: false,
      },
    }
  );

  await sequelize.authenticate();
  const statsColumns = await detectUserStatsColumns();
  defineModels(statsColumns);
  await User.sync();
  await LocalGame.sync();
}

async function detectUserStatsColumns() {
  try {
    const columns = await sequelize.getQueryInterface().describeTable("users");
    return {
      wins: columns.games_won ? "games_won" : "wins",
      losses: columns.games_lost ? "games_lost" : "losses",
    };
  } catch (_error) {
    return { wins: "games_won", losses: "games_lost" };
  }
}

function defineModels(statsColumns) {
  User = sequelize.define(
    "User",
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      username: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true,
      },
      passwordHash: {
        type: DataTypes.STRING(255),
        allowNull: false,
        field: "password_hash",
      },
      walletAddress: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: "wallet_address",
      },
      gamesWon: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: statsColumns.wins,
      },
      gamesLost: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: statsColumns.losses,
      },
    },
    {
      tableName: "users",
      createdAt: "created_at",
      updatedAt: false,
      timestamps: true,
    }
  );

  LocalGame = sequelize.define(
    "LocalGame",
    {
      id: {
        type: DataTypes.BIGINT,
        autoIncrement: true,
        primaryKey: true,
      },
      roomId: {
        type: DataTypes.STRING(64),
        allowNull: false,
        unique: true,
        field: "room_id",
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "user_id",
      },
      walletAddress: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: "wallet_address",
      },
      stakeEth: {
        type: DataTypes.DECIMAL(18, 8),
        allowNull: false,
        defaultValue: 0,
        field: "stake_eth",
      },
      contractAddress: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: "contract_address",
      },
      contractWagerId: {
        type: DataTypes.STRING(80),
        allowNull: true,
        field: "contract_wager_id",
      },
      playerWon: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        field: "player_won",
      },
      status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: "active",
      },
      movesJson: {
        type: DataTypes.TEXT("long"),
        allowNull: true,
        field: "moves_json",
      },
      startedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: "started_at",
        defaultValue: Sequelize.NOW,
      },
      endedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: "ended_at",
      },
    },
    {
      tableName: "local_games",
      timestamps: false,
    }
  );
}

app.post("/api/signup", asyncHandler(async (req, res) => {
  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "");

  if (username.length < 3 || username.length > 50) {
    return res.status(400).json({ error: "Username must be 3-50 characters." });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters." });
  }

  try {
    const user = await User.create({
      username,
      passwordHash: await bcrypt.hash(password, 12),
      gamesWon: 0,
      gamesLost: 0,
    });

    res.status(201).json({ token: signUser(user), user: publicUser(user) });
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({ error: "That username is already taken." });
    }
    throw error;
  }
}));

app.post("/api/login", asyncHandler(async (req, res) => {
  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "");
  const user = await User.findOne({ where: { username } });

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: "Invalid username or password." });
  }

  res.json({ token: signUser(user), user: publicUser(user) });
}));

app.get("/api/me", authenticateHttp, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

app.put("/api/me/wallet", authenticateHttp, asyncHandler(async (req, res) => {
  const walletAddress = String(req.body.walletAddress || "").trim();

  if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
    return res.status(400).json({ error: "Please connect a valid Ethereum wallet." });
  }

  req.user.walletAddress = walletAddress;
  await req.user.save();
  res.json({ user: publicUser(req.user) });
}));

app.get("/api/leaderboard", asyncHandler(async (_req, res) => {
  const players = await User.findAll({
    attributes: ["id", "username", "walletAddress", "gamesWon", "gamesLost"],
    order: [
      ["gamesWon", "DESC"],
      ["gamesLost", "ASC"],
      ["username", "ASC"],
    ],
    limit: 20,
  });

  res.json({ players: players.map(publicUser) });
}));

app.get("/api/config", (_req, res) => {
  res.json({ contractAddress: CONTRACT_ADDRESS, contractAbi, contractBytecode: CONTRACT_BYTECODE });
});

app.post("/api/local-games", authenticateHttp, asyncHandler(async (req, res) => {
  const stake = normalizeStake(req.body.stakeEth);
  const contractAddress = String(req.body.contractAddress || "").trim();
  const contractWagerId = String(req.body.contractWagerId || "").trim();

  if (stake === null) {
    return res.status(400).json({ error: "Enter a stake between 0.0001 and 10 test ETH." });
  }

  if (!req.user.walletAddress) {
    return res.status(400).json({ error: "Connect your wallet before starting a wager." });
  }

  if (!/^0x[a-fA-F0-9]{40}$/.test(contractAddress) || !contractWagerId) {
    return res.status(400).json({ error: "A deployed contract wager is required." });
  }

  const localGame = await LocalGame.create({
    roomId: crypto.randomUUID(),
    userId: req.user.id,
    walletAddress: req.user.walletAddress,
    stakeEth: stake,
    contractAddress,
    contractWagerId,
    status: "active",
  });

  res.status(201).json({
    game: {
      id: localGame.id,
      roomId: localGame.roomId,
      stakeEth: localGame.stakeEth,
      contractAddress: localGame.contractAddress,
      contractWagerId: localGame.contractWagerId,
      status: localGame.status,
    },
  });
}));

app.post("/api/local-games/:roomId/finish", authenticateHttp, asyncHandler(async (req, res) => {
  const roomId = String(req.params.roomId || "");
  const playerWon = req.body.playerWon === null ? null : Boolean(req.body.playerWon);
  const moves = Array.isArray(req.body.moves) ? req.body.moves : [];

  const localGame = await LocalGame.findOne({
    where: {
      roomId,
      userId: req.user.id,
      status: "active",
    },
  });

  if (!localGame) {
    return res.status(404).json({ error: "Active local game not found." });
  }

  await sequelize.transaction(async (transaction) => {
    if (playerWon === true) {
      await req.user.increment("gamesWon", { by: 1, transaction });
    } else if (playerWon === false) {
      await req.user.increment("gamesLost", { by: 1, transaction });
    }

    await localGame.update(
      {
        playerWon,
        status: playerWon === null ? "draw" : "finished",
        movesJson: JSON.stringify(moves),
        endedAt: new Date(),
      },
      { transaction }
    );
  });

  res.json({ ok: true });
}));

function normalizeStake(value) {
  const stake = Number(value);
  if (!Number.isFinite(stake) || stake < 0.0001 || stake > 10) return null;
  return stake.toFixed(4);
}

function readContractBytecode() {
  try {
    const artifactPath = path.join(__dirname, "..", "artifacts", "contracts", "Connect4.sol", "Connect4.json");
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    return artifact.bytecode || "";
  } catch (_error) {
    return "";
  }
}

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: "Server error. Please try again." });
});

initDatabase()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`Connect 4 app running at http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Unable to start the app:", error);
    process.exit(1);
  });
