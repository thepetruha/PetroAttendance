const { Users, Groups } = require('./SequelizeModels');
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

        await Users.findOne({
            where: {
                login: loginForm, 
                password: passwordForm
            }, include: [{
                model: Groups
            }]
        }).then(result => {
            console.log(JSON.stringify(result));

            if(result){
                const token = jwt.sign({
                    login: result.login, 
                    password: result.password, 
                    first_name: result.first_name, 
                    surname: result.surname, 
                    group: {
                        realName: result.Group.Name,
                        foreignName: result.group,
                        status: result.Group.Status
                    }
                }, 'petro-college', {expiresIn: 60 * 60});
                
                res.cookie('name', token);
                res.redirect('/');
            }else{
                res.redirect('/login');
            }
        });
    });


    router.route('/logout')
    .get((req, res) => {
        res.clearCookie('name');
        res.redirect('/login');
    });

//---------------------------------------------------------------------------

module.exports = router