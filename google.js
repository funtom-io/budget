const {google} = require('googleapis');
require('dotenv').config();

const envelopesCache = new Map();

function findAllEnvelopes(token) {
    const auth = new google.auth.OAuth2(process.env.CLIENT_SECRET, process.env.CLIENT_ID, process.env.CALLBACK_URL);
    auth.setCredentials({access_token: token});

    return new Promise((resolve, reject) => {
        const drive = google.drive({version: 'v3', auth});
        drive.files.list({
            q: "mimeType='application/vnd.google-apps.spreadsheet' and '0B46Z1DtmRS7qLU9LajZ5NnBLUXM' in parents and trashed = false",
            orderBy: 'name',
            spaces: 'drive',
            fields: 'files(id, name, version)',
            pageSize: 1000
        }, (err, res) => {
            if (err) {
                reject(err);
            } else {
                let result = res.data.files.map(f => {
                    return {'id': f.id, 'name': f.name, 'version': f.version}
                });

                resolve(result);
            }
        });
    });
}

function enrichEnvelopes(token, envelopes) {
    const auth = new google.auth.OAuth2(process.env.CLIENT_SECRET, process.env.CLIENT_ID, process.env.CALLBACK_URL);
    auth.setCredentials({access_token: token});

    return new Promise((resolve, reject) => {

        let keys = 0;
        for (let e in  Object.keys(envelopes)) {
            if (envelopes.hasOwnProperty(e)) {
                keys++;
            }
        }

        function onEnvelopeCompletion() {
            keys--;
            if (keys === 0) {
                resolve(envelopes);
            }
        }

        const sheets = google.sheets({version: 'v4', auth});

        for (let e in  Object.keys(envelopes)) {
            if (envelopes.hasOwnProperty(e)) {

                let envelope = envelopes[e];
                const cachedEnvelope = envelopesCache.get(envelope.id);
                if (cachedEnvelope && cachedEnvelope.version === envelope.version) {
                    envelopes[e] = cachedEnvelope;
                    onEnvelopeCompletion()
                } else {
                    sheets.spreadsheets.values.get({
                        'spreadsheetId': envelope.id,
                        'range': "B1:C1"
                    }, (err, res) => {
                        if (err) {
                            reject(err);
                        } else {
                            envelope.balance = parseInt(res.data.values[0][0]);
                            envelope.budget = parseInt(res.data.values[0][1]);
                            envelope.link = 'https://docs.google.com/spreadsheets/d/' + envelopes[e].id;
                            envelopesCache.set(envelope.id, envelope);
                            onEnvelopeCompletion();
                        }
                    });
                }
            }
        }
    });
}

function getSheetBalance(token, sheetId) {

    const auth = new google.auth.OAuth2(process.env.CLIENT_SECRET, process.env.CLIENT_ID, process.env.CALLBACK_URL);
    auth.setCredentials({access_token: token});

    return new Promise((resolve, reject) => {
        const sheets = google.sheets({version: 'v4', auth});
        sheets.spreadsheets.values.get({
            'spreadsheetId': sheetId,
            'range': "B1"
        }, (err, res) => {
            if (err) reject(err);
            else resolve(res.data.values[0][0]);
        });
    });
}

function findFreeRowNumber(token, sheetId) {

    const auth = new google.auth.OAuth2(process.env.CLIENT_SECRET, process.env.CLIENT_ID, process.env.CALLBACK_URL);
    auth.setCredentials({access_token: token});

    return new Promise((resolve, reject) => {
        const sheets = google.sheets({version: 'v4', auth});

        sheets.spreadsheets.values.get({
            'spreadsheetId': sheetId,
            'range': "A1:A"
        }, (err, res) => {
            if (err) {
                reject(err);
            } else {
                resolve(res.data.values.length + 1);
            }
        });
    });
}

function addAmountToSheet(token, spreadsheetId, row, amount, comment, date) {

    const auth = new google.auth.OAuth2(process.env.CLIENT_SECRET, process.env.CLIENT_ID, process.env.CALLBACK_URL);
    auth.setCredentials({access_token: token});

    return new Promise((resolve, reject) => {

            function dateToString(date) {
                let toTwoDigits = (n) => ('0' + n).slice(-2);
                date = date ? date : new Date();
                return toTwoDigits(date.getDate()) + '/' + toTwoDigits(date.getUTCMonth() + 1) + '/' + toTwoDigits(date.getFullYear());
            }

            date = dateToString(date);

            let values;
            if (amount < 0) {
                values = [[date, undefined, Math.abs(amount), comment]];
            } else {
                values = [[date, amount, undefined, comment]];
            }

            const resource = {
                values
            };

            const sheets = google.sheets({version: 'v4', auth});

            sheets.spreadsheets.values.update({
                spreadsheetId: spreadsheetId,
                range: 'A' + row + ':D' + row,
                valueInputOption: 'USER_ENTERED',
                resource
            }, (err, result) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(result);
                }
            });
        }
    );
}

module.exports = {
    findAllEnvelopes, findFreeRowNumber, addAmountToSheet, enrichEnvelopes, getSheetBalance
};