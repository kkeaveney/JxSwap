const SushiToken = artifacts.require("SushiToken")
const MasterChef = artifacts.require("MasterChef")

require('chai')
    .use(require('chai-as-promised'))
    .should()

contract('MasterChef', ([deployer, user1]) => {
    let token
    let masterChef

    beforeEach(async () => {
        
        // Deploy Token
        token = await SushiToken.new()

        // Deploy MasterChef
        masterChef = await MasterChef.new(
            token.address,
            process.env.DEV_ADDRESS, // Your address where you get Sushi tokens
            web3.utils.toWei(process.env.TOKENS_PER_BLOCK), // Number of tokens rewarded
            process.env.BONUS_END_BLOCK,
            process.env.START_BLOCK, // Block number when token mining starts
            )
            await token.transferOwnerShip(masterChef.address)
    })
})