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

         it('should properly distribute Sushi to each Staker', async () => {
            // 100 per block farming rate starting at block 300 with bonus until block 1000
            this.chef = await MasterChef.new(this.sushi.address, dev, '100', '300', '1000', { from: owner })
            await this.sushi.transferOwnership(this.chef.address, { from: owner })
            await this.chef.add('100', this.lp.address, true)
            await this.lp.approve(this.chef.address, '1000', { from: owner })
            await this.lp.approve(this.chef.address, '1000', { from: user1 })
            await this.lp.approve(this.chef.address, '1000', { from: user2 })
            // Owner deposits 10 Lps at block 310
            await time.advanceBlockTo('309')
            await this.chef.deposit(0, '10', { from: owner })
            
            // User1 deposits 20 Lps at block 314
            await time.advanceBlockTo('313')
            await this.chef.deposit(0, '20', { from: user1 })
            
            // User 2 deposits 30 Lps at block 318
            await time.advanceBlockTo('317')
            await this.chef.deposit(0, '30', { from: user2 })
             // Owner deposits 10 more LPs at block 320. At this point:
            //   Owner should have: 4*1000 + 4*1/3*1000 + 2*1/6*1000 = 5666
            //   MasterChef should have the remaining: 10000 - 5666 = 4334
            await time.advanceBlockTo('319')
            await this.chef.deposit(0, '10', { from: owner })
            assert.equal((await this.sushi.totalSupply()).valueOf(), '11000')
            assert.equal((await this.sushi.balanceOf(owner)).valueOf(), '5666')
            assert.equal((await this.sushi.balanceOf(user1)).valueOf(), '0')
            assert.equal((await this.sushi.balanceOf(user2)).valueOf(), '0')
            assert.equal((await this.sushi.balanceOf(this.chef.address)).valueOf(), '4334')
            assert.equal((await this.sushi.balanceOf(dev)).valueOf(), '1000')
             // User1 withdraws 5 LPs at block 330. At this point:
            //   User1 should have: 4*2/3*1000 + 2*2/6*1000 + 10*2/7*1000 = 6190
            await time.advanceBlockTo('329')
            await this.chef.withdraw(0, '5', { from: user1 })
            assert.equal((await this.sushi.totalSupply()).valueOf(), '22000')
            assert.equal((await this.sushi.balanceOf(owner)).valueOf(), '5666')
            assert.equal((await this.sushi.balanceOf(user1)).valueOf(), '6190')
            assert.equal((await this.sushi.balanceOf(user2)).valueOf(), '0')
            assert.equal((await this.sushi.balanceOf(this.chef.address)).valueOf(), '8144')
            assert.equal((await this.sushi.balanceOf(dev)).valueOf(), '2000')
            // owner withdraws 20 LPs at block 340
            // user1 withdraws 15 LPs at block 350
            // user2 withdraws 30 LPs at block 360
            await time.advanceBlockTo('339')
            await this.chef.withdraw(0, '20', { from: owner })
            await time.advanceBlockTo('349')
            await this.chef.withdraw(0, '15', { from: user1 })
            await time.advanceBlockTo('359')
            await this.chef.withdraw(0, '30', { from: user2 })
            assert.equal((await this.sushi.totalSupply()).valueOf(), '55000')
            assert.equal((await this.sushi.balanceOf(dev)).valueOf(), '5000')
             // owner should have: 5666 + 10*2/7*1000 + 10*2/6.5*1000 = 11600
            assert.equal((await this.sushi.balanceOf(owner)).valueOf(), '11600')
            // user1 should have: 6190 + 10*1.5/6.5 * 1000 + 10*1.5/4.5*1000 = 11831
            assert.equal((await this.sushi.balanceOf(user1)).valueOf(), '11831')
            // user2 should have: 2*3/6*1000 + 10*3/7*1000 + 10*3/6.5*1000 + 10*3/4.5*1000 + 10*1000 = 26568
            assert.equal((await this.sushi.balanceOf(user2)).valueOf(), '26568')
            // All of them should have 1000 LPs back.
            assert.equal((await this.lp.balanceOf(owner)).valueOf(), '1000')
            assert.equal((await this.lp.balanceOf(user1)).valueOf(), '1000')
            assert.equal((await this.lp.balanceOf(user2)).valueOf(), '1000')        
         })

         it('should give proper SUSHIS allocation to each pool', async () => {
            // 100 per block farming rate starting at block 400 with bonus until block 1000
            this.chef = await MasterChef.new(this.sushi.address, dev, '100', '400', '1000', { from: owner });
            await this.sushi.transferOwnership(this.chef.address, { from: owner })
            await this.lp.approve(this.chef.address, '1000', { from: owner })
            await this.lp2.approve(this.chef.address, '1000', { from: user1 })
            // Add first LP to the pool with allocation 1
            await this.chef.add('10', this.lp.address, true)
            // owner deposits 10 LPs at block 410
            await time.advanceBlockTo('409')
            await this.chef.deposit(0, '10', { from: owner })
            // Add LP2 to the pool with allocation 2 at block 420
            await time.advanceBlockTo('419')
            await this.chef.add('20', this.lp2.address, true)
            // owner should have 10*1000 pening reward
            assert.equal((await this.chef.pendingSushi(0, owner)).valueOf(), '10000')
            // user1 deposits 10 LP2s at block 425
            await time.advanceBlockTo('424')
            await this.chef.deposit(1, '5', { from: user1 })
            // owner should have 10000 + 5*1/3*1000 = 11666 pending reward
            assert.equal((await this.chef.pendingSushi(0, owner)).valueOf(), '11666')
            await time.advanceBlockTo('430')
            // At block 430. Bob should get 5*2/3*1000 = 3333. Alice should get ~1666 more.
            assert.equal((await this.chef.pendingSushi(0, owner)).valueOf(), '13333')
            assert.equal((await this.chef.pendingSushi(1, user1)).valueOf(), '3333')
        })

        it('should stop giving bonus SUSHIs after the bonus period ends', async () => {
            // 100 per block farming rate starting at block 500 with bonus until block 600
            this.chef = await MasterChef.new(this.sushi.address, dev, '100', '500', '600' , { from: owner })
            await this.sushi.transferOwnership(this.chef.address, { from: owner })
            await this.lp.approve(this.chef.address, '1000', { from: owner })
            await this.chef.add('1', this.lp.address, true)
            // owner deposits 10 LPs at block 590
            await time.advanceBlockTo('589')
            await this.chef.deposit(0, '10', { from: owner })
            // At block 605, owner  should have 1000*10 + 100*5 = 10500 pending.
            await time.advanceBlockTo('605')
            assert.equal((await this.chef.pendingSushi(0, owner)).valueOf(), '10500')
             // At block 606, owner withdraws all pending rewards and should get 10600.
            await this.chef.deposit(0, '0', { from: owner })
            assert.equal((await this.chef.pendingSushi(0, owner)).valueOf(), '0')
            assert.equal((await this.sushi.balanceOf(owner)).valueOf(), '10600')

        })
    })
})