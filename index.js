const express = require('express');
const { Users, Attendance, Groups} = require('./MeModule/SequelizeModels');
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
app.use(express.json());
app.use('/', login);

//---------------------------------------------------------------------------
var pasport;
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
            group: pasport.group.realName
        });
    });

app.route('/select')
    .get(isAunth, (req, res) => {
        res.render('select');
    });

app.route('/update')
    .get(isAunth, async (req, res) => {
        var date = new Date().toLocaleDateString('ko-KR');
        var users;

        await Attendance.findOne({
            where: { 
                Date: date,
            },
            include: [{ 
                model: Users,
                where: { login: pasport.login },
                include: [{
                    model: Groups,
                    where: { 
                        Name: pasport.group.realName
                     } 
                }]
            }]
        }).then(async(result) => {
            console.log('\n' + JSON.stringify(result) + '\n');
            if(result == null)
                users = await getUsersGroup();
            else
                await setGroupStatus(false);
        });

        await Groups.findOne({
            where: {
                Name: pasport.group.realName
            }
        }).then((result) => {
            console.log(JSON.stringify(result))
            res.render('update', {
                allUsers: users,
                group: pasport.group.realName,
                isDate: result.Status,
            });  
        });
    })
    .post(isAunth, async (req, res) => {
        var data = await req.body; 
        var date = new Date().toLocaleDateString('ko-KR');

        for(var key in data){
            var listJson = {};
            data[key].forEach((value, i) => {
                listJson['p' + i] = value;
            });

            await Attendance.create({
                Date: date,
                idUser: key,
                value: listJson
            });
        }

        await setGroupStatus(true);
        res.redirect('/update');

    });

//---------------------------------------------------------------------------

async function setGroupStatus(s){
    await Groups.update({ Status: s }, {
        where: {
            Name: pasport.group.realName
        }
    }).then((result) => {
        console.log(JSON.stringify(result));
    });
}

async function getUsersGroup(){
    var all_users;
    await Users.findAll({
        where: { group: pasport.group.foreignName }, 
        include: [{ 
            model: Groups
        }]
    }).then((result) => {
        console.log(JSON.stringify(result));
        all_users = result
    });
    return all_users
}

//---------------------------------------------------------------------------

sequelize.sync({})
.then(() => {
    app.listen(port, () => {
        console.log(`Start server: ${port}`);
    });
});