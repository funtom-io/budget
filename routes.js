const google = require('./google');

function exitWithError(res, err) {
    console.log(err);
    res.status(400).json({
        error: err.message
    })
}

module.exports.getBalance = async (req, res) => {
    try {
        let token = req.session.token;
        let envelopes;
        envelopes = await google.findAllEnvelopes(token);
        envelopes = await google.enrichEnvelopes(token, envelopes);

        let sum = (acc, curr) => acc + curr;
        let plus = envelopes.map(e => e.balance).filter(e => e > 0).reduce(sum, 0);
        let minus = envelopes.map(e => e.balance).filter(e => e < 0).reduce(sum, 0);
        let total = envelopes.map(e => e.balance).reduce(sum, 0);

        res.render('balance', {
            data: envelopes,
            plus: plus,
            minus: minus,
            total: total
        });
    } catch (e) {
        exitWithError(res, e);
    }
};

module.exports.postAddAmount = async (req, res) => {
    let token = req.session.token;
    let sheetId = req.body.sheetId;
    let amount = req.body.amount;
    let comment = req.body.comment;

    try {
        let row = await google.findFreeRowNumber(token, sheetId);
        await google.addAmountToSheet(token, sheetId, row, amount, comment);
        res.status(200).json({
            result: "success"
        });
    } catch (e) {
        exitWithError(res, e);
    }
};

module.exports.getSheetBalance = async (req, res) => {
    let token = req.session.token;
    let sheetId = req.query.sheetId;

    try {
        let balance = await google.getSheetBalance(token, sheetId);
        res.status(200).json({
            result: balance
        });
    } catch (e) {
        exitWithError(res, e);
    }
};