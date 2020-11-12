
// Wait for a web3 tx `send()` call to be mined and return the receipt
function waitForTxSuccess(tx) {
    return new Promise((accept, reject) => {
        try {
            tx.on('error', err => reject(err))
            tx.on('receipt', receipt => accept(receipt))
        } catch (err) {
            reject(err)
        }
    })
}

module.export = {
    waitForTxSuccess
}