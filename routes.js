const google = require('./google');

module.exports.getBalance = (req, res) => {
    let token = req.session.token;
    google.findAllEnvelopes(token)
        .then(envelopes => google.enrichEnvelopes(token, envelopes))
        .then(envelopes => {

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
        }).catch((err) => {
            res.status(err.code).json({
                error: err.message
            })
    })
};

module.exports.postAddAmount = (req, res) => {
    let token = req.session.token;
    let sheetId = req.body.sheetId;
    let amount = req.body.amount;
    let comment = req.body.comment;

    google.findFreeRowNumber(token, sheetId).then((row) => {
        return google.addAmountToSheet(token, sheetId, row, amount, comment);
    }).then(() => {
        res.status(200).json({
            result: "success"
        });
    }).catch((err) => {
        res.status(err.code).json({
            error: err.message
        })
    });
};

module.exports.getSheetBalance = (req, res) => {
    let token = req.session.token;
    let sheetId = req.query.sheetId;

    google.getSheetBalance(token, sheetId).then((balance) => {
        res.status(200).json({
            result: balance
        });
    }).catch((err) => {
        res.status(err.code).json({
            error: err.message
        })
    });
};