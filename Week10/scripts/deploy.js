async function main() {
    const HelloWorld = await ethers.getContractFactory("HelloWorld");
    
    //Start deployment, returning a promise that resolves to a contract object
    
    const hello_world = await HelloWorld.deploy("Hello World!");
    await hello_world.deployed();
    console.log("HelloWorld deployed to:", hello_world.address);
}
main()
    .then(() => process.exit(0))
    .catch((error) => {
    console.error(error);
    process.exit(1);
});