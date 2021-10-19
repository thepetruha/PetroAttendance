const express = require('express');
const { Users, Attendance, Groups} = require('./MeModule/SequelizeModels');
const { sequelize } = require('./MeModule/ConnectDatabase');
const login = require('./MeModule/LoginIn');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');

const app = express();
const port = 4000;

//---------------------------------------------------------------------------------------------------------------------------------------------------------

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(cookieParser());
app.use(express.json());
app.use('/', login);

//---------------------------------------------------------------------------------------------------------------------------------------------------------

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

function isStatus(req, res, next) {
    console.log(req.originalUrl);
    if(pasport.status == 'User')
        res.redirect('/');
    else if(pasport.status == 'Moderator' && req.originalUrl == '/export')
        res.redirect('/');
    next();
}

//---------------------------------------------------------------------------------------------------------------------------------------------------------

app.route('/')
.get(isAunth, (req, res) => {
    res.render('menu', {
        name: pasport.first_name, 
        group: pasport.group.realName,
        status: pasport.status
    });
});

app.route('/select')
.get(isAunth, isStatus, (req, res) => {
    res.render('select');
});

app.route('/send')
.get(isAunth, isStatus, async (req, res) => {
    var numberPar
    if(req.query.par < 1) {
        numberPar = 1;
    }else if (req.query.par > 6){
        numberPar = 6;
    }else{
        numberPar = req.query.par
    }

    var users;
    await Attendance.findOne({
        where: { 
            Date: new Date().toLocaleDateString('ko-KR'),
        },
        include: [{
            model: Groups,
            where: { 
                Name: pasport.group.realName 
            }
        }]
    }).then(async(result) => {
        console.log(JSON.stringify(result));
        if(!result){
            console.log('На сегоднешней день нет записи')
            await setGroupStatus(false)
            .then(async() => {
                users = await getUsersGroup();
            })
        }else{
            console.log('На сегоднешней день уже создана запись')
            await setGroupStatus(true)
        }
    });

    await Groups.findOne({
        where: {
            Name: pasport.group.realName
        }
    }).then((result) => {
        console.log(JSON.stringify(result))
        if(result){
            res.render('send', {
                allUsers: users,
                userLogin: pasport.login,
                group: pasport.group.realName,
                isDate: result.Status,
                numPar: numberPar
            }); 
            console.log(result.Status);
        }
    });
})
.post(isAunth, isStatus, async (req, res) => {
    var data = await req.body; 

    for(var key in data){
        var listJson = {};
        data[key].forEach((value, i) => {
            listJson['p' + i] = value;
        });

        await Attendance.create({
            Date: new Date().toLocaleDateString('ko-KR'),
            idGroup: pasport.group.foreignName,
            idUser: key,
            value: listJson
        });
    }

    await setGroupStatus(true);
    res.redirect('/send');

});

app.route('/update')
.get(isAunth, isStatus, async (req, res) => {
    var users = await getUsersGroup();
    await Attendance.findAll({
        where: {
            idGroup: pasport.group.foreignName,
            Date: new Date().toLocaleDateString('ko-KR'),
        },
        include: [{
            model: Users
        }]
    }).then((result) => {
        console.log(JSON.stringify(result));
        res.render('update', {
            allUsers: users,
            userLogin: pasport.login,
            group: pasport.group.realName,
            checks: result
        }); 
    });
})
.post(isAunth, isStatus, async (req, res) => {
    var data = await req.body; 

    for(var key in data){
        var listJson = {};
        data[key].forEach((value, i) => {
            listJson['p' + i] = value;
        });

        await Attendance.update({ value: listJson }, {
            where: {
                Date: new Date().toLocaleDateString('ko-KR'),
                idGroup: pasport.group.foreignName,
                idUser: key,
            }
        })
    }

    res.redirect('/update');
})

app.route('/show')
.get(isAunth, async (req, res) => {
    var users = await getUsersGroup();
    await Attendance.findAll({
        where: {
            idGroup: pasport.group.foreignName,
            Date: new Date().toLocaleDateString('ko-KR'),
        },
        include: [{
            model: Users
        }]
    }).then((result) => {
        console.log(JSON.stringify(result));
        res.render('show', {
            allUsers: users,
            userLogin: pasport.login,
            group: pasport.group.realName,
            checks: result
        }); 
    });
});

app.route('/export')
.get(isAunth, isStatus, (req, res) => {
    res.render('export', {})
})

//---------------------------------------------------------------------------------------------------------------------------------------------------------

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

//---------------------------------------------------------------------------------------------------------------------------------------------------------

sequelize.sync({})
.then(() => {
    app.listen(port, () => {
        console.log(`Start server: ${port}`);
    });
});