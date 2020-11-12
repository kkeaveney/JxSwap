const { waitForTxSuccess } = require('../src/utils')

const SushiToken = artifacts.require('SushiToken.sol')
const MasterChef = artifacts.require('MasterChef.sol')
const { expectRevert } = require('@openzeppelin/test-helpers')
const { inTransaction } = require('@openzeppelin/test-helpers/src/expectEvent')
const { assertion } = require('@openzeppelin/test-helpers/src/expectRevert')

require('chai')
    .use(require('chai-as-promised'))
    .should()

    let sushi

    contract('SushiToken', ([owner, user1, user2]) => {
        beforeEach(async () => {
            sushi = await SushiToken.new({ from: owner })
        })
        
        it('should have correct name, symbol and decimal', async () => {
            const name = await sushi.name()
            const symbol = await sushi.symbol()
            const decimals = await sushi.decimals()
            assert.equal(name.valueOf(), 'SushiToken')
            assert.equal(symbol.valueOf(), 'SUSHI')
            assert.equal(decimals.valueOf(), '18')

        })

        it('should only allow the owner to mint a token', async () => {
            await sushi.mint(owner, '100', { from : owner})
            await sushi.mint(user1, '1000', { from : owner })
            await expectRevert(
                sushi.mint(user2, '100', { from : user1 }), 'Ownable: caller is not the owner'
            )
            const totalSupply = await sushi.totalSupply()
            const ownerBal = await sushi.balanceOf(owner)
            const user1Bal = await sushi.balanceOf(user1)
            const user2Bal = await sushi.balanceOf(user2)
            assert.equal(totalSupply.valueOf(),'1100')
            assert.equal(ownerBal.valueOf(), '100')
            assert.equal(user1Bal.valueOf(), '1000')
            assert.equal(user2Bal.valueOf(), '0')
        })

        it('should transfer tokens correctly', async () => {
            await sushi.mint(owner, '100', { from: owner })
            await sushi.mint(user1, '1000', { from: owner })
            await sushi.transfer(user2, '10', { from: owner })
            await sushi.transfer(user2, '100', { from: user1 })
            const totalSupply = await sushi.totalSupply()
            const ownerBal = await sushi.balanceOf(owner)
            const user1Bal = await sushi.balanceOf(user1)
            const user2Bal = await sushi.balanceOf(user2)
            assert.equal(totalSupply.valueOf(), '1100')
            assert.equal(ownerBal.valueOf(), '90')
            assert.equal(user1Bal.valueOf(), '900')
            assert.equal(user2Bal.valueOf(), '110')        
        })

        it('should fail with non-owner minting', async () => {
            await sushi.mint(owner, '100', { from: owner })
            await expectRevert(
                sushi.transfer(owner, '1', { from: user1 }),
                'ERC20: transfer amount exceeds balance'
            )
        })
    })

