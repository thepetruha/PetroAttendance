const { Users } = require('./SequelizeModels');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const express = require('express');
const cookieParser = require('cookie-parser');

const app = express();
const router = express.Router();
const urlParser = bodyParser.urlencoded({extended: false});

router.use(cookieParser());

//---------------------------------------------------------------------------

router.route('/login')
    .get(async(req, res) => {
        res.render('index');
    })
    .post(urlParser, async (req, res) => {
        const loginForm = req.body.login; 
        const passwordForm = req.body.password;

        const users = await Users.findOne({where: {login: loginForm, password: passwordForm}});
        if(users){
            const token = jwt.sign({
                login: users.dataValues.login, 
                password: users.dataValues.password, 
                first_name: users.dataValues.first_name, 
                surname: users.dataValues.surname, 
                group: users.dataValues.group
            }, 'petro-college', {expiresIn: 60 * 60});
            
            res.cookie('name', token);
            res.redirect('/');
        }else{
            res.redirect('/login');
        }

        res.render('index');
    });


    router.route('/logout')
    .get(async(req, res) => {
        res.clearCookie('name');
        res.redirect('/login');
    });

//---------------------------------------------------------------------------

module.exports = router