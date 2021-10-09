const express = require('express');
const { sequelize } = require('./MeModule/ConnectDatabase');
const login = require('./MeModule/LoginIn');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');

const app = express();
const port = 4000;

//---------------------------------------------------------------------------

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(cookieParser());
app.use('/', login);

//---------------------------------------------------------------------------

function isAunth(req, res, next){
    const cookies = req.cookies;
    var pasport = '';
    if(cookies){
        jwt.verify(cookies.name, 'petro-college', (err, decoded) => {
            if(decoded !== undefined){
                console.log(decoded) // bar
                pasport = decoded;
                next();
            }else{
                console.log('Not authorized!');
                res.redirect('/login');
            }
        });
    }else{
        console.log('Not cookies!');
        res.redirect('/login');
    }
}

//---------------------------------------------------------------------------

app.route('/')
    .get(isAunth, (req, res) => {
        res.render('menu');
    });

app.route('/select')
    .get(isAunth, (req, res) => {
        res.render('select');
    });

app.route('/update')
    .get(isAunth, (req, res) => {
        res.render('update');
    });

//---------------------------------------------------------------------------

sequelize.sync({})
.then(() => {
    app.listen(port, () => {
        console.log(`Start server: ${port}`);
    });
});