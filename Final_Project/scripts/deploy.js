async function main() {
    const Connect4 = await ethers.getContractFactory("Connect4");
    
    //Start deployment, returning a promise that resolves to a contract object
    
    const connect4 = await Connect4.deploy();
    await connect4.deployed();
    console.log("Connect4 deployed to:", connect4.address);
}
main()
    .then(() => process.exit(0))
    .catch((error) => {
    console.error(error);
    process.exit(1);
});
