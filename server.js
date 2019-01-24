const path = require('path');

const passport = require('passport');
const express = require('express');
const bodyParser = require('body-parser');
const hbs = require('hbs');
const cookieParser = require('cookie-parser');
const cookieSession = require('cookie-session');

require('dotenv').config();

const auth = require('./auth');
const routes = require('./routes');
const PORT = process.env.PORT;

const server = express();

server.use(cookieSession({
    name: 'session',
    keys: [process.env.COOKIE_SESSION_KEY],
    axAge: 30 * 60 * 1000
}));

server.use(cookieParser());
auth(passport);
server.use(passport.initialize());
server.use(express.static(path.join(__dirname, 'public')));
server.use(bodyParser.json());
server.set('view engine', 'hbs');
hbs.registerPartials(__dirname + '/views/partials');

server.get('/login', passport.authenticate('google', {
    scope: ["https://www.googleapis.com/auth/drive.readonly", "https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/plus.login"]
}));

server.get('/logout', (req, res) => {
    req.logout();
    req.session = null;
    res.redirect('/');
});

server.get('/auth/google/callback',
    passport.authenticate('google', {
        failureRedirect: '/'
    }),
    (req, res) => {
        if (process.env.ALLOWED_ACCOUNTS.split(",").includes(req.user.profile.id) === false) {
            res.status(401);
            res.send('<html lang="en"><body><h1>Authentication failure</h1></body></html>');
        } else {
            req.session.token = req.user.token;
            res.redirect('/');
        }
    }
);

function validateToken(req, res) {
    let token = req.session.token;
    if (token) {
        res.cookie('token', token);
        return true;
    } else {
        res.cookie('token', '');
        res.status(401);
        res.send('<html lang="en"><body><h1>Please login first</h1></body></html>');
        return false;
    }
}

server.get('/', (req, res) => {
    if (validateToken(req, res))
        routes.getBalance(req, res);
});

server.post('/addAmount', (req, res) => {
    if (validateToken(req, res))
        routes.postAddAmount(req, res);
});

server.get('/sheetBalance', (req, res) => {
    if (validateToken(req, res))
        routes.getSheetBalance(req, res);
});

server.listen(PORT, () => {
    console.log(`Server started at port ${PORT}. Go to http://localhost:${PORT}/`);
});
