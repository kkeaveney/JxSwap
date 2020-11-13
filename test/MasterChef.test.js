const { expectRevert, time } = require('@openzeppelin/test-helpers')
const { inTransaction } = require('@openzeppelin/test-helpers/src/expectEvent')
const { assertion } = require('@openzeppelin/test-helpers/src/expectRevert')
const SushiToken = artifacts.require('SushiToken')
const MasterChef = artifacts.require('MasterChef')
const MockERC20 = artifacts.require('MockERC20')

 

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

    context('With ERC/LP token added to the field', () => {
        beforeEach(async () => {
            this.lp = await MockERC20.new('LPToken', 'LP', '10000000000', { from: minter })
            await this.lp.transfer(owner, '1000', { from: minter })
            await this.lp.transfer(user1, '1000', { from: minter })
            await this.lp.transfer(user2, '1000', { from: minter })
            this.lp2 = await MockERC20.new('LPToken2', 'LP2', '10000000000', { from: minter })
            await this.lp2.transfer(owner, '1000', { from: minter })
            await this.lp2.transfer(user1, '1000', { from: minter })
            await this.lp2.transfer(user2, '1000', { from: minter })
        })
    
        it('should allow emergency withdraw', async () => {
            this.chef = await MasterChef.new(this.sushi.address, dev, '100', '100', '1000', { from: owner })
            await this.chef.add('100', this.lp.address, true)
            await this.lp.approve(this.chef.address, '1000', { from: user1 })
            await this.chef.deposit(0, '100', { from: user1 })
            assert.equal((await this.lp.balanceOf(user1)).valueOf(), '900')
            await this.chef.emergencyWithdraw(0, { from: user1 })
            assert.equal((await this.lp.balanceOf(user1)).valueOf(), '1000')        
        })

        it('should give out SUSHIs only after farming time', async () => {
             // 100 per block farming rate starting at block 100 with bonus until block 1000       
            this.chef = await MasterChef.new(this.sushi.address, dev, '100', '100', '1000', { from: owner });
            await this.sushi.transferOwnership(this.chef.address, { from: owner });
            await this.chef.add('100', this.lp.address, true);
            await this.lp.approve(this.chef.address, '1000', { from: user1 });
            await this.chef.deposit(0, '100', { from: user1 });
            await time.advanceBlockTo('89');
            await this.chef.deposit(0, '0', { from: user1 }); // block 90
            assert.equal((await this.sushi.balanceOf(user1)).valueOf(), '0');
            await time.advanceBlockTo('94');
            await this.chef.deposit(0, '0', { from: user1 }); // block 95
            assert.equal((await this.sushi.balanceOf(user1)).valueOf(), '0');
            await time.advanceBlockTo('99');
            await this.chef.deposit(0, '0', { from: user1 }); // block 100
            assert.equal((await this.sushi.balanceOf(user1)).valueOf(), '0');
            await time.advanceBlockTo('100');
            await this.chef.deposit(0, '0', { from: user1 }); // block 101
            assert.equal((await this.sushi.balanceOf(user1)).valueOf(), '1000');
            await time.advanceBlockTo('104')
            await this.chef.deposit(0, '0', { from: user1 }); // block 105
            assert.equal((await this.sushi.balanceOf(user1)).valueOf(), '5000')
            assert.equal((await this.sushi.balanceOf(dev)).valueOf(), '500')
            assert.equal((await this.sushi.totalSupply()).valueOf(), '5500')
         })

         it('should only ditribute Sushis if a deposit has been made', async () => {
            // 100 per block farming rate starting at block 200 with bonus until block 1000
            this.chef = await MasterChef.new(this.sushi.address, dev, '100', '200', '1000', { from: owner });
            await this.sushi.transferOwnership(this.chef.address, { from: owner });
            await this.chef.add('100', this.lp.address, true);
            await this.lp.approve(this.chef.address, '1000', { from: user1 });
            await time.advanceBlockTo('199');
            assert.equal((await this.sushi.totalSupply()).valueOf(), '0');
            await time.advanceBlockTo('204');
            assert.equal((await this.sushi.totalSupply()).valueOf(), '0');
            await time.advanceBlockTo('209');
            await this.chef.deposit(0, '10', { from: user1 }); // block 210
            assert.equal((await this.sushi.totalSupply()).valueOf(), '0');
            assert.equal((await this.sushi.balanceOf(user1)).valueOf(), '0');
            assert.equal((await this.sushi.balanceOf(dev)).valueOf(), '0');
            assert.equal((await this.lp.balanceOf(user1)).valueOf(), '990');
            await time.advanceBlockTo('219');
            await this.chef.withdraw(0, '10', { from: user1 }) // blockc 200
            assert.equal((await this.sushi.totalSupply()).valueOf(), '11000');
            assert.equal((await this.sushi.balanceOf(user1)).valueOf(), '10000');
            assert.equal((await this.sushi.balanceOf(dev)).valueOf(), '1000');
            assert.equal((await this.lp.balanceOf(user1)).valueOf(), '1000');
         })
    })
})