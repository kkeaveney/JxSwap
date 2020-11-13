const { expectRevert, time } = require('@openzeppelin/test-helpers')
const { inTransaction } = require('@openzeppelin/test-helpers/src/expectEvent')
const { assertion } = require('@openzeppelin/test-helpers/src/expectRevert')
const SushiToken = artifacts.require('SushiToken')
const MasterChef = artifacts.require('MasterChef')
const MockERC20 = artifacts.require('MockERC20')

let sushi
let chef    

contract('MasterChef', ([ owner, user1, user2, minter, dev ]) => {
    beforeEach(async () => {
        this.sushi = await SushiToken.new({ from: owner })
    })

    it('should set correct state variables', async () => {
        this.chef = await MasterChef.new(this.sushi.address, dev, '1000', '0', '1000', { from: owner})
        await this.sushi.transferOwnership(this.chef.address, { from: owner})

        // Confirm Chef is now the owner of the Sushi contract
        const sushi = await this.chef.sushi()
        const devaddr = await this.chef.devaddr()
        const sushiOwner = await this.sushi.owner()
        assert.equal(sushi.valueOf(), this.sushi.address)
        assert.equal(devaddr.valueOf(), dev)
        assert.equal(sushiOwner.valueOf(), this.chef.address) 
    })

    it('should allow the dev and only dev to update dev', async () => {
        this.chef = await MasterChef.new(this.sushi.address, dev, '1000', '0', '1000', { from: owner})
        assert.equal((await this.chef.devaddr()).valueOf(), dev)
        await expectRevert(this.chef.dev(user1, { from: user1}), 'dev: wut?')
        await this.chef.dev(user1, { from: dev})
        assert.equal((await this.chef.devaddr()).valueOf(), user1)
        await this.chef.dev(owner, { from: user1 })
        assert.equal((await this.chef.devaddr()).valueOf(), owner)        
    })


})