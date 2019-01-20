const fs = require('fs');
const readline = require('readline');
const {google} = require('googleapis');

const SCOPES = ['https://www.googleapis.com/auth/drive.readonly', 'https://www.googleapis.com/auth/spreadsheets'];
const TOKEN_PATH = './db/token.json';
const CREDENTIALS_PATH = './db/credentials.json';

function execute(command) {

    if (process.env.CLIENT_ID && process.env.CLIENT_SECRET && process.env.REDIRECT_URIS) {
        authorize({
            client_id : process.env.CLIENT_ID,
            client_secret : process.env.CLIENT_SECRET,
            redirect_uris : process.env.REDIRECT_URIS
        });
    } else {
        fs.readFile(CREDENTIALS_PATH, (err, content) => {
            if (err) return console.log('Error loading client secret file:', err);
            authorize(JSON.parse(content), command);
        });
    }

    function authorize(credentials) {
        const {client_secret, client_id, redirect_uris} = credentials.installed;
        const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

        if (process.env.ACCESS_TOKEN && process.env.REFRESH_TOKEN && process.env.SCOPE && process.env.TOKEN_TYPE && process.env.EXPIRY_DATE) {
            oAuth2Client.setCredentials({
                access_token : process.env.ACCESS_TOKEN,
                refresh_token : process.env.REFRESH_TOKEN,
                scope : process.env.SCOPE,
                token_type : process.env.TOKEN_TYPE,
                expiry_date : process.env.EXPIRY_DATE
            });
            command(oAuth2Client);
        } else {
            fs.readFile(TOKEN_PATH, (err, token) => {
                if (err) return getAccessToken(oAuth2Client);
                oAuth2Client.setCredentials(JSON.parse(token));
                command(oAuth2Client);
            });
        }
    }

    function getAccessToken(oAuth2Client) {

        const authUrl = oAuth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: SCOPES
        });

        console.log('Authorize this app by visiting this url:', authUrl);

        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });

        rl.question('Enter the code from that page here: ', (code) => {
            rl.close();
            oAuth2Client.getToken(code, (err, token) => {
                if (err) return console.error('Error retrieving access token', err);
                oAuth2Client.setCredentials(token);
                fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
                    if (err) console.error(err);
                });
                command(oAuth2Client);
            });
        });
    }
}

function findAllEnvelopes() {
    return new Promise((resolve, reject) => {
        execute((auth) => {
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
                }
                else {
                    let result = res.data.files.map(f => {
                        return {'id': f.id, 'name': f.name , 'version': f.version}
                    });
                    resolve(result);
                }
            });
        });
    });
}

function enrichEnvelopes(envelopes) {
    return new Promise((resolve, reject) => {

        let requests = 0;
        for (let e in  Object.keys(envelopes)) {
            if (envelopes.hasOwnProperty(e)) {
                requests++;
            }
        }

        execute((auth) => {
            const sheets = google.sheets({version: 'v4', auth});

            for (let e in  Object.keys(envelopes)) {
                if (envelopes.hasOwnProperty(e)) {
                    sheets.spreadsheets.values.get({
                        'spreadsheetId': envelopes[e].id,
                        'range': "B1"
                    }, (err, res) => {
                        if (err) {
                            reject(err);
                        } else {
                            envelopes[e].balance = parseInt(res.data.values[0][0]);
                            envelopes[e].link = 'https://docs.google.com/spreadsheets/d/' + envelopes[e].id;
                            requests--;
                            if (requests === 0) {
                                resolve(envelopes);
                            }
                        }
                    });
                }
            }
        });
    });
}

function getSheetBalance(sheetId) {
    return new Promise((resolve, reject) => {
        execute((auth) => {
            const sheets = google.sheets({version: 'v4', auth});
            sheets.spreadsheets.values.get({
                'spreadsheetId': sheetId,
                'range': "B1"
            }, (err, res) => {
                if (err) reject(err);
                else resolve(res.data.values[0][0]);
            });
        });
    });
}

function findFreeRowNumber(sheetId) {
    return new Promise((resolve, reject) => {
         execute((auth) => {
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
    });
}

function addAmountToSheet(spreadsheetId, row, amount, comment, date) {

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

        execute((auth) => {
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
    });
}

module.exports = {
    findAllEnvelopes, findFreeRowNumber, addAmountToSheet, enrichEnvelopes, getSheetBalance
};