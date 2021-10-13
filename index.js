const express = require('express');
const { Users } = require('./MeModule/SequelizeModels');
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
var pasport = '';
function isAunth(req, res, next){
    const cookies = req.cookies;
    
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
        res.render('menu', {
            name: pasport.first_name, 
            group: pasport.group
        });
    });

app.route('/select')
    .get(isAunth, (req, res) => {
        res.render('select');
    });

app.route('/update')
    .get(isAunth, async (req, res) => {
        await Users.findAll({
            where: {
                group: '39-02'
            }
        })
        .then((result) => {
            console.log(result[0].dataValues.login);
            res.render('update', {allUsers: result});  
        });
    });
//---------------------------------------------------------------------------

sequelize.sync({})
.then(() => {
    app.listen(port, () => {
        console.log(`Start server: ${port}`);
    });
});