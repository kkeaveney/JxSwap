const { expecRevert, time } = require('@openzeppelin/test-helpers')
const { inTransaction } = require('@openzeppelin/test-helpers/src/expectEvent')
const { assertion } = require('@openzeppelin/test-helpers/src/expectRevert')
const expectRevert = require('@openzeppelin/test-helpers/src/expectRevert')
const ethers = require('ethers')
const SushiToken = artifacts.require('SushiToken')
const MasterChef = artifacts.require('MasterChef')
const MockERC20 = artifacts.require('MockERC20')
const Timelock = artifacts.require('Timelock')

function encodeParameters(types, values) {
    const abi = new ethers.utils.AbiCoder()
    return abi.encode(types, values)
}

contract('Timelock', ( [ owner, user1, user2, dev, minter ]) => {
    beforeEach(async () => {
        this.sushi = await SushiToken.new({ from: owner })
        this.timelock = await Timelock.new( user1, '259200', { from: owner })
    })

    it('should not allow non-owner to do operation', async () => {
        await this.sushi.transferOwnership(this.timelock.address, { from: owner })
        await expectRevert(
            this.sushi.transferOwnership(user2, { from: user1 }), "Ownable: caller is not the owner ")
        await expectRevert(
                this.timelock.queueTransaction(
                    this.sushi.address, '0', 'transferOwnership(address)',
                    encodeParameters(['address'], [user2]),
                    (await time.latest()).add(time.duration.days(4)),
                    { from: owner },
                ),
                'Timelock::queueTransaction: Call must come from admin.',
            );
    })

    it('should do the timelock thing', async () => {
        await this.sushi.transferOwnership(this.timelock.address, { from: owner });
        const eta = (await time.latest()).add(time.duration.days(4));
        await this.timelock.queueTransaction(
            this.sushi.address, '0', 'transferOwnership(address)',
            encodeParameters(['address'], [user2]), eta, { from: user1 },
        );
        await time.increase(time.duration.days(1));
        await expectRevert(
            this.timelock.executeTransaction(
                this.sushi.address, '0', 'transferOwnership(address)',
                encodeParameters(['address'], [user2]), eta, { from: user1 },
            ),
            "Timelock::executeTransaction: Transaction hasn't surpassed time lock.",
        );
        await time.increase(time.duration.days(4));
        await this.timelock.executeTransaction(
            this.sushi.address, '0', 'transferOwnership(address)',
            encodeParameters(['address'], [user2]), eta, { from: user1 },
        );
        assert.equal((await this.sushi.owner()).valueOf(), user2);
    });

    it('should also work with MasterChef', async () => {
        this.lp = await MockERC20.new('LPToken', 'LP', '10000000000', { from: minter })
        this.lp2 = await MockERC20.new('LPToken', 'LP', '10000000000', { from: minter })
        this.chef = await MasterChef.new(this.sushi.address, dev, '1000', '0', '1000', { from: owner })
        await this.sushi.transferOwnership(this.chef.address, { from: owner })
        await this.chef.add('100', this.lp.address, true)
        await this.chef.transferOwnership(this.timelock.address, { from: owner })
        const eta = (await time.latest()).add(time.duration.days(4))
        await this.timelock.queueTransaction(
            this.chef.address, '0', 'set(uint256,uint256,bool)',
            encodeParameters(['uint256', 'uint256', 'bool'], ['0', '200', false]), eta, { from: user1 },
        );
        await this.timelock.queueTransaction(
            this.chef.address, '0', 'add(uint256,address,bool)',
            encodeParameters(['uint256', 'address', 'bool'], ['100', this.lp2.address, false]), eta, { from: user1 },
        );
        await time.increase(time.duration.days(4));
        await this.timelock.executeTransaction(
            this.chef.address, '0', 'set(uint256,uint256,bool)',
            encodeParameters(['uint256', 'uint256', 'bool'], ['0', '200', false]), eta, { from: user1 },
        );
        await this.timelock.executeTransaction(
            this.chef.address, '0', 'add(uint256,address,bool)',
            encodeParameters(['uint256', 'address', 'bool'], ['100', this.lp2.address, false]), eta, { from: user1 },
        );
        assert.equal((await this.chef.poolInfo('0')).valueOf().allocPoint, '200')
        assert.equal((await this.chef.totalAllocPoint()).valueOf(), '300')
        assert.equal((await this.chef.poolLength()).valueOf(), '2')
    })
})  