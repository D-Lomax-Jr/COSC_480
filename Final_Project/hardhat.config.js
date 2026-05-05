require("dotenv").config({ quiet: true });
require("@nomiclabs/hardhat-ethers");

const { API_URL, PRIVATE_KEY } = process.env;
const sepolia = API_URL && PRIVATE_KEY ? {
   url: API_URL,
   accounts: [`0x${PRIVATE_KEY.replace(/^0x/, "")}`]
} : {
   url: API_URL || "",
   accounts: []
};

module.exports = {
   solidity: "0.8.28",
   defaultNetwork: "sepolia",
   networks: {
      hardhat: {},
      sepolia
   },
};
