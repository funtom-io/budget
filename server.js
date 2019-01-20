const fs = require('fs');
const path = require('path');

const express = require('express');
const bodyParser = require('body-parser');
const hbs = require('hbs');
const morgan = require('morgan');
const rfs = require('rotating-file-stream');

const routes = require('./routes');

const PORT = process.env.PORT || 3000;

const server = express();

server.use(express.static(path.join(__dirname, 'public')));
server.use(bodyParser.json());

const logDirectory = path.join(__dirname, 'log');
fs.existsSync(logDirectory) || fs.mkdirSync(logDirectory);
const accessLogStream = rfs('access.log', {
    interval: '1d',
    path: logDirectory,
});

server.use(morgan('combined', {stream: accessLogStream}));

server.set('view engine', 'hbs');
hbs.registerPartials(__dirname + '/views/partials');

server.get('/balance', routes.getBalance);
server.post('/addAmount', routes.postAddAmount);
server.get('/sheetBalance', routes.getSheetBalance);

server.listen(PORT, () => {
    console.log(`Server started at port ${PORT}. Go to http://localhost:${PORT}/balance`);
});
